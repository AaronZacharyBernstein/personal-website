import { createFileRoute } from "@tanstack/react-router";
import { sectionLabel } from "#/config/scene";

export const Route = createFileRoute("/_scene/links")({
	head: () => ({ meta: [{ title: sectionLabel("/links") }] }),
	component: LinksSection,
});

function LinksSection() {
	return <div>{sectionLabel(Route.fullPath)}</div>;
}
