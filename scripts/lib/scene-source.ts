/**
 * In-place edits to src/config/scene.ts for the two values that are a pure
 * function of the art: a box's aspect-locked height and a hotspot's traced
 * polygon. Everything else in that file is hand-authored and left alone.
 *
 * Works on text, not an AST: each layer is found by its `id: "<id>"` line
 * and the edit is confined to the span before the next layer's id, so a
 * rewrite can never reach into a neighbouring layer.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const scenePath = fileURLToPath(
	new URL("../../src/config/scene.ts", import.meta.url),
);

export function readSceneSource(): string {
	return readFileSync(scenePath, "utf8");
}

export function writeSceneSource(source: string): void {
	writeFileSync(scenePath, source);
}

/** [start, end) of the layer literal that declares `id`. */
function layerSpan(source: string, id: string): [number, number] {
	const marker = `\t\tid: ${JSON.stringify(id)},`;
	const start = source.indexOf(marker);
	if (start === -1) {
		throw new Error(`scene.ts has no layer with id "${id}"`);
	}
	const next = source.indexOf("\t\tid: ", start + marker.length);
	return [start, next === -1 ? source.length : next];
}

function replaceInLayer(
	source: string,
	id: string,
	pattern: RegExp,
	replacement: string,
): string {
	const [start, end] = layerSpan(source, id);
	const span = source.slice(start, end);
	if (!pattern.test(span)) {
		throw new Error(`scene.ts layer "${id}" has nothing matching ${pattern}`);
	}
	return (
		source.slice(0, start) +
		span.replace(pattern, () => replacement) +
		source.slice(end)
	);
}

/** Rewrite one layer's `height` inside its single-line `box: { ... }`. */
export function setBoxHeight(
	source: string,
	id: string,
	height: number,
): string {
	const [start, end] = layerSpan(source, id);
	const span = source.slice(start, end);
	const pattern = /(box: \{[^}]*\bheight: )[-\d.]+/;
	if (!pattern.test(span)) {
		throw new Error(`scene.ts layer "${id}" has no single-line box`);
	}
	return (
		source.slice(0, start) +
		span.replace(pattern, (_, head: string) => `${head}${height}`) +
		source.slice(end)
	);
}

/** Replace one hotspot's whole `polygon: [ ... ],` block. */
export function setPolygon(
	source: string,
	id: string,
	points: ReadonlyArray<readonly [number, number]>,
): string {
	const block = `polygon: [\n${points
		.map(([x, y]) => `\t\t\t[${x}, ${y}],`)
		.join("\n")}\n\t\t],`;
	return replaceInLayer(source, id, /polygon: \[[\s\S]*?\r?\n\t\t\],/, block);
}
