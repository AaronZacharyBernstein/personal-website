import { useSyncExternalStore } from "react";

/**
 * Tri-state media query: `null` on the server and during the first hydration
 * render, so a subtree that genuinely cannot be server-rendered mounts only
 * once the viewport is actually known.
 *
 * Not a tool for hiding things. Gating a subtree on this costs it server
 * rendering and delays everything inside it until hydration resolves — which
 * is what put the scene's art behind a visible load flash. Prefer a CSS
 * breakpoint, and reach for this only when the branch is genuinely
 * client-only anyway.
 */
export function useMediaQuery(query: string): boolean | null {
	return useSyncExternalStore<boolean | null>(
		(onStoreChange) => {
			const mediaQueryList = window.matchMedia(query);
			mediaQueryList.addEventListener("change", onStoreChange);
			return () => mediaQueryList.removeEventListener("change", onStoreChange);
		},
		() => window.matchMedia(query).matches,
		() => null,
	);
}
