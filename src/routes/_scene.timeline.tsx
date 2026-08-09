import { createFileRoute } from "@tanstack/react-router";
import { sectionLabel } from "#/config/scene";
import { TIMELINE } from "#/content/timeline";

export const Route = createFileRoute("/_scene/timeline")({
	head: () => ({ meta: [{ title: sectionLabel("/timeline") }] }),
	component: TimelineSection,
});

function TimelineSection() {
	// The "work" half of the shared timeline; /education takes "school".
	const entries = TIMELINE.filter((entry) => entry.kind === "work");
	return (
		<div>
			{sectionLabel(Route.fullPath)}
			{entries.map((entry) => (
				<p key={`${entry.organization}-${entry.startDate}`}>
					{entry.organization} — {entry.role}
				</p>
			))}
		</div>
	);
}
