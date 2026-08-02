import { Link } from "@tanstack/react-router";
import { type KeyboardEvent, useEffect, useRef } from "react";
import type { HotspotId } from "#/config/scene";
import { SCENE_HOME, SCENE_HOTSPOTS } from "#/config/scene";
import { cn } from "#/lib/utils.ts";

/** Target of the toggle button's aria-controls. */
export const SECTION_NAV_ID = "section-nav";

export interface SectionNavProps {
	hoveredId: HotspotId | null;
	onHoverChange: (id: HotspotId | null) => void;
	/**
	 * Desktop collapse state. Only affects md and up: below md the list is
	 * the sole navigation and is always visible, whatever this says.
	 */
	open: boolean;
	/** Called when a link is chosen, so the layout can close the panel. */
	onLinkClick: () => void;
	/**
	 * True only when the desktop panel is closed: takes the links out of
	 * the tab order immediately, without waiting for the visibility
	 * transition. Must never be true below md.
	 */
	inert: boolean;
}

const linkClass = cn(
	"block rounded-md px-3 py-3 text-sm text-muted-foreground md:py-1.5",
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-foreground",
	"data-[status=active]:bg-accent data-[status=active]:font-semibold data-[status=active]:text-foreground",
);

/**
 * The real, crawlable navigation: exactly one accessible link per section,
 * always in the server-rendered HTML. Mobile: full-width rows below the
 * scene, always visible. Desktop (md+): a fixed panel under the menu button
 * that collapses with `visibility: hidden` — never unmounted, so crawlers
 * always see the links, but hidden links are unreachable by Tab.
 * Hover and focus both drive the scene's hover highlight.
 */
export function SectionNav({
	hoveredId,
	onHoverChange,
	open,
	onLinkClick,
	inert,
}: SectionNavProps) {
	const listRef = useRef<HTMLUListElement | null>(null);

	// Opening (always button-driven, so always md+) moves focus to the
	// first link. Visibility has already flipped by the time effects run.
	useEffect(() => {
		if (open) {
			listRef.current?.querySelector("a")?.focus();
		}
	}, [open]);

	const handleKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
		if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
			return;
		}
		const links = Array.from(
			listRef.current?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? [],
		);
		const active = document.activeElement;
		if (!(active instanceof HTMLAnchorElement)) {
			return;
		}
		const currentIndex = links.indexOf(active);
		if (currentIndex === -1) {
			return;
		}
		let nextIndex: number;
		switch (event.key) {
			case "ArrowDown":
			case "ArrowRight":
				nextIndex = (currentIndex + 1) % links.length;
				break;
			case "ArrowUp":
			case "ArrowLeft":
				nextIndex = (currentIndex - 1 + links.length) % links.length;
				break;
			case "Home":
				nextIndex = 0;
				break;
			case "End":
				nextIndex = links.length - 1;
				break;
			default:
				return;
		}
		event.preventDefault();
		links[nextIndex].focus();
	};

	return (
		<nav
			id={SECTION_NAV_ID}
			aria-label="Sections"
			inert={inert}
			className={cn(
				"w-full",
				"md:fixed md:top-16 md:right-4 md:z-50 md:w-44 md:rounded-lg md:border md:bg-popover md:p-2 md:shadow-lg",
				"motion-safe:duration-200",
				// visibility (not just opacity) so closed links are out of the
				// tab order — and already are in the pre-hydration HTML.
				// Only the closing transition includes visibility: hiding must
				// wait for the fade, but opening must flip to visible at once
				// or the open-effect can't focus the first link.
				open
					? "motion-safe:transition-[opacity,transform]"
					: "md:invisible md:translate-x-2 md:opacity-0 motion-safe:transition-[visibility,opacity,transform]",
			)}
		>
			<ul
				ref={listRef}
				onKeyDown={handleKeyDown}
				className="flex flex-col gap-1"
			>
				<li>
					<Link
						to={SCENE_HOME.route}
						activeOptions={{ exact: true, includeSearch: false }}
						onClick={onLinkClick}
						className={linkClass}
					>
						{SCENE_HOME.label}
					</Link>
				</li>
				{SCENE_HOTSPOTS.map((hotspot) => (
					<li key={hotspot.id}>
						<Link
							to={hotspot.route}
							activeOptions={{ includeSearch: false }}
							onClick={onLinkClick}
							onMouseEnter={() => onHoverChange(hotspot.id)}
							onMouseLeave={() => onHoverChange(null)}
							onFocus={() => onHoverChange(hotspot.id)}
							onBlur={() => onHoverChange(null)}
							className={cn(
								linkClass,
								// text-foreground too: muted-foreground only clears
								// WCAG AA on the plain background, not on accent/50.
								hoveredId === hotspot.id && "bg-accent/50 text-foreground",
							)}
						>
							{hotspot.label}
						</Link>
					</li>
				))}
			</ul>
		</nav>
	);
}
