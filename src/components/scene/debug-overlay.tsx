import type { HotspotId } from "#/config/scene";
import { SCENE_CORK, SCENE_HOTSPOTS } from "#/config/scene";
import { layerPolygonInScene, SCENE_TACKS } from "#/config/scene-geometry";
import {
	DEBUG_OVERLAY_Z,
	polygonCentroid,
	toViewBoxPoints,
	VIEWBOX_HEIGHT,
	VIEWBOX_WIDTH,
} from "./geometry";

/**
 * Development tool for checking that each hit polygon tracks its item's
 * silhouette. Mounted only when the debug search param is on, so it has
 * zero effect on the normal render path. Also draws the usable cork
 * (SCENE_CORK) and each tack's pivot point.
 */
export function DebugOverlay({ hoveredId }: { hoveredId: HotspotId | null }) {
	return (
		<svg
			viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
			preserveAspectRatio="none"
			aria-hidden="true"
			className="pointer-events-none absolute inset-0 h-full w-full"
			style={{ zIndex: DEBUG_OVERLAY_Z }}
		>
			<rect
				x={SCENE_CORK.x0 * VIEWBOX_WIDTH}
				y={SCENE_CORK.y0 * VIEWBOX_HEIGHT}
				width={(SCENE_CORK.x1 - SCENE_CORK.x0) * VIEWBOX_WIDTH}
				height={(SCENE_CORK.y1 - SCENE_CORK.y0) * VIEWBOX_HEIGHT}
				fill="none"
				stroke="#0f172a"
				strokeWidth={1.5}
				strokeDasharray="6 4"
				strokeOpacity={0.6}
			/>
			{SCENE_HOTSPOTS.map((hotspot) => {
				const polygon = layerPolygonInScene(hotspot);
				const [centroidX, centroidY] = polygonCentroid(polygon);
				return (
					<g key={hotspot.id}>
						<polygon
							points={toViewBoxPoints(polygon)}
							fill={hotspot.placeholderColor}
							fillOpacity={0.12}
							stroke={hotspot.placeholderColor}
							strokeWidth={2}
							strokeOpacity={hoveredId === hotspot.id ? 1 : 0.5}
						/>
						{/* Undistorted because the viewBox has the scene's own
						    aspect ratio; preserveAspectRatio="none" would shear
						    text if the two ever disagreed. */}
						<text
							x={centroidX * VIEWBOX_WIDTH}
							y={centroidY * VIEWBOX_HEIGHT}
							textAnchor="middle"
							dominantBaseline="middle"
							fontSize={14}
							fontFamily="monospace"
							fill={hotspot.placeholderColor}
						>
							{hotspot.id}
						</text>
					</g>
				);
			})}
			{SCENE_TACKS.map((tack) => (
				<circle
					key={tack.id}
					cx={(tack.box.x + tack.box.width / 2) * VIEWBOX_WIDTH}
					cy={(tack.box.y + tack.box.height / 2) * VIEWBOX_HEIGHT}
					r={3}
					fill="#0f172a"
					stroke="white"
					strokeWidth={1}
				/>
			))}
		</svg>
	);
}
