import { createFileRoute } from "@tanstack/react-router";
import { SectionPanel } from "#/components/section-panel";
import { sectionLabel } from "#/config/scene";

export const Route = createFileRoute("/_scene/projects")({
	head: () => ({ meta: [{ title: sectionLabel("/projects") }] }),
	component: ProjectsSection,
});

function ProjectsSection() {
	return (
		<SectionPanel title={sectionLabel(Route.fullPath)}>
			<p className="text-muted-foreground">
				Projects will appear here in a later phase.
			</p>
		</SectionPanel>
	);
}
