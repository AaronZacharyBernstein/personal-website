/**
 * The intro's choreography. Loaded on demand (see intro.ts): this is the
 * only module in the app that imports gsap.
 */
import gsap from "gsap";
import {
	INTRO,
	INTRO_BOARD_KEYFRAMES,
	INTRO_CLASS,
	INTRO_PARAM,
	INTRO_PENDING_CLASS,
	introSchedule,
} from "#/config/intro";
import type { SceneShadow } from "#/config/scene";
import { SCENE_SHADOWS } from "#/config/scene";
import { shadowAtWidth } from "#/config/scene-geometry";

/**
 * Both ends of the shadow tween are written by this one function, in pixels
 * and in one token order, so GSAP can interpolate number for number — and
 * the end value is the stylesheet's rest shadow resolved at this scene
 * width, so nothing jumps when the inline style is removed.
 */
function shadowValue(shadow: SceneShadow): string {
	return `drop-shadow(${shadow.x.toFixed(2)}px ${shadow.y.toFixed(2)}px ${shadow.blur.toFixed(2)}px rgba(0,0,0,${shadow.opacity}))`;
}

/** Seconds since the board's CSS fade began, i.e. since first paint. */
function boardFadeElapsed(root: HTMLElement): number {
	const board = root.querySelector('[data-intro="board"]');
	const fade = board
		?.getAnimations()
		.find(
			(animation) =>
				animation instanceof CSSAnimation &&
				animation.animationName === INTRO_BOARD_KEYFRAMES,
		);
	const time = fade?.currentTime;
	// Unknown means "assume the moment for the first drop has come".
	return typeof time === "number" ? time / 1000 : INTRO.firstDropAt;
}

/** The whole sequence, as tweens on one paused timeline. */
function build(timeline: gsap.core.Timeline, root: HTMLElement): void {
	const sceneWidth = root.clientWidth;
	const sceneHeight = root.clientHeight;
	const falling = shadowValue(shadowAtWidth(SCENE_SHADOWS.falling, sceneWidth));
	const rest = shadowValue(shadowAtWidth(SCENE_SHADOWS.rest, sceneWidth));
	// The schedule is written against a clock that starts with the board
	// fade. Shift it so the first drop lands on its mark if there is still
	// time, or starts now if that moment has already passed.
	const shift =
		Math.max(0, INTRO.firstDropAt - boardFadeElapsed(root)) - INTRO.firstDropAt;
	const find = (role: string, id: string) =>
		root.querySelector<HTMLElement>(
			`[data-intro="${role}"][data-intro-id="${id}"]`,
		);

	timeline.call(
		() => performance.mark("intro:first-drop"),
		undefined,
		INTRO.firstDropAt + shift,
	);
	for (const step of introSchedule().steps) {
		const item = find("item", step.id);
		if (!item) {
			continue;
		}
		const at = step.at + shift;
		const name = step.kind === "name";
		// fromTo throughout, never from(): the stylesheet is holding these
		// elements at opacity 0, and from() would read that as the value to
		// animate to. Each fromTo writes its start state inline as it is
		// created, which is what lets the CSS hold be released afterwards
		// without a frame of the board at rest. The three tweens on an item
		// own different properties, so none overwrites another's start.
		timeline.fromTo(
			item,
			{ opacity: 0 },
			{ opacity: 1, duration: INTRO.fadeIn, ease: "none" },
			at,
		);
		timeline.fromTo(
			item,
			{
				y: -(name ? INTRO.nameDropFrom : INTRO.dropFrom) * sceneHeight,
				scale: name ? INTRO.nameDropScale : INTRO.dropScale,
			},
			{
				y: 0,
				scale: 1,
				duration: step.duration,
				ease: name ? INTRO.nameDropEase : INTRO.dropEase,
			},
			at,
		);
		// Its own tween: the overshoot ease would drive the blur below
		// zero, which is not a valid filter.
		timeline.fromTo(
			item,
			{ filter: falling },
			{ filter: rest, duration: step.duration, ease: "power2.in" },
			at,
		);
		const tack = step.tackAt === null ? null : find("tack", step.id);
		if (tack && step.tackAt !== null) {
			timeline.fromTo(
				tack,
				{ opacity: 0, scale: INTRO.tackScale },
				{
					opacity: 1,
					scale: 1,
					duration: INTRO.tackPop,
					ease: "power2.out",
				},
				step.tackAt + shift,
			);
		}
	}
}

/**
 * Takes the scene over from the stylesheet and plays the intro. Returns a
 * function that ends it at once, finished board showing — or undefined if
 * there is nothing to take over (the visitor skipped before hydration, or
 * the CSS failsafe already revealed the board).
 *
 * Everything that can end the intro goes through `finish`, and after
 * takeover something always will: completion, a click or key, the tab
 * being hidden, an error while building, or the watchdog.
 */
export function runIntro(root: HTMLElement): (() => void) | undefined {
	const html = document.documentElement.classList;
	if (!html.contains(INTRO_PENDING_CLASS)) {
		return undefined;
	}

	const listeners = new AbortController();
	let done = false;
	let watchdog = 0;
	let context: gsap.Context | undefined;

	function finish() {
		if (done) {
			return;
		}
		done = true;
		listeners.abort();
		window.clearTimeout(watchdog);
		// Kills the timeline and takes back every inline style it wrote, and
		// nothing else: the elements' own styles are not GSAP's to clear.
		// With no inline opacity, transform or filter left, the stylesheet's
		// resting state — the finished board — is what shows.
		context?.revert();
		html.remove(INTRO_CLASS, INTRO_PENDING_CLASS);
		performance.mark("intro:done");
	}

	try {
		const timeline = gsap.timeline({ paused: true, onComplete: finish });
		// A context scoped to the scene, so one revert() undoes all of it.
		context = gsap.context(() => build(timeline, root), root);

		// Same task as the fromTo calls in build(): the inline start states
		// are in place, so dropping the CSS hold changes nothing on screen —
		// and it must go, because a CSS animation outranks inline styles and
		// would otherwise pin every item at opacity 0.
		html.remove(INTRO_PENDING_CLASS);

		const holdAt = Number(
			new URLSearchParams(window.location.search).get(INTRO_PARAM),
		);
		if (holdAt > 0) {
			timeline.pause(holdAt);
			return finish;
		}

		// Follow the wall clock. By default GSAP stretches time after a
		// stalled frame so nothing visibly jumps; for a one-shot intro with a
		// fixed length, catching up is the better trade — it ends on time.
		gsap.ticker.lagSmoothing(0);

		const options = { capture: true, signal: listeners.signal };
		window.addEventListener("pointerdown", finish, options);
		window.addEventListener("keydown", finish, options);
		document.addEventListener(
			"visibilitychange",
			() => {
				if (document.hidden) {
					finish();
				}
			},
			options,
		);
		watchdog = window.setTimeout(finish, timeline.duration() * 1000 + 1000);
		timeline.play();
	} catch {
		finish();
	}
	return finish;
}
