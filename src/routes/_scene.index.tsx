import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_scene/")({
	component: HomeSection,
});

/** The scene itself is the homepage; the index route contributes nothing. */
function HomeSection() {
	return null;
}
