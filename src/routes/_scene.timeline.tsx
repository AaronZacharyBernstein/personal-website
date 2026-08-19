import { createFileRoute } from "@tanstack/react-router";
import { SectionPanel } from "#/components/section-panel";
import { sectionLabel } from "#/config/scene";
import { TIMELINE, type WorkEntry } from "#/content/timeline";

export const Route = createFileRoute("/_scene/timeline")({
	head: () => ({ meta: [{ title: sectionLabel("/timeline") }] }),
	component: TimelineSection,
});

function TimelineSection() {
	// The "work" half of the shared timeline; /education takes "school".
	// Still a placeholder rendering: the real view is a later phase.
	const entries = TIMELINE.filter(
		(entry): entry is WorkEntry => entry.kind === "work",
	);
	return (
		<SectionPanel title={sectionLabel(Route.fullPath)}>
			{entries.length === 0 ? (
				<p className="text-muted-foreground">
					The work timeline will appear here in a later phase.
				</p>
			) : (
				entries.map((entry) => (
					<p key={`${entry.organization}-${entry.positions[0].startDate}`}>
						{entry.organization} — {entry.positions[0].title}
					</p>
				))
			)}
		</SectionPanel>
	);
}
