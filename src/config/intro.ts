/**
 * The first-load intro: the board fades in, the items drop onto it one at a
 * time, each tack pops in just after its item lands, and the name card drops
 * last. Every number that shapes it lives here.
 *
 * The clock starts at first paint, when the head script has armed the intro
 * and CSS starts the board fade. Everything after that is GSAP, loaded only
 * when the intro is actually going to play.
 */
// Relative, not "#/", to match the rest of src/config (scripts load it via tsx).
import {
	SCENE_BOARD_ID,
	SCENE_HOTSPOTS,
	SCENE_LAYERS,
	SCENE_NAME_CARD_ID,
} from "./scene";

/**
 * On `<html>` for the whole intro. The board's fade hangs off this one, so
 * it survives the handover from CSS to GSAP.
 */
export const INTRO_CLASS = "intro";
/**
 * On `<html>` only until the timeline takes over (or the visitor skips, or
 * the failsafe fires). While it is there, CSS holds the items hidden.
 */
export const INTRO_PENDING_CLASS = "intro-pending";
/** sessionStorage key: set on the first page load of a session. */
export const INTRO_STORAGE_KEY = "intro-played";
/** Keyframes names in styles.css; the head script listens for the first. */
export const INTRO_FAILSAFE_KEYFRAMES = "intro-failsafe";
export const INTRO_BOARD_KEYFRAMES = "intro-board";
/**
 * Dev affordance, read straight from the URL and never by React:
 * `?intro=replay` plays the intro despite the session flag, and
 * `?intro=0.9` plays it to 0.9s and holds there.
 */
export const INTRO_PARAM = "intro";

/** Seconds unless a name says otherwise. */
export const INTRO = {
	/** The board's CSS fade. */
	boardFade: 0.3,
	/**
	 * When the first item starts to drop, measured from the start of the
	 * board fade — inside it, so the fade and the first drops overlap.
	 */
	firstDropAt: 0.2,
	/** Gap between hotspot items. */
	hotspotStagger: 0.075,
	/** Gap between team pins: a quicker flurry. */
	pinStagger: 0.045,
	/** How long an item takes to fall and settle. */
	drop: 0.38,
	/** Start height above the resting place, as a fraction of scene height. */
	dropFrom: 0.035,
	dropScale: 1.12,
	/** The small overshoot and settle on landing. */
	dropEase: "back.out(1.6)",
	/** The name card: heavier and longer. */
	nameDrop: 0.52,
	nameDropFrom: 0.05,
	nameDropScale: 1.16,
	nameDropEase: "back.out(1.25)",
	/** How quickly a dropping item becomes visible. */
	fadeIn: 0.12,
	/** A tack waits this long after its item settles, then pops. */
	tackDelay: 0.08,
	tackPop: 0.14,
	tackScale: 1.6,
	/**
	 * Ceiling for the whole intro, from the start of the board fade. If the
	 * schedule would run past it, the staggers tighten; nothing is extended.
	 */
	budget: 1.8,
	/**
	 * Milliseconds after first paint at which pure CSS reveals everything if
	 * the timeline has not taken over — JavaScript failed, or was too slow.
	 */
	failsafeMs: 2500,
} as const;

export interface IntroStep {
	/** Layer id. */
	id: string;
	kind: "hotspot" | "pin" | "name";
	/** Seconds from the start of the board fade. */
	at: number;
	duration: number;
	/** When this item's tack pops, or null if it has none. */
	tackAt: number | null;
}

export interface IntroSchedule {
	steps: IntroStep[];
	/** End of the last animation, from the start of the board fade. */
	total: number;
	/** The same, measured from the first drop. */
	fromFirstDrop: number;
	/** The staggers actually used, after any tightening. */
	hotspotStagger: number;
	pinStagger: number;
}

function build(hotspotStagger: number, pinStagger: number): IntroSchedule {
	const tacked = new Set(
		SCENE_LAYERS.filter((layer) => layer.tack).map((layer) => layer.id),
	);
	const pins = SCENE_LAYERS.filter(
		(layer) =>
			layer.kind === "decorative" &&
			layer.id !== SCENE_BOARD_ID &&
			layer.id !== SCENE_NAME_CARD_ID,
	);
	const steps: IntroStep[] = [];
	let at: number = INTRO.firstDropAt;
	const add = (id: string, kind: IntroStep["kind"], duration: number) => {
		steps.push({
			id,
			kind,
			at,
			duration,
			tackAt: tacked.has(id) ? at + duration + INTRO.tackDelay : null,
		});
	};
	for (const hotspot of SCENE_HOTSPOTS) {
		add(hotspot.id, "hotspot", INTRO.drop);
		at += hotspotStagger;
	}
	for (const [index, pin] of pins.entries()) {
		add(pin.id, "pin", INTRO.drop);
		// The name card follows the last pin at the slower, hotspot pace.
		at += index === pins.length - 1 ? hotspotStagger : pinStagger;
	}
	if (SCENE_LAYERS.some((layer) => layer.id === SCENE_NAME_CARD_ID)) {
		add(SCENE_NAME_CARD_ID, "name", INTRO.nameDrop);
	}
	const total = Math.max(
		...steps.map((step) =>
			step.tackAt === null
				? step.at + step.duration
				: step.tackAt + INTRO.tackPop,
		),
	);
	return {
		steps,
		total,
		fromFirstDrop: total - INTRO.firstDropAt,
		hotspotStagger,
		pinStagger,
	};
}

/**
 * When each item starts. Order: hotspots in nav order, then the team pins,
 * then the name card. If the configured staggers would break the budget,
 * both are scaled down by the same factor until the total fits.
 */
export function introSchedule(): IntroSchedule {
	const configured = build(INTRO.hotspotStagger, INTRO.pinStagger);
	if (configured.total <= INTRO.budget) {
		return configured;
	}
	// The total is linear in the stagger scale: total(s) = fixed + s * span.
	const fixed = build(0, 0).total;
	const span = configured.total - fixed;
	const scale = Math.max(0, (INTRO.budget - fixed) / span);
	return build(INTRO.hotspotStagger * scale, INTRO.pinStagger * scale);
}
