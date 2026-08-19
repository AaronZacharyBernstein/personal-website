import { createFileRoute } from "@tanstack/react-router";
import { SectionPanel } from "#/components/section-panel";
import { sectionLabel } from "#/config/scene";

export const Route = createFileRoute("/_scene/links")({
	head: () => ({ meta: [{ title: sectionLabel("/links") }] }),
	component: LinksSection,
});

function LinksSection() {
	return (
		<SectionPanel title={sectionLabel(Route.fullPath)}>
			<p className="text-muted-foreground">
				Links will appear here in a later phase.
			</p>
		</SectionPanel>
	);
}
