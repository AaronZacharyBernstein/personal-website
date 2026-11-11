/**
 * Server-only: fetches the GitHub panel's data with a token from the Worker
 * environment. The `.server` suffix is load-bearing — the Start build
 * refuses to let client code import a `*.server.*` file — and this module
 * is reached only from inside the server function's handler, which the
 * compiler strips from the client bundle along with this import.
 *
 * `env` is read inside functions, never at module scope: a module-scope
 * read would keep the `cloudflare:workers` import alive in the client build.
 */

import { env, waitUntil } from "cloudflare:workers";
import { getRequest } from "@tanstack/react-start/server";
import { GITHUB_USERNAME } from "#/content/socials";
import type {
	GithubPinnedRepo,
	GithubProfile,
	GithubProfileResult,
} from "./github.types";

/** How long a good response is reused, in both cache layers. */
const CACHE_SECONDS = 3600;
/** How long a failure is remembered, so an outage is not hammered. */
const FAILURE_SECONDS = 60;
const TIMEOUT_MS = 5000;
/** Bump when GithubProfile changes shape, to orphan older cache entries. */
const CACHE_PATH = "/__cache/github-profile/v1";

const GRAPHQL_URL = "https://api.github.com/graphql";
/** GitHub rejects requests without one. Generic: it identifies the client, not a person. */
const USER_AGENT = "site-github-panel";

/**
 * Everything in one request: contributionsCollection defaults to the past
 * year, and `ownerAffiliations: [OWNER]` keeps the count to repositories
 * owned by the account (the default also counts collaborations).
 */
const QUERY = `
query GithubProfile($login: String!) {
  user(login: $login) {
    login
    url
    avatarUrl(size: 160)
    createdAt
    repositories(ownerAffiliations: [OWNER], privacy: PUBLIC) { totalCount }
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionLevel } }
      }
    }
    pinnedItems(first: 6, types: [REPOSITORY]) {
      nodes {
        ... on Repository { name description url stargazerCount primaryLanguage { name color } }
      }
    }
  }
}`;

const LEVELS: Record<string, string> = {
	NONE: "0",
	FIRST_QUARTILE: "1",
	SECOND_QUARTILE: "2",
	THIRD_QUARTILE: "3",
	FOURTH_QUARTILE: "4",
};

interface GraphqlUser {
	login: string;
	url: string;
	avatarUrl: string;
	createdAt: string;
	repositories: { totalCount: number };
	contributionsCollection: {
		contributionCalendar: {
			totalContributions: number;
			weeks: Array<{
				contributionDays: Array<{ date: string; contributionLevel: string }>;
			}>;
		};
	};
	pinnedItems: {
		nodes: Array<{
			name?: string;
			description?: string | null;
			url?: string;
			stargazerCount?: number;
			primaryLanguage?: { name: string; color: string | null } | null;
		} | null>;
	};
}

interface GraphqlResponse {
	data?: { user: GraphqlUser | null } | null;
	errors?: Array<{ type?: string; message?: string }>;
}

function toProfile(user: GraphqlUser): GithubProfile {
	const calendar = user.contributionsCollection.contributionCalendar;
	// The first and last weeks can be partial, so flatten to days and let
	// the panel place them by date.
	const days = calendar.weeks.flatMap((week) => week.contributionDays);
	const pinned: GithubPinnedRepo[] = [];
	for (const node of user.pinnedItems.nodes) {
		if (node?.name && node.url) {
			pinned.push({
				name: node.name,
				description: node.description ?? null,
				url: node.url,
				stars: node.stargazerCount ?? 0,
				language: node.primaryLanguage ?? null,
			});
		}
	}
	return {
		login: user.login,
		profileUrl: user.url,
		avatarUrl: user.avatarUrl,
		joinedYear: new Date(user.createdAt).getUTCFullYear(),
		publicRepos: user.repositories.totalCount,
		calendar: {
			total: calendar.totalContributions,
			start: days[0]?.date ?? "",
			levels: days.map((day) => LEVELS[day.contributionLevel] ?? "0").join(""),
		},
		pinned,
		fetchedAt: Date.now(),
	};
}

