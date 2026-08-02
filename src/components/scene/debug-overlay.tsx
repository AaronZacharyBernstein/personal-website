import type { HotspotId } from "#/config/scene";
import { SCENE_HOTSPOTS } from "#/config/scene";
import {
	DEBUG_OVERLAY_Z,
	polygonCentroid,
	toViewBoxPoints,
	VIEWBOX_HEIGHT,
	VIEWBOX_WIDTH,
} from "./geometry";

/**
 * Development tool for nudging polygon coordinates until they match the
 * drawn shapes. Mounted only when the debug search param is on, so it has
 * zero effect on the normal render path.
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
			{SCENE_HOTSPOTS.map((hotspot) => {
				const [centroidX, centroidY] = polygonCentroid(hotspot.polygon);
				return (
					<g key={hotspot.id}>
						<polygon
							points={toViewBoxPoints(hotspot.polygon)}
							fill={hotspot.placeholderColor}
							fillOpacity={0.12}
							stroke={hotspot.placeholderColor}
							strokeWidth={2}
							strokeOpacity={hoveredId === hotspot.id ? 1 : 0.5}
						/>
						{/* Undistorted only because the viewBox matches the 2:1
						    container; preserveAspectRatio="none" shears text if
						    the aspect ratio ever changes. */}
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
		</svg>
	);
}
