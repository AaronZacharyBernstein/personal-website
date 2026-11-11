import type { CSSProperties } from "react";
import { boardVariables } from "#/config/board";
import { INTRO } from "#/config/intro";

/**
 * Inline style for the scene layout's root: every number the stylesheet's
 * board and scene rules need, as custom properties (see board.ts for what
 * they mean). On the root rather than the board itself because the nav
 * toggle, a sibling of the board, sits on the frame and needs its
 * thickness too.
 *
 * In a stylesheet rather than as real inline styles because nearly all of
 * it applies only at md and up, and inline styles cannot be media-scoped.
 */
export const BOARD_STYLE = {
	...boardVariables(),
	// The nav toggle is centred on the frame's top-right corner block — on
	// the wood, clear of the cork and of the pins in that corner. Never
	// closer to the edge than a hair, for a window so short or so narrow the
	// frame is thinner than the button.
	"--nav-toggle-top": "max(0.125rem, calc((var(--frame-top) - 2.5rem) / 2))",
	"--nav-toggle-right":
		"max(0.125rem, calc((var(--frame-right) - 2.5rem) / 2))",
	"--intro-board-fade": `${INTRO.boardFade * 1000}ms`,
	"--intro-failsafe": `${INTRO.failsafeMs}ms`,
} as CSSProperties;
