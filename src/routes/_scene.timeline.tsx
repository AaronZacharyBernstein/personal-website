import { createFileRoute } from "@tanstack/react-router";
import { sectionLabel } from "#/config/scene";

export const Route = createFileRoute("/_scene/timeline")({
	head: () => ({ meta: [{ title: sectionLabel("/timeline") }] }),
	component: TimelineSection,
});

function TimelineSection() {
	return <div>{sectionLabel(Route.fullPath)}</div>;
}
