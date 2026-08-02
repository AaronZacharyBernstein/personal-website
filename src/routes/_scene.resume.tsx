import { createFileRoute } from "@tanstack/react-router";
import { sectionLabel } from "#/config/scene";

export const Route = createFileRoute("/_scene/resume")({
	head: () => ({ meta: [{ title: sectionLabel("/resume") }] }),
	component: ResumeSection,
});

function ResumeSection() {
	return <div>{sectionLabel(Route.fullPath)}</div>;
}
