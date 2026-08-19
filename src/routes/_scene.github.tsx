import { createFileRoute } from "@tanstack/react-router";
import { SectionPanel } from "#/components/section-panel";
import { sectionLabel } from "#/config/scene";

export const Route = createFileRoute("/_scene/github")({
	head: () => ({ meta: [{ title: sectionLabel("/github") }] }),
	component: GitHubSection,
});

function GitHubSection() {
	return (
		<SectionPanel title={sectionLabel(Route.fullPath)}>
			<p className="text-muted-foreground">
				GitHub activity will appear here in a later phase.
			</p>
		</SectionPanel>
	);
}
