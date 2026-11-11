import { type RefObject, useEffect } from "react";
import { INTRO_PENDING_CLASS } from "#/config/intro";
import { SCENE_LAYERS } from "#/config/scene";
import { SCENE_TACKS } from "#/config/scene-geometry";

/**
 * The timeline lives in its own chunk, and it is the only module that
 * imports gsap — so gsap is downloaded only by a visitor whose head script
 * armed the intro (first load of the session, on the board, desktop width,
 * motion allowed). Everyone else never requests it.
 *
 * Kicked off here, at module evaluation, rather than in the effect: the
 * chunk starts downloading while React is still hydrating instead of after.
 * The SSR guard keeps the import, and gsap with it, out of the Worker's
 * module graph at runtime.
 */
const introModule =
	!import.meta.env.SSR &&
	document.documentElement.classList.contains(INTRO_PENDING_CLASS)
		? import("./intro-timeline").catch(() => null)
		: null;

/**
 * Layers are CSS backgrounds, so there is no load event to wait on — and an
 * intro that drops boxes whose art has not arrived yet drops nothing, then
 * pops the art in at rest. Decoding each URL through an Image shares the
 * browser's cache with the background fetch and resolves when the pixels
 * are ready to paint. A failed image must not hold the intro hostage.
 */
function artReady(): Promise<unknown> {
	return Promise.all(
		[...SCENE_LAYERS, ...SCENE_TACKS].map((layer) => {
			const image = new Image();
			image.src = layer.image;
			return image.decode().catch(() => undefined);
		}),
	);
}

/** A hidden tab pauses rAF; taking over there would park the items hidden. */
function tabVisible(): Promise<void> {
	if (!document.hidden) {
		return Promise.resolve();
	}
	return new Promise((resolve) => {
		document.addEventListener("visibilitychange", () => resolve(), {
			once: true,
		});
	});
}

/**
 * Hands the scene to the intro timeline once it, the art and the tab are
 * all ready. Until then CSS is holding the items hidden, with its own
 * failsafe; if that fires first, or the visitor skips, the timeline finds
 * the pending class gone and does nothing.
 *
 * Runs strictly after hydration and never changes what the scene renders:
 * GSAP writes inline styles to elements React gave none.
 */
export function useIntro(rootRef: RefObject<HTMLElement | null>): void {
	useEffect(() => {
		const root = rootRef.current;
		if (!introModule || !root) {
			return;
		}
		// Per run, so StrictMode's mount-unmount-mount in dev leaves the
		// first run cancelled and the second in charge.
		let cancelled = false;
		let finish: (() => void) | undefined;
		void Promise.all([introModule, artReady(), tabVisible()]).then(
			([timeline]) => {
				if (!cancelled && timeline) {
					finish = timeline.runIntro(root);
				}
			},
		);
		return () => {
			cancelled = true;
			finish?.();
		};
	}, [rootRef]);
}
