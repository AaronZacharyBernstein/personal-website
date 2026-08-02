import {
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import type { SceneLayer } from "#/config/scene";
import {
	SCENE_ASPECT_RATIO,
	SCENE_LAYERS,
	SCENE_MAX_WIDTH,
} from "#/config/scene";
import { cn } from "#/lib/utils.ts";
import { toViewBoxPoints, VIEWBOX_HEIGHT, VIEWBOX_WIDTH } from "../geometry";
import { serializeSceneLayers } from "./serialize";

type Box = SceneLayer["box"];
type Corner = "nw" | "ne" | "sw" | "se";

type DragState =
	| {
			type: "move";
			id: string;
			startX: number;
			startY: number;
			rectWidth: number;
			rectHeight: number;
			startBox: Box;
	  }
	| {
			type: "resize";
			id: string;
			corner: Corner;
			startX: number;
			startY: number;
			rectWidth: number;
			rectHeight: number;
			startBox: Box;
	  }
	| {
			type: "vertex";
			id: string;
			index: number;
			startX: number;
			startY: number;
			rectWidth: number;
			rectHeight: number;
			startVertex: [number, number];
	  };

const MIN_BOX_SIZE = 0.01;
const MIN_POLYGON_VERTICES = 3;

const ARROW_DELTAS = new Map<string, readonly [number, number]>([
	["ArrowLeft", [-1, 0]],
	["ArrowRight", [1, 0]],
	["ArrowUp", [0, -1]],
	["ArrowDown", [0, 1]],
]);

const CORNER_CURSORS: Record<Corner, string> = {
	nw: "nwse-resize",
	se: "nwse-resize",
	ne: "nesw-resize",
	sw: "nesw-resize",
};

function cloneLayers(layers: ReadonlyArray<SceneLayer>): SceneLayer[] {
	return layers.map((layer) =>
		layer.kind === "hotspot"
			? {
					...layer,
					box: { ...layer.box },
					polygon: layer.polygon.map(([x, y]) => [x, y] as [number, number]),
				}
			: { ...layer, box: { ...layer.box } },
	);
}

function applyResize(
	startBox: Box,
	corner: Corner,
	dx: number,
	dy: number,
): Box {
	let { x, y, width, height } = startBox;
	if (corner === "ne" || corner === "se") {
		width = startBox.width + dx;
	}
	if (corner === "nw" || corner === "sw") {
		x = startBox.x + dx;
		width = startBox.width - dx;
	}
	if (corner === "sw" || corner === "se") {
		height = startBox.height + dy;
	}
	if (corner === "nw" || corner === "ne") {
		y = startBox.y + dy;
		height = startBox.height - dy;
	}
	if (width < MIN_BOX_SIZE) {
		if (corner === "nw" || corner === "sw") {
			x = startBox.x + startBox.width - MIN_BOX_SIZE;
		}
		width = MIN_BOX_SIZE;
	}
	if (height < MIN_BOX_SIZE) {
		if (corner === "nw" || corner === "ne") {
			y = startBox.y + startBox.height - MIN_BOX_SIZE;
		}
		height = MIN_BOX_SIZE;
	}
	return { x, y, width, height };
}

/**
 * Dev-only scene editor, mounted only when the calibrate search param is
 * on (lazy-loaded, so this module never executes on a normal page load).
 * All state is component-local; the only output path is copy/paste of the
 * serialized SCENE_LAYERS array into src/config/scene.ts.
 */
export default function CalibrationTool({ debug }: { debug: boolean }) {
	const [layers, setLayers] = useState<SceneLayer[]>(() =>
		cloneLayers(SCENE_LAYERS),
	);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [selectedVertex, setSelectedVertex] = useState<number | null>(null);
	const [opacities, setOpacities] = useState<Record<string, number>>({});
	const [hideArt, setHideArt] = useState(false);
	const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
		"idle",
	);
	const canvasRef = useRef<HTMLDivElement | null>(null);
	const dragRef = useRef<DragState | null>(null);

	const selected = layers.find((layer) => layer.id === selectedId) ?? null;
	const chromeZ = Math.max(...layers.map((layer) => layer.zIndex)) + 30;
	const stacked = [...layers].sort((a, b) => b.zIndex - a.zIndex);
	const code = serializeSceneLayers(layers);

	const updateBox = (id: string, box: Box) => {
		setLayers((prev) =>
			prev.map((layer) => (layer.id === id ? { ...layer, box } : layer)),
		);
	};

	const updateVertex = (
		id: string,
		index: number,
		vertex: [number, number],
	) => {
		setLayers((prev) =>
			prev.map((layer) =>
				layer.id === id && layer.kind === "hotspot"
					? {
							...layer,
							polygon: layer.polygon.map((point, i) =>
								i === index ? vertex : point,
							),
						}
					: layer,
			),
		);
	};

	// Arrow-key nudging and vertex deletion. A window listener (scoped to
	// this mount) rather than focus juggling, so it works right after any
	// pointer interaction; typing in the panel's inputs is exempted.
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.ctrlKey || event.metaKey || event.altKey) {
				return;
			}
			// Nudge only when the canvas is the effective focus target. Canvas
			// children are not focusable, so pointer work leaves focus on body;
			// nav links and panel buttons keep their own arrow-key semantics.
			const target = event.target;
			if (
				target !== document.body &&
				!(target instanceof Node && canvasRef.current?.contains(target))
			) {
				return;
			}
			if (selectedId === null) {
				return;
			}
			const arrow = ARROW_DELTAS.get(event.key);
			if (arrow) {
				event.preventDefault();
				const step = event.shiftKey ? 0.01 : 0.001;
				const [dx, dy] = arrow;
				setLayers((prev) =>
					prev.map((layer) => {
						if (layer.id !== selectedId) {
							return layer;
						}
						if (
							selectedVertex !== null &&
							layer.kind === "hotspot" &&
							selectedVertex < layer.polygon.length
						) {
							return {
								...layer,
								polygon: layer.polygon.map((point, i) =>
									i === selectedVertex
										? ([point[0] + dx * step, point[1] + dy * step] as [
												number,
												number,
											])
										: point,
								),
							};
						}
						return {
							...layer,
							box: {
								...layer.box,
								x: layer.box.x + dx * step,
								y: layer.box.y + dy * step,
							},
						};
					}),
				);
				return;
			}
			if (
				(event.key === "Delete" || event.key === "Backspace") &&
				selectedVertex !== null
			) {
				event.preventDefault();
				// Kill any in-flight drag: after the splice, its captured index
				// would point at the successor vertex and teleport it.
				dragRef.current = null;
				setLayers((prev) =>
					prev.map((layer) =>
						layer.id === selectedId &&
						layer.kind === "hotspot" &&
						layer.polygon.length > MIN_POLYGON_VERTICES
							? {
									...layer,
									polygon: layer.polygon.filter((_, i) => i !== selectedVertex),
								}
							: layer,
					),
				);
				setSelectedVertex(null);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [selectedId, selectedVertex]);

	const canvasRect = () => canvasRef.current?.getBoundingClientRect() ?? null;

	// pointerdown handlers call preventDefault (to stop text selection),
	// which also suppresses the browser's default focus change — so a
	// previously focused nav link or button would keep receiving arrow
	// keys. Drop focus to body so the keydown guard sees canvas intent.
	const dropFocusToBody = () => {
		if (document.activeElement instanceof HTMLElement) {
			document.activeElement.blur();
		}
	};

	const beginMove = (event: ReactPointerEvent, layer: SceneLayer) => {
		event.preventDefault();
		dropFocusToBody();
		setSelectedId(layer.id);
		setSelectedVertex(null);
		const rect = canvasRect();
		if (!rect) {
			return;
		}
		dragRef.current = {
			type: "move",
			id: layer.id,
			startX: event.clientX,
			startY: event.clientY,
			rectWidth: rect.width,
			rectHeight: rect.height,
			startBox: { ...layer.box },
		};
		event.currentTarget.setPointerCapture(event.pointerId);
	};

	const beginResize = (event: ReactPointerEvent, corner: Corner) => {
		if (!selected) {
			return;
		}
		event.preventDefault();
		dropFocusToBody();
		const rect = canvasRect();
		if (!rect) {
			return;
		}
		dragRef.current = {
			type: "resize",
			id: selected.id,
			corner,
			startX: event.clientX,
			startY: event.clientY,
			rectWidth: rect.width,
			rectHeight: rect.height,
			startBox: { ...selected.box },
		};
		event.currentTarget.setPointerCapture(event.pointerId);
	};

	const beginVertexDrag = (
		event: ReactPointerEvent,
		layerId: string,
		index: number,
		vertex: [number, number],
	) => {
		event.preventDefault();
		dropFocusToBody();
		setSelectedVertex(index);
		const rect = canvasRect();
		if (!rect) {
			return;
		}
		dragRef.current = {
			type: "vertex",
			id: layerId,
			index,
			startX: event.clientX,
			startY: event.clientY,
			rectWidth: rect.width,
			rectHeight: rect.height,
			startVertex: vertex,
		};
		event.currentTarget.setPointerCapture(event.pointerId);
	};

	const onDragMove = (event: ReactPointerEvent) => {
		const drag = dragRef.current;
		if (!drag) {
			return;
		}
		const dx = (event.clientX - drag.startX) / drag.rectWidth;
		const dy = (event.clientY - drag.startY) / drag.rectHeight;
		if (drag.type === "move") {
			updateBox(drag.id, {
				...drag.startBox,
				x: drag.startBox.x + dx,
				y: drag.startBox.y + dy,
			});
		} else if (drag.type === "resize") {
			updateBox(drag.id, applyResize(drag.startBox, drag.corner, dx, dy));
		} else {
			updateVertex(drag.id, drag.index, [
				drag.startVertex[0] + dx,
				drag.startVertex[1] + dy,
			]);
		}
	};

	const endDrag = () => {
		dragRef.current = null;
	};

	const insertVertex = (layerId: string, afterIndex: number) => {
		setLayers((prev) =>
			prev.map((layer) => {
				if (layer.id !== layerId || layer.kind !== "hotspot") {
					return layer;
				}
				const a = layer.polygon[afterIndex];
				const b = layer.polygon[(afterIndex + 1) % layer.polygon.length];
				const midpoint: [number, number] = [
					(a[0] + b[0]) / 2,
					(a[1] + b[1]) / 2,
				];
				const polygon = [...layer.polygon];
				polygon.splice(afterIndex + 1, 0, midpoint);
				return { ...layer, polygon };
			}),
		);
		setSelectedVertex(afterIndex + 1);
	};

	const moveInStack = (id: string, direction: 1 | -1) => {
		setLayers((prev) => {
			const sorted = [...prev].sort((a, b) => a.zIndex - b.zIndex);
			const index = sorted.findIndex((layer) => layer.id === id);
			const neighbor = sorted[index + direction];
			if (index === -1 || !neighbor) {
				return prev;
			}
			const current = sorted[index];
			return prev.map((layer) => {
				if (layer.id === current.id) {
					return { ...layer, zIndex: neighbor.zIndex };
				}
				if (layer.id === neighbor.id) {
					return { ...layer, zIndex: current.zIndex };
				}
				return layer;
			});
		});
	};

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(code);
			setCopyStatus("copied");
		} catch {
			setCopyStatus("failed");
		}
		window.setTimeout(() => setCopyStatus("idle"), 2000);
	};

	return (
		<div className="flex w-full flex-col items-center gap-4">
			{/* Canvas */}
			<div
				ref={canvasRef}
				aria-hidden="true"
				className="relative w-full touch-none select-none rounded-lg border border-neutral-400 bg-neutral-200"
				style={{
					maxWidth: SCENE_MAX_WIDTH,
					aspectRatio: `${SCENE_ASPECT_RATIO} / 1`,
				}}
				onPointerDown={(event) => {
					if (event.target === event.currentTarget) {
						setSelectedId(null);
						setSelectedVertex(null);
					}
				}}
			>
				{layers.map((layer) => (
					<div
						key={layer.id}
						className={cn(
							"absolute cursor-move",
							selectedId === layer.id
								? "outline-2 outline-solid"
								: "outline-1 outline-dashed",
						)}
						style={{
							left: `${layer.box.x * 100}%`,
							top: `${layer.box.y * 100}%`,
							width: `${layer.box.width * 100}%`,
							height: `${layer.box.height * 100}%`,
							zIndex: layer.zIndex,
							outlineColor: layer.placeholderColor,
						}}
						onPointerDown={(event) => beginMove(event, layer)}
						onPointerMove={onDragMove}
						onPointerUp={endDrag}
						onLostPointerCapture={endDrag}
					>
						<img
							src={layer.image}
							alt=""
							draggable={false}
							className="pointer-events-none h-full w-full object-contain"
							style={{
								opacity: hideArt ? 0 : (opacities[layer.id] ?? 100) / 100,
							}}
						/>
						<span
							className="pointer-events-none absolute top-0 left-0 px-1 font-mono text-[10px] text-white"
							style={{ backgroundColor: layer.placeholderColor }}
						>
							{layer.id}
						</span>
					</div>
				))}

				{/* Selection chrome: polygons + handles, always above every layer */}
				<svg
					viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
					preserveAspectRatio="none"
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 h-full w-full"
					style={{ zIndex: chromeZ }}
				>
					{debug
						? layers.map((layer) =>
								layer.kind === "hotspot" ? (
									<polygon
										key={layer.id}
										points={toViewBoxPoints(layer.polygon)}
										fill={layer.placeholderColor}
										fillOpacity={0.08}
										stroke={layer.placeholderColor}
										strokeWidth={1.5}
										strokeOpacity={0.5}
									/>
								) : null,
							)
						: null}
					{selected?.kind === "hotspot" ? (
						<>
							<polygon
								points={toViewBoxPoints(selected.polygon)}
								fill={selected.placeholderColor}
								fillOpacity={0.15}
								stroke={selected.placeholderColor}
								strokeWidth={2}
							/>
							{selected.polygon.map(([x, y], index) => {
								const next =
									selected.polygon[(index + 1) % selected.polygon.length];
								const midX = ((x + next[0]) / 2) * VIEWBOX_WIDTH;
								const midY = ((y + next[1]) / 2) * VIEWBOX_HEIGHT;
								return (
									<circle
										key={`mid-${selected.id}-${index}`}
										cx={midX}
										cy={midY}
										r={5}
										fill="white"
										stroke={selected.placeholderColor}
										strokeWidth={1.5}
										pointerEvents="all"
										className="cursor-copy"
										onPointerDown={(event) => {
											event.preventDefault();
											dropFocusToBody();
											insertVertex(selected.id, index);
										}}
									/>
								);
							})}
							{selected.polygon.map(([x, y], index) => (
								<circle
									key={`vertex-${selected.id}-${index}`}
									cx={x * VIEWBOX_WIDTH}
									cy={y * VIEWBOX_HEIGHT}
									r={7}
									fill={
										selectedVertex === index
											? "white"
											: selected.placeholderColor
									}
									stroke={
										selectedVertex === index
											? selected.placeholderColor
											: "white"
									}
									strokeWidth={2}
									pointerEvents="all"
									className="cursor-move"
									onPointerDown={(event) =>
										beginVertexDrag(event, selected.id, index, [x, y])
									}
									onPointerMove={onDragMove}
									onPointerUp={endDrag}
									onLostPointerCapture={endDrag}
								/>
							))}
						</>
					) : null}
				</svg>
				{selected
					? (["nw", "ne", "sw", "se"] as const).map((corner) => (
							<div
								key={corner}
								className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 border border-white bg-neutral-800"
								style={{
									left: `${(selected.box.x + (corner === "ne" || corner === "se" ? selected.box.width : 0)) * 100}%`,
									top: `${(selected.box.y + (corner === "sw" || corner === "se" ? selected.box.height : 0)) * 100}%`,
									cursor: CORNER_CURSORS[corner],
									zIndex: chromeZ + 1,
								}}
								onPointerDown={(event) => beginResize(event, corner)}
								onPointerMove={onDragMove}
								onPointerUp={endDrag}
								onLostPointerCapture={endDrag}
							/>
						))
					: null}
			</div>

			{/* Panel */}
			<div
				className="w-full rounded-lg border border-neutral-300 p-4 text-sm text-neutral-800"
				style={{ maxWidth: SCENE_MAX_WIDTH }}
			>
				<div className="flex flex-wrap items-center gap-4">
					<span className="font-semibold">Calibration</span>
					<button
						type="button"
						onClick={handleCopy}
						className="rounded-md border border-neutral-400 bg-neutral-100 px-3 py-1 hover:bg-neutral-200 focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:outline-none"
					>
						Copy SCENE_LAYERS to clipboard
					</button>
					{copyStatus === "copied" ? (
						<span className="text-neutral-600">Copied.</span>
					) : null}
					{copyStatus === "failed" ? (
						<span className="text-neutral-600">
							Clipboard blocked — copy from the block below.
						</span>
					) : null}
					<label className="ml-auto flex items-center gap-2">
						<input
							type="checkbox"
							checked={hideArt}
							onChange={(event) => setHideArt(event.target.checked)}
						/>
						Hide all art
					</label>
				</div>

				<ul className="mt-3 flex flex-col gap-1">
					{stacked.map((layer, index) => (
						<li
							key={layer.id}
							className={cn(
								"flex items-center gap-2 rounded-md px-2 py-1",
								selectedId === layer.id && "bg-neutral-200",
							)}
						>
							<button
								type="button"
								aria-label={`Raise ${layer.id}`}
								disabled={index === 0}
								onClick={() => moveInStack(layer.id, 1)}
								className="rounded border border-neutral-400 px-1.5 disabled:opacity-30"
							>
								▲
							</button>
							<button
								type="button"
								aria-label={`Lower ${layer.id}`}
								disabled={index === stacked.length - 1}
								onClick={() => moveInStack(layer.id, -1)}
								className="rounded border border-neutral-400 px-1.5 disabled:opacity-30"
							>
								▼
							</button>
							<button
								type="button"
								onClick={() => {
									setSelectedId(layer.id);
									setSelectedVertex(null);
								}}
								className="flex-1 text-left font-mono"
							>
								<span
									className="mr-2 inline-block h-2.5 w-2.5"
									style={{ backgroundColor: layer.placeholderColor }}
								/>
								{layer.id}
								<span className="ml-2 text-neutral-500">
									{layer.kind} · z={layer.zIndex}
								</span>
							</button>
							<label className="flex items-center gap-1 text-neutral-600">
								opacity
								<input
									type="range"
									min={0}
									max={100}
									value={opacities[layer.id] ?? 100}
									onChange={(event) =>
										setOpacities((prev) => ({
											...prev,
											[layer.id]: Number(event.target.value),
										}))
									}
								/>
							</label>
						</li>
					))}
				</ul>

				<p className="mt-3 text-neutral-500">
					Drag to move, corner handles to resize. Arrow keys nudge the selected
					layer (or vertex) by 0.001, Shift+Arrow by 0.01. Click a segment
					midpoint to add a vertex; Delete removes the selected vertex. Paste
					the output over SCENE_LAYERS in src/config/scene.ts.
				</p>

				<pre className="mt-3 max-h-64 overflow-auto rounded-md border border-neutral-300 bg-neutral-100 p-3 font-mono text-xs select-text">
					{code}
				</pre>
			</div>
		</div>
	);
}
