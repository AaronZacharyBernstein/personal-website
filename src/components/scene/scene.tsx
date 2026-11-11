import { useNavigate, useRouter } from "@tanstack/react-router";
import { type CSSProperties, useRef } from "react";
import type { HotspotId, HotspotLayer, SceneLayer } from "#/config/scene";
import {
	SCENE_BOARD_ID,
	SCENE_HOTSPOTS,
	SCENE_HOVER_SWING,
	SCENE_LAYERS,
	SCENE_SHADOWS,
} from "#/config/scene";
import {
	layerPivot,
	layerPolygonInScene,
	SCENE_TACKS,
	shadowFilter,
	type TackLayer,
} from "#/config/scene-geometry";
import { cn } from "#/lib/utils.ts";
import { DebugOverlay } from "./debug-overlay";
import {
	HIT_OVERLAY_Z,
	LABEL_Z,
	toViewBoxPoints,
	VIEWBOX_HEIGHT,
	VIEWBOX_WIDTH,
} from "./geometry";
import { useIntro } from "./intro";

export interface SceneProps {
	hoveredId: HotspotId | null;
	onHoverChange: (id: HotspotId | null) => void;
	debug: boolean;
}

/**
 * Config-derived values the stylesheet reads. Custom properties rather than
 * classes because they come from tunables in src/config; inherited, so one
 * declaration on the stage reaches every layer. On the stage and no higher:
 * the shadows are written in terms of --stage-w, which the stylesheet
 * declares on this same element, and a custom property is resolved where it
 * is declared.
 */
const SCENE_VARIABLES = {
	"--scene-shadow": shadowFilter(SCENE_SHADOWS.rest),
	"--scene-shadow-hover": shadowFilter(SCENE_SHADOWS.hover),
	"--scene-swing": `${SCENE_HOVER_SWING}deg`,
} as CSSProperties;

/** Where each hotspot's hover label hangs: centred, just above item and tack. */
const LABEL_ANCHORS = new Map(
	SCENE_HOTSPOTS.map((hotspot) => {
		const points = layerPolygonInScene(hotspot);
		const xs = points.map(([x]) => x);
		const tack = SCENE_TACKS.find((entry) => entry.ownerId === hotspot.id);
		const top = Math.min(
			...points.map(([, y]) => y),
			tack ? tack.box.y : Number.POSITIVE_INFINITY,
		);
		return [
			hotspot.id,
			{ x: (Math.min(...xs) + Math.max(...xs)) / 2, y: top },
		] as const;
	}),
);

function boxStyle(box: SceneLayer["box"], zIndex: number): CSSProperties {
	return {
		left: `${box.x * 100}%`,
		top: `${box.y * 100}%`,
		width: `${box.width * 100}%`,
		height: `${box.height * 100}%`,
		zIndex,
	};
}

/**
 * Quoted so a path is still a single token if one ever picks up a space or a
 * paren; React escapes the quote either way, so the choice costs nothing.
 */
