export const SCENE_ASPECT_RATIO = 2; // width / height

/** Max rendered width of the scene box. Tune here, nowhere else. */
export const SCENE_MAX_WIDTH = "72rem";

export type HotspotId = "resume" | "links" | "github" | "projects" | "timeline";

export type SectionRoute =
	| "/resume"
	| "/links"
	| "/github"
	| "/projects"
	| "/timeline";

export interface Hotspot {
	id: HotspotId;
	label: string;
	route: SectionRoute;
	/** Normalized 0..1 points defining the clickable shape. */
	polygon: Array<[number, number]>;
	/** Normalized bounding box for the art layer image. */
	layer: { x: number; y: number; width: number; height: number };
	/** Path under /images. May point at art that does not exist yet. */
	image: string;
	zIndex: number;
	/** Fill used by the placeholder rectangle and the debug polygon stroke. */
	placeholderColor: string;
}

/**
 * Array order defines both keyboard tab order and nav order: the way a
 * reader scans the scene, top row left to right, then bottom row.
 */
export const SCENE_HOTSPOTS: ReadonlyArray<Hotspot> = [
	{
		id: "timeline",
		label: "Timeline",
		route: "/timeline",
		polygon: [
			[0.05, 0.08],
			[0.35, 0.08],
			[0.35, 0.5],
			[0.05, 0.5],
		],
		layer: { x: 0.05, y: 0.08, width: 0.3, height: 0.42 },
		image: "/images/chalkboard.png",
		zIndex: 10,
		placeholderColor: "#8b5cf6",
	},
	{
		id: "projects",
		label: "Projects",
		route: "/projects",
		polygon: [
			[0.52, 0.18],
			[0.78, 0.18],
			[0.78, 0.5],
			[0.69, 0.6],
			[0.61, 0.6],
			[0.52, 0.5],
		],
		layer: { x: 0.52, y: 0.18, width: 0.26, height: 0.42 },
		image: "/images/computer.png",
		zIndex: 20,
		placeholderColor: "#3b82f6",
	},
	{
		id: "links",
		label: "Links",
		route: "/links",
		polygon: [
			[0.11, 0.62],
			[0.2, 0.64],
			[0.18, 0.86],
			[0.09, 0.84],
		],
		layer: { x: 0.09, y: 0.62, width: 0.11, height: 0.24 },
		image: "/images/phone.png",
		zIndex: 30,
		placeholderColor: "#10b981",
	},
	{
		id: "resume",
		label: "Resume",
		route: "/resume",
		polygon: [
			[0.37, 0.66],
			[0.52, 0.68],
			[0.5, 0.9],
			[0.36, 0.88],
		],
		layer: { x: 0.36, y: 0.66, width: 0.16, height: 0.24 },
		image: "/images/paper.png",
		zIndex: 40,
		placeholderColor: "#f59e0b",
	},
	{
		id: "github",
		label: "GitHub",
		route: "/github",
		polygon: [
			[0.82, 0.58],
			[0.9, 0.58],
			[0.92, 0.74],
			[0.86, 0.88],
			[0.8, 0.74],
		],
		layer: { x: 0.8, y: 0.58, width: 0.12, height: 0.3 },
		image: "/images/octocat.png",
		zIndex: 50,
		placeholderColor: "#ef4444",
	},
];

/** Label for a section route, so route files never hardcode one. */
export function sectionLabel(route: string): string {
	return (
		SCENE_HOTSPOTS.find((hotspot) => hotspot.route === route)?.label ?? route
	);
}

/** Nav entry back to the scene itself; the scene is the homepage. */
export const SCENE_HOME = { label: "Home", route: "/" } as const;

export const SCENE_BACKGROUND_IMAGE = "/images/scene-background.png";
export const SCENE_MOBILE_IMAGE = "/images/scene-flat-mobile.png";
