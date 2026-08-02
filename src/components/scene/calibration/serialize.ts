import type { SceneLayer } from "#/config/scene";

/** Round a normalized coordinate to 4 decimal places for stable output. */
function round4(value: number): number {
	return Number(value.toFixed(4));
}

/**
 * Emit the current layer state as the SCENE_LAYERS export, formatted to
 * match the repo's Biome style (tabs, double quotes) and the config's key
 * order, ready to paste over the existing export in src/config/scene.ts.
 * Layers are emitted in ARRAY order, never zIndex order, because array
 * order drives nav and tab order.
 */
export function serializeSceneLayers(
	layers: ReadonlyArray<SceneLayer>,
): string {
	const body = layers
		.map((layer) => {
			// JSON.stringify escapes quotes/backslashes so freeform config
			// strings can never emit syntactically broken TypeScript.
			const s = (value: string) => JSON.stringify(value);
			const lines = [
				"\t{",
				`\t\tkind: ${s(layer.kind)},`,
				`\t\tid: ${s(layer.id)},`,
			];
			if (layer.kind === "hotspot") {
				lines.push(`\t\tlabel: ${s(layer.label)},`);
				lines.push(`\t\troute: ${s(layer.route)},`);
			}
			lines.push(`\t\timage: ${s(layer.image)},`);
			lines.push(
				`\t\tbox: { x: ${round4(layer.box.x)}, y: ${round4(layer.box.y)}, width: ${round4(layer.box.width)}, height: ${round4(layer.box.height)} },`,
			);
			lines.push(`\t\tzIndex: ${layer.zIndex},`);
			lines.push(`\t\tplaceholderColor: ${s(layer.placeholderColor)},`);
			if (layer.kind === "hotspot") {
				lines.push("\t\tpolygon: [");
				for (const [x, y] of layer.polygon) {
					lines.push(`\t\t\t[${round4(x)}, ${round4(y)}],`);
				}
				lines.push("\t\t],");
			}
			lines.push("\t},");
			return lines.join("\n");
		})
		.join("\n");

	return `export const SCENE_LAYERS: ReadonlyArray<SceneLayer> = [\n${body}\n];\n`;
}
