import { useNavigate } from "@tanstack/react-router";
import type { Hotspot, HotspotId } from "#/config/scene";
import {
	SCENE_ASPECT_RATIO,
	SCENE_BACKGROUND_IMAGE,
	SCENE_HOTSPOTS,
} from "#/config/scene";
import { cn } from "#/lib/utils.ts";
import { useImageLoad } from "./use-image-load";

const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = VIEWBOX_WIDTH / SCENE_ASPECT_RATIO;

/** Overlays must sit above every art layer, whatever the config says. */
const HIT_OVERLAY_Z =
	Math.max(...SCENE_HOTSPOTS.map((hotspot) => hotspot.zIndex)) + 10;
const DEBUG_OVERLAY_Z = HIT_OVERLAY_Z + 10;

function toViewBoxPoints(polygon: Hotspot["polygon"]): string {
	return polygon
		.map(([x, y]) => `${x * VIEWBOX_WIDTH},${y * VIEWBOX_HEIGHT}`)
		.join(" ");
}

/** Vertex average; good enough for the small convex hotspot polygons. */
function polygonCentroid(polygon: Hotspot["polygon"]): [number, number] {
	let sumX = 0;
	let sumY = 0;
	for (const [x, y] of polygon) {
		sumX += x;
		sumY += y;
	}
	return [sumX / polygon.length, sumY / polygon.length];
}

export interface SceneProps {
	hoveredId: HotspotId | null;
	onHoverChange: (id: HotspotId | null) => void;
	debug: boolean;
}

/**
 * The desktop scene. Purely visual: keyboard and assistive-technology
 * access to the sections is provided exclusively by SectionNav, so the
 * whole canvas is aria-hidden and the hit polygons are pointer-only.
 */
export function Scene({ hoveredId, onHoverChange, debug }: SceneProps) {
	const navigate = useNavigate();

	return (
		<div aria-hidden="true" className="relative h-full w-full">
			<BackgroundPlate />
			{SCENE_HOTSPOTS.map((hotspot) => (
				<SceneLayer
					key={hotspot.id}
					hotspot={hotspot}
					lifted={hoveredId === hotspot.id}
				/>
			))}
			<svg
				viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
				preserveAspectRatio="none"
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 h-full w-full"
				style={{ zIndex: HIT_OVERLAY_Z }}
			>
				{SCENE_HOTSPOTS.map((hotspot) => (
					// biome-ignore lint/a11y/noStaticElementInteractions: pointer-only hit target inside an aria-hidden svg; SectionNav provides the accessible keyboard link for this section
					<polygon
						key={hotspot.id}
						points={toViewBoxPoints(hotspot.polygon)}
						fill="transparent"
						pointerEvents="all"
						className="cursor-pointer"
						onPointerEnter={() => onHoverChange(hotspot.id)}
						onPointerLeave={() => onHoverChange(null)}
						onClick={() => {
							void navigate({ to: hotspot.route });
						}}
					/>
				))}
			</svg>
			{debug ? <DebugOverlay hoveredId={hoveredId} /> : null}
		</div>
	);
}

function BackgroundPlate() {
	const image = useImageLoad();

	return (
		<div className="absolute inset-0 bg-neutral-200">
			<img
				ref={image.ref}
				src={SCENE_BACKGROUND_IMAGE}
				alt=""
				draggable={false}
				onLoad={image.onLoad}
				onError={image.onError}
				className={cn(
					"h-full w-full object-cover",
					image.status !== "loaded" && "opacity-0",
				)}
			/>
		</div>
	);
}

function SceneLayer({
	hotspot,
	lifted,
}: {
	hotspot: Hotspot;
	lifted: boolean;
}) {
	const image = useImageLoad();

	return (
		<div
			className={cn(
				"absolute motion-safe:transition-[transform,filter] motion-safe:duration-200",
				lifted && "drop-shadow-md motion-safe:-translate-y-1.5",
			)}
			style={{
				left: `${hotspot.layer.x * 100}%`,
				top: `${hotspot.layer.y * 100}%`,
				width: `${hotspot.layer.width * 100}%`,
				height: `${hotspot.layer.height * 100}%`,
				zIndex: hotspot.zIndex,
			}}
		>
			{image.status !== "loaded" ? (
				<div
					className="absolute inset-0 flex items-center justify-center text-xs text-neutral-700"
					style={{
						border: `1px solid ${hotspot.placeholderColor}`,
						backgroundColor: `${hotspot.placeholderColor}22`,
					}}
				>
					{hotspot.label}
				</div>
			) : null}
			<img
				ref={image.ref}
				src={hotspot.image}
				alt=""
				draggable={false}
				onLoad={image.onLoad}
				onError={image.onError}
				className={cn(
					"absolute inset-0 h-full w-full object-contain",
					image.status !== "loaded" && "opacity-0",
				)}
			/>
			{lifted ? (
				<span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-neutral-800 px-2 py-0.5 text-xs whitespace-nowrap text-white">
					{hotspot.label}
				</span>
			) : null}
		</div>
	);
}

/**
 * Development tool for nudging polygon coordinates until they match the
 * drawn shapes. Mounted only when the debug search param is on, so it has
 * zero effect on the normal render path.
 */
function DebugOverlay({ hoveredId }: { hoveredId: HotspotId | null }) {
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