function layerImage(image: string): CSSProperties {
	return { "--layer-image": `url('${image}')` } as CSSProperties;
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
 * fetched — is decided entirely by the media queries in styles.css. The
 * intro is the same story: it is armed by a class the head script puts on
 * <html> and driven by CSS and a post-hydration effect, never by what this
 * component renders.
 *
 * At md and up this element is the STAGE: the composition's own scene box,
 * with the aspect ratio the layout was drawn in, sized and centred on the
 * cork by the `[data-scene-stage]` rules in styles.css. The board itself —
 * frame, cork, inner shadow — is drawn behind it by the layout. Every layer
 * is placed in the stage by percentages, exactly as when the stage was the
 * whole board; only the team pins are then carried to the cork's corner.
 */
export function Scene({ hoveredId, onHoverChange, debug }: SceneProps) {
	const navigate = useNavigate();
	const router = useRouter();
	const rootRef = useRef<HTMLDivElement | null>(null);
	useIntro(rootRef);

	const activate = (hotspot: HotspotLayer) => {
		if (hotspot.route !== undefined) {
			void navigate({ to: hotspot.route });
		} else {
			window.open(hotspot.href, "_blank", "noopener,noreferrer");
		}
	};

	const hovered = SCENE_HOTSPOTS.find((hotspot) => hotspot.id === hoveredId);
	const anchor = hovered ? LABEL_ANCHORS.get(hovered.id) : undefined;

	return (
		<div
			ref={rootRef}
			aria-hidden="true"
			data-scene-stage=""
			className="hidden md:block"
			style={SCENE_VARIABLES}
		>
			{/* Paint order comes from each layer's zIndex, not array order. */}
			{/* The board layer is not drawn here: on desktop the board is the
			    frame and cork behind the stage. It stays in SCENE_LAYERS for
			    the flat mobile image and the calibration tool. */}
			{SCENE_LAYERS.filter((layer) => layer.id !== SCENE_BOARD_ID).map(
				(layer) => (
					<ItemLayer
						key={layer.id}
						layer={layer}
						lifted={layer.kind === "hotspot" && hoveredId === layer.id}
					/>
				),
			)}
			{SCENE_TACKS.map((tack) => (
				<TackArt key={tack.id} tack={tack} />
			))}
			{hovered && anchor ? (
				// One label for the whole scene, above every layer: inside its
				// item it would turn with the art, wear the item's shadow, and
				// slide under a neighbour's tack.
				<span
					data-scene-label=""
					className="pointer-events-none absolute -translate-x-1/2 -translate-y-[calc(100%+0.375rem)] rounded bg-foreground px-2 py-0.5 text-xs whitespace-nowrap text-background"
					style={{
						left: `${anchor.x * 100}%`,
						top: `${anchor.y * 100}%`,
						zIndex: LABEL_Z,
					}}
				>
					{hovered.label}
				</span>
			) : null}
			<svg
				viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
				preserveAspectRatio="none"
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 h-full w-full"
				style={{ zIndex: HIT_OVERLAY_Z }}
			>
				{/* Sorted by zIndex: SVG hit-testing favors later document order,
				    so without this the nav-ordered list lets a lower item's
				    polygon capture the pointer where a higher one overlaps it.
				    Only hotspots get a polygon. Tacks and decorations have none
				    and take no pointer events, so a click on a tack lands on
				    the item it is holding. */}
				{[...SCENE_HOTSPOTS]
					.sort((a, b) => a.zIndex - b.zIndex)
					.map((hotspot) => (
						// biome-ignore lint/a11y/noStaticElementInteractions: pointer-only hit target inside an aria-hidden svg; SectionNav provides the accessible keyboard link for this section
						<polygon
							key={hotspot.id}
							points={toViewBoxPoints(layerPolygonInScene(hotspot))}
							fill="transparent"
							pointerEvents="all"
							className="cursor-pointer"
							onPointerEnter={() => {
								onHoverChange(hotspot.id);
								// The nav's links preload on intent; give the board
								// the same head start on a section's code and data.
								if (hotspot.route !== undefined) {
									void router
										.preloadRoute({ to: hotspot.route })
										.catch(() => undefined);
								}
							}}
							onPointerLeave={() => onHoverChange(null)}
							onClick={() => activate(hotspot)}
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
 * An item is three such boxes, each with one job, so that its shadow, its
 * rotation and the intro never write to the same property:
 *
 *   the outer box places it (left/top/width/height from config);
 *
 *   the middle box throws the shadow. It is never rotated, so every shadow
 *   on the board falls the same way — down and to the right — whatever
 *   angle the item hangs at. It is also the only element the intro
 *   animates, and React gives it no inline style for GSAP to trample;
 *
 *   the inner box wears the art and turns: the configured rotation plus the
 *   hover swing, both about the tack point, as a pinned sheet would.
 *
 * The hover changes are `motion-safe:` throughout: with reduced motion an
 * item neither swings nor lifts.
 */
function ItemLayer({ layer, lifted }: { layer: SceneLayer; lifted: boolean }) {
	const [pivotX, pivotY] = layerPivot(layer);
	return (
		<div
			// Anchored layers (the team pins) are carried from here to a corner
			// of the cork by a transform on this outer box — see styles.css.
			// The shadow, the rotation and the intro all live on the boxes
			// inside it, so none of them has to know.
			data-scene-anchor={layer.anchor}
			className="pointer-events-none absolute"
			style={boxStyle(layer.box, layer.zIndex)}
		>
			<div
				data-scene-shadow=""
				data-intro="item"
				data-intro-id={layer.id}
				className={cn(
					"h-full w-full motion-safe:transition-[filter] motion-safe:duration-300",
					lifted &&
						"motion-safe:[--scene-shadow-now:var(--scene-shadow-hover)]",
				)}
			>
				<div
					data-scene-layer=""
					data-scene-art=""
					className={cn(
						"h-full w-full motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.34,1.4,0.64,1)]",
						lifted && "motion-safe:[--scene-swing-now:var(--scene-swing)]",
					)}
					style={
						{
							...layerImage(layer.image),
							"--scene-rotation": `${layer.rotation ?? 0}deg`,
							transformOrigin: `${pivotX * 100}% ${pivotY * 100}%`,
						} as CSSProperties
					}
				/>
			</div>
		</div>
	);
}

/**
 * A thumbtack: its own layer, one step above the item it holds, and a
 * sibling of it rather than a child — so it stays put while the item swings
 * and is never rotated (its highlight is baked into the upper left to match
 * the board's light). Decorative only: no polygon, no pointer events.
 */
function TackArt({ tack }: { tack: TackLayer }) {
	return (
		<div
			className="pointer-events-none absolute"
			style={boxStyle(tack.box, tack.zIndex)}
		>
			<div
				data-scene-layer=""
				data-scene-shadow=""
				data-intro="tack"
				data-intro-id={tack.ownerId}
				className="h-full w-full"
				style={layerImage(tack.image)}
			/>
		</div>
	);
}
