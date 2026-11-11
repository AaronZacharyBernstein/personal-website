/**
 * What the GitHub panel needs, already reduced to plain serializable data
 * on the server. This is the shape that crosses to the browser (and into
 * the SSR HTML), so it carries nothing the panel does not draw.
 */

export interface GithubPinnedRepo {
	name: string;
	description: string | null;
	url: string;
	stars: number;
	language: { name: string; color: string | null } | null;
}

export interface GithubProfile {
	login: string;
	profileUrl: string;
	avatarUrl: string;
	/** Computed on the server in UTC, so server and client agree. */
	joinedYear: number;
	publicRepos: number;
	calendar: {
		/** Contributions in the period. */
		total: number;
		/** ISO date (YYYY-MM-DD) of the first day in `levels`. */
		start: string;
		/**
		 * One character per day, oldest first: "0" for none up to "4" for the
		 * busiest quartile. A string, not an array of day objects — a year is
		 * about 370 bytes this way instead of several kilobytes.
		 */
		levels: string;
	};
	pinned: GithubPinnedRepo[];
	/** Epoch milliseconds. */
	fetchedAt: number;
}

export type GithubProfileResult =
	| { ok: true; profile: GithubProfile }
	| { ok: false; reason: "missing-token" | "upstream-error" };
