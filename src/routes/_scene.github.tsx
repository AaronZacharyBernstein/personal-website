import { Await, CatchBoundary, createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import {
	GithubLoading,
	GithubProfileView,
	GithubUnavailable,
} from "#/components/github-panel";
import { SectionPanel } from "#/components/section-panel";
import { sectionLabel } from "#/config/scene";
import { getGithubProfile } from "#/lib/github.functions";

export const Route = createFileRoute("/_scene/github")({
	head: () => ({ meta: [{ title: sectionLabel("/github") }] }),
	// Deliberately not awaited. An awaited loader holds the navigation —
	// and with it the panel — until GitHub answers; handing the panel the
	// promise lets it open at once and fill in. On a cold load of /github
	// the server streams the result into the same boundary.
	loader: () => ({ profile: getGithubProfile() }),
	// Reopening the panel reuses the data rather than calling the server
	// again; the server's own cache is an hour, this is only the tab's.
	staleTime: 5 * 60_000,
	preloadStaleTime: 5 * 60_000,
	component: GitHubSection,
});

function GitHubSection() {
	const { profile } = Route.useLoaderData();
	return (
		<SectionPanel title={sectionLabel(Route.fullPath)}>
			{/* Inside the panel, so a failed request swaps the body for the
			    profile link without unmounting the dialog (and replaying its
			    entrance and focus). The server function itself never throws —
			    a missing token or a GitHub outage arrives as `ok: false` —
			    so this boundary is for the request to our own server failing. */}
			<CatchBoundary
				getResetKey={() => "github-profile"}
				errorComponent={GithubUnavailable}
			>
				<Suspense fallback={<GithubLoading />}>
					<Await promise={profile}>
						{(result) =>
							result.ok ? (
								<GithubProfileView profile={result.profile} />
							) : (
								<GithubUnavailable />
							)
						}
					</Await>
				</Suspense>
			</CatchBoundary>
		</SectionPanel>
	);
}
