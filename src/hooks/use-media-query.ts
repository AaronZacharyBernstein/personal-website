import { useSyncExternalStore } from "react";

/**
 * Tri-state media query: `null` on the server and during the first hydration
 * render, so viewport-dependent subtrees mount only once the viewport is
 * actually known (their assets are never requested speculatively).
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
