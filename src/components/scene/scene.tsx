import { useNavigate } from "@tanstack/react-router";
import type { HotspotId, SceneLayer } from "#/config/scene";
import { SCENE_HOTSPOTS, SCENE_LAYERS } from "#/config/scene";
import { cn } from "#/lib/utils.ts";
import { DebugOverlay } from "./debug-overlay";
import {
	HIT_OVERLAY_Z,
	toViewBoxPoints,
	VIEWBOX_HEIGHT,
	VIEWBOX_WIDTH,
} from "./geometry";
import { useImageLoad } from "./use-image-load";

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
		<div aria-hidden="true" className="relative h-full w-full bg-neutral-200">
			{/* Paint order comes from each layer's zIndex, not array order. */}
			{SCENE_LAYERS.map((layer) => (
				<ArtLayer
					key={layer.id}
					layer={layer}
					lifted={layer.kind === "hotspot" && hoveredId === layer.id}
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

function ArtLayer({ layer, lifted }: { layer: SceneLayer; lifted: boolean }) {
	const image = useImageLoad();
	const label = layer.kind === "hotspot" ? layer.label : layer.id;

	return (
		<div
			className={cn(
				"absolute motion-safe:transition-[transform,filter] motion-safe:duration-200",
				lifted && "drop-shadow-md motion-safe:-translate-y-1.5",
			)}
			style={{
				left: `${layer.box.x * 100}%`,
				top: `${layer.box.y * 100}%`,
				width: `${layer.box.width * 100}%`,
				height: `${layer.box.height * 100}%`,
				zIndex: layer.zIndex,
			}}
		>
			{image.status !== "loaded" ? (
				<div
					className="absolute inset-0 flex items-center justify-center text-xs text-neutral-700"
					style={{
						border: `1px solid ${layer.placeholderColor}`,
						backgroundColor: `${layer.placeholderColor}22`,
					}}
				>
					{label}
				</div>
			) : null}
			<img
				ref={image.ref}
				src={layer.image}
				alt=""
				draggable={false}
				onLoad={image.onLoad}
				onError={image.onError}
				className={cn(
					"absolute inset-0 h-full w-full object-contain",
					image.status !== "loaded" && "opacity-0",
				)}
			/>
			{layer.kind === "hotspot" && lifted ? (
				<span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-neutral-800 px-2 py-0.5 text-xs whitespace-nowrap text-white">
					{layer.label}
				</span>
			) : null}
		</div>
	);
}
