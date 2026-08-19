import { createFileRoute } from "@tanstack/react-router";
import { SectionPanel } from "#/components/section-panel";
import { sectionLabel } from "#/config/scene";
import { type SchoolEntry, TIMELINE } from "#/content/timeline";

export const Route = createFileRoute("/_scene/education")({
	head: () => ({ meta: [{ title: sectionLabel("/education") }] }),
	component: EducationSection,
});

function EducationSection() {
	// The "school" half of the shared timeline; /timeline takes "work".
	// Still a placeholder rendering: the real view is a later phase.
	const entries = TIMELINE.filter(
		(entry): entry is SchoolEntry => entry.kind === "school",
	);
	return (
		<SectionPanel title={sectionLabel(Route.fullPath)}>
			{entries.length === 0 ? (
				<p className="text-muted-foreground">
					Education will appear here in a later phase.
				</p>
			) : (
				entries.map((entry) => (
					<p key={`${entry.organization}-${entry.startDate}`}>
						{entry.organization} — {entry.degree}
					</p>
				))
			)}
		</SectionPanel>
	);
}
