export const SCENE_ASPECT_RATIO = 2; // width / height

/** Max rendered width of the scene box. Tune here, nowhere else. */
export const SCENE_MAX_WIDTH = "72rem";

/** Flat field behind the scene; scene data, not theme. */
export const SCENE_CANVAS_COLOR = "#F7F1E8";

export type HotspotId = "resume" | "links" | "github" | "projects" | "timeline";

export type SectionRoute =
	| "/resume"
	| "/links"
	| "/github"
	| "/projects"
	| "/timeline";

interface SceneLayerBase {
	id: string;
	/** Path under /images. May point at art that does not exist yet. */
	image: string;
	/** Normalized 0..1 bounding box. */
	box: { x: number; y: number; width: number; height: number };
	zIndex: number;
	/** Debug stroke and load-failure fallback fill. */
	placeholderColor: string;
}

export interface DecorativeLayer extends SceneLayerBase {
	kind: "decorative";
}

export interface HotspotLayer extends SceneLayerBase {
	kind: "hotspot";
	id: HotspotId;
	label: string;
	route: SectionRoute;
	/** Normalized 0..1 points defining the clickable shape. */
	polygon: Array<[number, number]>;
}

export type SceneLayer = DecorativeLayer | HotspotLayer;

/**
 * The whole scene, one ordered list. Paint order is zIndex, never array
 * order. Hotspot array order defines nav and tab order (reader scan order:
 * top row left to right, then bottom row), so reordering z never reorders
 * the nav.
 */
export const SCENE_LAYERS: ReadonlyArray<SceneLayer> = [
	{
		kind: "decorative",
		id: "desk",
		image: "/images/desk.png",
		box: { x: -0.13, y: 0.3268, width: 1.241, height: 0.8273 },
		zIndex: 10,
		placeholderColor: "#64748b",
	},
	{
		kind: "decorative",
		id: "aaron",
		image: "/images/aaron.png",
		box: { x: 0.4092, y: 0.1148, width: 0.1817, height: 0.5451 },
		zIndex: 5,
		placeholderColor: "#ec4899",
	},
	{
		kind: "hotspot",
		id: "timeline",
		label: "Timeline",
		route: "/timeline",
		image: "/images/chalkboard.png",
		box: { x: -0.0472, y: 0.0671, width: 0.5297, height: 0.4903 },
		zIndex: 15,
		placeholderColor: "#8b5cf6",
		polygon: [
			[0.0354, 0.1203],
			[0.036, 0.1208],
			[0.0369, 0.1203],
			[0.0392, 0.1203],
			[0.0395, 0.1208],
			[0.3769, 0.1208],
			[0.3769, 0.4554],
			[0.3775, 0.4582],
			[0.3775, 0.46],
			[0.3772, 0.4605],
			[0.3772, 0.4692],
			[0.3769, 0.4697],
			[0.0354, 0.4697],
			[0.0354, 0.4554],
			[0.0351, 0.4548],
			[0.0351, 0.1208],
		],
	},
	{
		kind: "hotspot",
		id: "projects",
		label: "Projects",
		route: "/projects",
		image: "/images/computer.png",
		box: { x: 0.5358, y: 0.2197, width: 0.3729, height: 0.5968 },
		zIndex: 20,
		placeholderColor: "#3b82f6",
		polygon: [
			[0.6705, 0.3003],
			[0.8357, 0.3455],
			[0.8373, 0.5311],
			[0.8926, 0.5827],
			[0.8899, 0.6567],
			[0.8508, 0.663],
			[0.8785, 0.5737],
			[0.82, 0.6327],
			[0.7596, 0.6109],
			[0.7926, 0.6519],
			[0.7617, 0.6997],
			[0.6934, 0.663],
			[0.6974, 0.5838],
			[0.6562, 0.6684],
			[0.5644, 0.6247],
			[0.5567, 0.3822],
		],
	},
	{
		kind: "hotspot",
		id: "links",
		label: "Links",
		route: "/links",
		image: "/images/phone.png",
		box: { x: 0.2919, y: 0.7096, width: 0.0546, height: 0.126 },
		zIndex: 35,
		placeholderColor: "#10b981",
		polygon: [
			[0.3161, 0.7151],
			[0.3209, 0.7166],
			[0.3245, 0.7224],
			[0.345, 0.7934],
			[0.3446, 0.8017],
			[0.3425, 0.8059],
			[0.3237, 0.8253],
			[0.3176, 0.8299],
			[0.3141, 0.8284],
			[0.3114, 0.8226],
			[0.3032, 0.7832],
			[0.2954, 0.7525],
			[0.2934, 0.7389],
			[0.2941, 0.7298],
			[0.2956, 0.7257],
		],
	},
	{
		kind: "hotspot",
		id: "resume",
		label: "Resume",
		route: "/resume",
		image: "/images/paper.png",
		box: { x: 0.3211, y: 0.6552, width: 0.1529, height: 0.1645 },
		zIndex: 30,
		placeholderColor: "#f59e0b",
		polygon: [
			[0.365, 0.6701],
			[0.3724, 0.6757],
			[0.3826, 0.6705],
			[0.421, 0.6975],
			[0.4637, 0.7091],
			[0.461, 0.7154],
			[0.4684, 0.7209],
			[0.464, 0.7295],
			[0.4639, 0.7579],
			[0.4678, 0.7574],
			[0.4094, 0.7999],
			[0.3295, 0.7449],
			[0.3267, 0.7397],
			[0.3288, 0.7102],
			[0.3253, 0.7055],
			[0.3528, 0.6894],
		],
	},
	{
		kind: "hotspot",
		id: "github",
		label: "GitHub",
		route: "/github",
		image: "/images/github.png",
		box: { x: 0.8604, y: 0.6245, width: 0.1126, height: 0.2251 },
		zIndex: 25,
		placeholderColor: "#ef4444",
		polygon: [
			[0.8937, 0.6501],
			[0.9431, 0.653],
			[0.9474, 0.7221],
			[0.9635, 0.7258],
			[0.9289, 0.751],
			[0.9414, 0.8109],
			[0.8897, 0.8057],
			[0.9035, 0.7765],
			[0.8847, 0.7474],
			[0.9073, 0.7506],
			[0.889, 0.7283],
			[0.871, 0.7364],
			[0.8879, 0.7239],
			[0.8701, 0.7273],
			[0.8876, 0.7226],
		],
	},
];

/** Hotspots in nav/tab order, derived from the single layer list. */
export const SCENE_HOTSPOTS: ReadonlyArray<HotspotLayer> = SCENE_LAYERS.filter(
	(layer): layer is HotspotLayer => layer.kind === "hotspot",
);

/** Label for a section route, so route files never hardcode one. */
export function sectionLabel(route: string): string {
	return (
		SCENE_HOTSPOTS.find((hotspot) => hotspot.route === route)?.label ?? route
	);
}

/** Nav entry back to the scene itself; the scene is the homepage. */
export const SCENE_HOME = { label: "Home", route: "/" } as const;

export const SCENE_MOBILE_IMAGE = "/images/scene-flat-mobile.png";
