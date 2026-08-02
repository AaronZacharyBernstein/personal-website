import {
	createFileRoute,
	Outlet,
	retainSearchParams,
} from "@tanstack/react-router";
import {
	lazy,
	Suspense,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { Scene } from "#/components/scene/scene";
import { SceneMobile } from "#/components/scene/scene-mobile";
import { SECTION_NAV_ID, SectionNav } from "#/components/scene/section-nav";
import type { HotspotId } from "#/config/scene";
import { SCENE_ASPECT_RATIO, SCENE_MAX_WIDTH } from "#/config/scene";
import { useMediaQuery } from "#/hooks/use-media-query";

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

const DESKTOP_MEDIA_QUERY = "(min-width: 768px)";

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
	const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);

	// Every close path must also clear the hover-sync state: a link hidden
	// under a stationary pointer never fires mouseleave, so a hovered layer
	// would otherwise stay lifted (with its label chip) indefinitely.
	const closeNav = useCallback(() => {
		setNavOpen(false);
		setHoveredId(null);
		// And every close path must park focus somewhere real, or the
		// focused link goes visibility:hidden and focus falls to <body>.
		// Below md the button is display:none and this is a no-op.
		navButtonRef.current?.focus();
	}, []);

	// Escape closes the panel and hands focus back to the toggle button.
	useEffect(() => {
		if (!navOpen) {
			return;
		}
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				closeNav();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [navOpen, closeNav]);

	return (
		<div className="mx-auto w-full px-4 py-6">
			{/* Desktop-only nav toggle. Mobile keeps the always-visible list,
			    so below md there is no button and no collapsed state. */}
			<button
				ref={navButtonRef}
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
				className="fixed top-4 right-4 z-50 hidden size-10 items-center justify-center rounded-md border bg-background shadow-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-muted-foreground focus-visible:outline-none md:inline-flex"
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
							<div
								className="w-full"
								style={{
									maxWidth: SCENE_MAX_WIDTH,
									aspectRatio: `${SCENE_ASPECT_RATIO} / 1`,
								}}
							/>
						}
					>
						<CalibrationTool debug={debug === true} />
					</Suspense>
				) : (
					// isolate: the scene's internal z-indexes must never paint
					// above the fixed z-50 nav chrome.
					<div
						className="relative isolate w-full overflow-hidden"
						style={{
							maxWidth: SCENE_MAX_WIDTH,
							aspectRatio: `${SCENE_ASPECT_RATIO} / 1`,
						}}
					>
						{/* isDesktop is null on the server and during the first
						    hydration render: neither variant mounts, but this box
						    still reserves the scene's 2:1 space. */}
						{isDesktop === true ? (
							<Scene
								hoveredId={hoveredId}
								onHoverChange={setHoveredId}
								debug={debug === true}
							/>
						) : null}
						{isDesktop === false ? <SceneMobile /> : null}
					</div>
				)}
				<SectionNav
					hoveredId={hoveredId}
					onHoverChange={setHoveredId}
					open={navOpen}
					onLinkClick={closeNav}
					// Belt and braces with the CSS visibility collapse: inert
					// drops the links out of the tab order the instant the nav
					// closes, covering the 200ms closing fade during which
					// visibility is still transitioning. Desktop only — below
					// md the list is the sole navigation, and pre-hydration
					// (isDesktop null) the SSR'd visibility rule covers it.
					inert={isDesktop === true && !navOpen}
				/>
			</div>
			{/* Section content mounts here. How each panel presents itself
			    (overlay, replace, beside) is decided per section in a later
			    phase; this container deliberately has no opinion. */}
			<div data-section-outlet className="mt-6">
				<Outlet />
			</div>
		</div>
	);
}
