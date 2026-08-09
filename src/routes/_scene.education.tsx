import { createFileRoute } from "@tanstack/react-router";
import { sectionLabel } from "#/config/scene";
import { TIMELINE } from "#/content/timeline";

export const Route = createFileRoute("/_scene/education")({
	head: () => ({ meta: [{ title: sectionLabel("/education") }] }),
	component: EducationSection,
});

function EducationSection() {
	// The "school" half of the shared timeline; /timeline takes "work".
	const entries = TIMELINE.filter((entry) => entry.kind === "school");
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
