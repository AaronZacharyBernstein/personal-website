import {
	createFileRoute,
	Outlet,
	retainSearchParams,
} from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { Scene } from "#/components/scene/scene";
import { SceneMobile } from "#/components/scene/scene-mobile";
import { SectionNav } from "#/components/scene/section-nav";
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
 * Pathless layout: owns the scene, the nav, and the hover state so the
 * scene stays mounted across section navigations.
 */
function SceneLayout() {
	const [hoveredId, setHoveredId] = useState<HotspotId | null>(null);
	const { debug, calibrate } = Route.useSearch();
	const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);

	return (
		<div className="mx-auto w-full px-4 py-6">
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
					<div
						className="relative w-full overflow-hidden rounded-lg"
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
				<SectionNav hoveredId={hoveredId} onHoverChange={setHoveredId} />
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