const UPSTREAM_ERROR: GithubProfileResult = {
	ok: false,
	reason: "upstream-error",
};

/** Never throws, and never logs the token: only statuses and error kinds. */
async function fetchFromGithub(token: string): Promise<GithubProfileResult> {
	try {
		const response = await fetch(GRAPHQL_URL, {
			method: "POST",
			headers: {
				Authorization: `bearer ${token}`,
				"Content-Type": "application/json",
				"User-Agent": USER_AGENT,
			},
			body: JSON.stringify({
				query: QUERY,
				variables: { login: GITHUB_USERNAME },
			}),
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		if (!response.ok) {
			console.error(`GitHub GraphQL responded ${response.status}`);
			return UPSTREAM_ERROR;
		}
		// A rate limit or a bad query arrives as HTTP 200 with `errors`.
		const body = (await response.json()) as GraphqlResponse;
		const user = body.data?.user;
		if ((body.errors && body.errors.length > 0) || !user) {
			console.error(
				"GitHub GraphQL returned no usable user",
				body.errors?.map((error) => error.type ?? error.message),
			);
			return UPSTREAM_ERROR;
		}
		return { ok: true, profile: toProfile(user) };
	} catch (error) {
		console.error(
			"GitHub GraphQL request failed",
			error instanceof Error ? error.name : "unknown error",
		);
		return UPSTREAM_ERROR;
	}
}

/**
 * Second cache layer, per Worker isolate. The Cache API below is the real
 * one-hour cache, but Cloudflare only guarantees it on custom domains; this
 * keeps the GitHub call rare wherever the Worker runs, and also spares the
 * Cache API round trip on a warm isolate. Plain data and a timestamp only —
 * never a promise, which must not be shared across requests.
 */
let memo: { result: GithubProfileResult; expiresAt: number } | null = null;

function remember(
	result: GithubProfileResult,
	expiresAt: number,
): GithubProfileResult {
	memo = { result, expiresAt };
	return result;
}

/**
 * The GitHub panel's data, from the nearest place that has it: this
 * isolate's memo, then the Workers Cache API, then GitHub itself.
 *
 * Always resolves. A missing token or a failed fetch comes back as
 * `{ ok: false }`, and the panel shows a plain profile link instead.
 */
export async function loadGithubProfile(): Promise<GithubProfileResult> {
	const now = Date.now();
	if (memo && now < memo.expiresAt) {
		return memo.result;
	}

	// `caches.default` is the Workers cache; the DOM lib's CacheStorage type
	// does not know it, hence the cast. Absent outside workerd.
	const cache = (
		globalThis.caches as (CacheStorage & { default?: Cache }) | undefined
	)?.default;
	// Keyed on this site's own origin, as a URL that is never routed.
	const cacheKey = new URL(CACHE_PATH, getRequest().url).toString();
	if (cache) {
		try {
			const hit = await cache.match(cacheKey);
			if (hit) {
				const profile = (await hit.json()) as GithubProfile;
				return remember(
					{ ok: true, profile },
					profile.fetchedAt + CACHE_SECONDS * 1000,
				);
			}
		} catch (error) {
			console.error("GitHub profile cache read failed", error);
		}
	}

	// After the cache on purpose: a cached profile is still served if the
	// token is later removed or expires.
	const token = env.GITHUB_TOKEN;
	if (!token) {
		return { ok: false, reason: "missing-token" };
	}

	const result = await fetchFromGithub(token);
	if (!result.ok) {
		// Remembered briefly, and never written to the shared cache.
		return remember(result, now + FAILURE_SECONDS * 1000);
	}
	if (cache) {
		// Off the response path: the visitor does not wait for the write.
		waitUntil(
			cache
				.put(
					cacheKey,
					Response.json(result.profile, {
						headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}` },
					}),
				)
				.catch((error: unknown) =>
					console.error("GitHub profile cache write failed", error),
				),
		);
	}
	return remember(result, now + CACHE_SECONDS * 1000);
}
