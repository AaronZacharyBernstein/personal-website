import {
	createFileRoute,
	Outlet,
	retainSearchParams,
	useRouterState,
} from "@tanstack/react-router";
import {
	lazy,
	Suspense,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { SCENE_FRAME_STYLE } from "#/components/scene/frame";
import { Scene } from "#/components/scene/scene";
import { SceneMobile } from "#/components/scene/scene-mobile";
import {
	NAV_TOGGLE_ID,
	SECTION_NAV_ID,
	SectionNav,
} from "#/components/scene/section-nav";
import { NavOpenContext } from "#/components/section-panel";
import type { HotspotId } from "#/config/scene";
import { DESKTOP_MEDIA_QUERY, SCENE_SECTION_HOTSPOTS } from "#/config/scene";
import { SITE_NAME } from "#/content/site";
import { useMediaQuery } from "#/hooks/use-media-query";
import { cn } from "#/lib/utils.ts";

/** Lazy so the calibration bundle never loads on a normal page view. */
const CalibrationTool = lazy(
	() => import("#/components/scene/calibration/calibration-tool"),
);

interface SceneSearch {
	/** Optional (rather than boolean) so retainSearchParams never writes ?debug=false into URLs. */
	debug?: true;
	calibrate?: true;
}

/** `true` is accepted because the router re-serializes ?param=1 to ?param=true. */
function isFlagOn(value: unknown): boolean {
	return value === 1 || value === "1" || value === true;
}

export const Route = createFileRoute("/_scene")({
	validateSearch: (search: Record<string, unknown>): SceneSearch => {
		const result: SceneSearch = {};
		if (isFlagOn(search.debug)) {
			result.debug = true;
		}
		if (isFlagOn(search.calibrate)) {
			result.calibrate = true;
		}
		return result;
	},
	search: {
		middlewares: [retainSearchParams(["debug", "calibrate"])],
	},
	component: SceneLayout,
});

/**
 * Pathless layout: owns the scene, the nav, the hover state, and the
 * desktop nav collapse state so the scene stays mounted across section
 * navigations.
 */
function SceneLayout() {
	const [hoveredId, setHoveredId] = useState<HotspotId | null>(null);
	// Ephemeral desktop-only UI state; deliberately never in the URL.
	const [navOpen, setNavOpen] = useState(false);
	const navButtonRef = useRef<HTMLButtonElement | null>(null);
	const { debug, calibrate } = Route.useSearch();
	// A section panel is open iff a section hotspot's route is matched (the
	// envelope is an external link and has no route). Route-derived, so it is
	// known on the server and a cold /resume load renders the scene inert
	// (and hidden below md) with no hydration disagreement. Derived from the
	// MATCHES, not the pathname string: the router matches routes
	// case-insensitively, so a cold /Resume load renders the panel — and a
	// pathname comparison would miss it, leaving the scene live behind the
	// dialog.
	const sectionOpen = useRouterState({
		select: (s) =>
			s.matches.some((match) =>
				SCENE_SECTION_HOTSPOTS.some(
					(hotspot) => match.routeId === `/_scene${hotspot.route}`,
				),
			),
	});
	// Client-only chrome only. The scene itself no longer consults this: its
	// two variants both render on the server and hide themselves in CSS, so
	// nothing about the art waits on hydration. What is left needs the real
	// viewport — the calibration tool is a pointer-driven desktop editor, and
	// `inert` is meaningless below md where the nav never collapses.
	const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);

	// Every close path must also clear the hover-sync state: a link hidden
	// under a stationary pointer never fires mouseleave, so a hovered layer
	// would otherwise stay lifted (with its label chip) indefinitely.
	const closeNav = useCallback((options?: { refocus?: boolean }) => {
		setNavOpen(false);
		setHoveredId(null);
		// And every close path must park focus somewhere real, or the
		// focused link goes visibility:hidden and focus falls to <body>.
		// Below md the button is display:none and this is a no-op.
		// refocus false is for the one close path where something else is
		// about to take focus — choosing a section link, whose panel focuses
		// its own dialog on mount. Refocusing the toggle there loses the
		// race against the panel's mount effect and steals focus back out
		// of the dialog.
		if (options?.refocus !== false) {
			navButtonRef.current?.focus();
		}
	}, []);

	// Escape closes the nav and hands focus back to the toggle button. The
	// nav always outranks a section panel: this listener only exists while
	// the nav is open, and SectionPanel's own listener yields whenever
	// NavOpenContext says it is — so one keypress never closes both.
	// preventDefault is belt and braces on top of that: the panel also
	// ignores any Escape something else has already claimed.
	useEffect(() => {
		if (!navOpen) {
			return;
		}
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				closeNav();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [navOpen, closeNav]);

	return (
		<div className="mx-auto w-full px-4 py-6">
			{/* The name on the board is lettering in an image, so the page's
			    real heading is this one: in the server-rendered HTML for
			    search engines and screen readers, visually hidden. Only on
			    the board itself — an open section's panel carries its own h1. */}
			{sectionOpen ? null : <h1 className="sr-only">{SITE_NAME}</h1>}
			{/* Desktop-only nav toggle. Mobile keeps the always-visible list,
			    so below md there is no button and no collapsed state. */}
			<button
				ref={navButtonRef}
				id={NAV_TOGGLE_ID}
				type="button"
				aria-expanded={navOpen}
				aria-controls={SECTION_NAV_ID}
				aria-label={navOpen ? "Close navigation" : "Open navigation"}
				onClick={() => {
					if (navOpen) {
						closeNav();
					} else {
						// Safari/Firefox on macOS do not focus buttons on click;
						// anchor focus explicitly so close paths behave the same
						// everywhere. On open, SectionNav's effect then moves
						// focus to the first link.
						navButtonRef.current?.focus();
						setNavOpen(true);
					}
				}}
				// right offset includes --scroll-lock-gap: an open panel removes
				// the page scrollbar, which widens the viewport that fixed
				// elements position against; the panel publishes the vanished
				// width so this chrome doesn't jump right by a scrollbar.
				className="fixed top-4 right-[calc(1rem+var(--scroll-lock-gap,0px))] z-50 hidden size-10 items-center justify-center rounded-md border bg-background shadow-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-muted-foreground focus-visible:outline-none md:inline-flex"
			>
				<svg
					viewBox="0 0 24 24"
					className="size-5"
					fill="none"
					stroke="currentColor"
					strokeWidth={2}
					strokeLinecap="round"
					aria-hidden="true"
				>
					<path d="M4 6h16M4 12h16M4 18h16" />
				</svg>
			</button>
			<div className="flex flex-col items-center gap-6 md:flex-row md:items-start md:justify-center">
				{isDesktop === true && calibrate === true ? (
					<Suspense
						fallback={
							// Same-size box so the layout never collapses while the
							// lazy calibration chunk loads.
							<div data-scene-frame="" style={SCENE_FRAME_STYLE} />
						}
					>
						<CalibrationTool debug={debug === true} />
					</Suspense>
				) : (
					// isolate: the scene's internal z-indexes must never paint
					// above the fixed z-50 nav chrome. Sized by the
					// [data-scene-frame] rules in styles.css.
					<div
						data-scene-frame=""
						className={cn(
							"relative isolate overflow-hidden",
							// Below md the scene is purely decorative, so an open
							// section hides it outright: a phone gets the content
							// and nothing else, and a display:none subtree never
							// fetches its background art.
							sectionOpen && "max-md:hidden",
						)}
						// While a panel is open the scene must not be hoverable,
						// clickable, or tabbable. inert covers pointer AND
						// keyboard/AT; unlike the nav's, this one can be
						// server-rendered because sectionOpen is route state.
						inert={sectionOpen}
						style={SCENE_FRAME_STYLE}
					>
						{/* Both variants render on the server and stay mounted at
						    every width; each hides itself with a CSS breakpoint,
						    and the media-query-scoped background rules mean the
						    hidden one never fetches its art. Nothing on this path
						    reads the viewport, so server and client markup are
						    identical and the art starts downloading straight off
						    the SSR'd HTML instead of waiting for hydration to
						    decide who mounts. */}
						<Scene
							hoveredId={hoveredId}
							onHoverChange={setHoveredId}
							debug={debug === true}
						/>
						<SceneMobile />
					</div>
				)}
				<SectionNav
					hoveredId={hoveredId}
					onHoverChange={setHoveredId}
					open={navOpen}
					// A section link's panel takes focus itself; refocusing the
					// toggle would steal it back out of the dialog. Home and the
					// external "Say hi" link (route null) mount no panel, so
					// there the toggle must still catch focus.
					onLinkClick={(route) =>
						closeNav({
							refocus: !SCENE_SECTION_HOTSPOTS.some(
								(hotspot) => hotspot.route === route,
							),
						})
					}
					// Belt and braces with the CSS visibility collapse: inert
					// drops the links out of the tab order the instant the nav
					// closes, covering the 200ms closing fade during which
					// visibility is still transitioning. Desktop only — below
					// md the list is the sole navigation, and pre-hydration
					// (isDesktop null) the SSR'd visibility rule covers it.
					inert={isDesktop === true && !navOpen}
					hideBelowMd={sectionOpen}
				/>
			</div>
			{/* Section content mounts here. Every section renders a
			    SectionPanel, which positions itself (fixed overlay on
			    desktop, full page on mobile), so no wrapper box is needed —
			    only the nav state the panel's Escape handler must yield to. */}
			<NavOpenContext.Provider value={navOpen}>
				<Outlet />
			</NavOpenContext.Provider>
		</div>
	);
}
