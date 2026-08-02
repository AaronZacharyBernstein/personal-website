import { createFileRoute } from "@tanstack/react-router";
import { sectionLabel } from "#/config/scene";

export const Route = createFileRoute("/_scene/github")({
	head: () => ({ meta: [{ title: sectionLabel("/github") }] }),
	component: GitHubSection,
});

function GitHubSection() {
	return <div>{sectionLabel(Route.fullPath)}</div>;
}
