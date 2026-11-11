import { TanStackDevtools } from "@tanstack/react-devtools";
import {
	createRootRoute,
	HeadContent,
	ScriptOnce,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { INTRO_BOOT } from "#/components/scene/intro-boot";
import { DESKTOP_MEDIA_QUERY, SCENE_BOARD_ART } from "#/config/scene";
import { SITE_TITLE } from "#/content/site";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: SITE_TITLE,
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			// The board's frame and cork are CSS images, so the browser only
			// learns of them once the stylesheet is parsed. Preloading starts
			// both fetches straight off the HTML — the board is the first thing
			// the intro shows, and the two should arrive together. Media-scoped
			// like the rules that paint them, so a phone never downloads them.
			...[SCENE_BOARD_ART.frame, SCENE_BOARD_ART.cork].map((href) => ({
				rel: "preload",
				as: "image",
				href,
				media: DESKTOP_MEDIA_QUERY,
			})),
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		// suppressHydrationWarning: the intro's head script may add classes to
		// this element before React hydrates it. React never renders a class
		// here and never reads those, so the difference is deliberate; the
		// flag covers this element's own attributes only.
		<html lang="en" suppressHydrationWarning>
			<head>
				{/* Runs before first paint and removes itself. See intro-boot.ts. */}
				<ScriptOnce>{INTRO_BOOT}</ScriptOnce>
				<HeadContent />
			</head>
			{/* suppressHydrationWarning: browser extensions (Grammarly and the
			    like) stamp attributes onto <body> before React hydrates, which
			    React 19 reports in dev as a mismatch. Nothing here renders a
			    body attribute, so there is no real mismatch for it to hide. */}
			<body suppressHydrationWarning>
				{children}
				<TanStackDevtools
					config={{
						position: "bottom-right",
					}}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
