import { createFileRoute } from "@tanstack/react-router";
import { sectionLabel } from "#/config/scene";

export const Route = createFileRoute("/_scene/projects")({
	head: () => ({ meta: [{ title: sectionLabel("/projects") }] }),
	component: ProjectsSection,
});

function ProjectsSection() {
	return <div>{sectionLabel(Route.fullPath)}</div>;
}
