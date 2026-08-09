import { useNavigate } from "@tanstack/react-router";
import type { CSSProperties } from "react";
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

export interface SceneProps {
	hoveredId: HotspotId | null;
	onHoverChange: (id: HotspotId | null) => void;
	debug: boolean;
}

/**
 * The desktop scene. Purely visual: keyboard and assistive-technology
 * access to the sections is provided exclusively by SectionNav, so the
 * whole canvas is aria-hidden and the hit polygons are pointer-only.
 * No background of its own: the scene sits directly on the page field.
 *
 * Rendered on the server and below md alike, and hidden by CSS rather than
 * by JS: nothing here reads the viewport, so the markup is identical on
 * both sides of hydration. Which variant is visible — and which art is
 * fetched — is decided entirely by the media queries in styles.css.
 */
export function Scene({ hoveredId, onHoverChange, debug }: SceneProps) {
	const navigate = useNavigate();

	return (
		<div aria-hidden="true" className="relative hidden h-full w-full md:block">
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
				{/* Sorted by zIndex: SVG hit-testing favors later document order,
				    so without this the nav-ordered list lets a lower layer's
				    polygon capture the pointer where it overlaps a higher one
				    (the paper's corner stealing hovers from the phone on top
				    of it). */}
				{[...SCENE_HOTSPOTS]
					.sort((a, b) => a.zIndex - b.zIndex)
					.map((hotspot) => (
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

/**
 * A layer is an empty box wearing its art as a background image, applied by
 * the `[data-scene-layer]` rule in styles.css. Two things follow, and both
 * are the point:
 *
 * The box paints nothing of its own before the art arrives — no fill, no
 * placeholder, no `background-color`. Anything drawn underneath a background
 * that has not decoded yet is exactly the flash this indirection removes, so
 * the empty box is load-bearing.
 *
 * And the fetch is the rule's, not the element's. `--layer-image` is an
 * unresolved token until something substitutes it, so below md — where the
 * rule does not apply — the URL is never resolved and the art is never
 * requested, however the element is laid out.
 *
 * The cost is `onLoad`/`onError`: there is no load event to hang a fallback
 * on. `placeholderColor` survives for the debug overlay and the calibration
 * tool, which are the only places it was ever doing real work.
 */
function ArtLayer({ layer, lifted }: { layer: SceneLayer; lifted: boolean }) {
	return (
		<div
			data-scene-layer=""
			className={cn(
				"absolute motion-safe:transition-[transform,filter] motion-safe:duration-200",
				// drop-shadow reads the rendered alpha, so a background cutout
				// throws the same silhouette an <img> did.
				lifted && "drop-shadow-md motion-safe:-translate-y-1.5",
			)}
			style={
				{
					left: `${layer.box.x * 100}%`,
					top: `${layer.box.y * 100}%`,
					width: `${layer.box.width * 100}%`,
					height: `${layer.box.height * 100}%`,
					zIndex: layer.zIndex,
					// Quoted so a path is still a single token if one ever
					// picks up a space or a paren; React escapes the quote
					// either way, so the choice costs nothing.
					"--layer-image": `url('${layer.image}')`,
				} as CSSProperties
			}
		>
			{layer.kind === "hotspot" && lifted ? (
				<span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-foreground px-2 py-0.5 text-xs whitespace-nowrap text-background">
					{layer.label}
				</span>
			) : null}
		</div>
	);
}
