import { useState } from "react";

export type ImageLoadStatus = "pending" | "loaded" | "error";

/**
 * Tracks whether an <img> has successfully loaded so a placeholder can be
 * swapped out without flicker. The ref callback covers images that are
 * already complete (cached) before React attaches the onLoad handler.
 */
export function useImageLoad() {
	const [status, setStatus] = useState<ImageLoadStatus>("pending");

	const ref = (node: HTMLImageElement | null) => {
		if (node?.complete) {
			setStatus(node.naturalWidth > 0 ? "loaded" : "error");
		}
	};

	const onLoad = () => setStatus("loaded");
	const onError = () => setStatus("error");

	return { status, ref, onLoad, onError };
}
