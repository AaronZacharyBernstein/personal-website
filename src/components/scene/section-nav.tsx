import { Link } from "@tanstack/react-router";
import { type KeyboardEvent, useRef } from "react";
import type { HotspotId } from "#/config/scene";
import { SCENE_HOME, SCENE_HOTSPOTS } from "#/config/scene";
import { cn } from "#/lib/utils.ts";

export interface SectionNavProps {
	hoveredId: HotspotId | null;
	onHoverChange: (id: HotspotId | null) => void;
}

const linkClass = cn(
	"block rounded-md px-3 py-3 text-sm text-neutral-700 md:py-1.5",
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500",
	"data-[status=active]:bg-neutral-200 data-[status=active]:font-semibold data-[status=active]:text-neutral-900",
);

/**
 * The real, crawlable navigation: exactly one accessible link per section.
 * Desktop: compact vertical list beside the scene. Mobile: full-width rows
 * below it. Hover and focus both drive the scene's hover highlight.
 */
export function SectionNav({ hoveredId, onHoverChange }: SectionNavProps) {
	const listRef = useRef<HTMLUListElement | null>(null);

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
		<nav aria-label="Sections" className="w-full md:w-44 md:shrink-0">
			<ul
				ref={listRef}
				onKeyDown={handleKeyDown}
				className="flex flex-col gap-1"
			>
				<li>
					<Link
						to={SCENE_HOME.route}
						activeOptions={{ exact: true, includeSearch: false }}
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
							onMouseEnter={() => onHoverChange(hotspot.id)}
							onMouseLeave={() => onHoverChange(null)}
							onFocus={() => onHoverChange(hotspot.id)}
							onBlur={() => onHoverChange(null)}
							className={cn(
								linkClass,
								hoveredId === hotspot.id && "bg-neutral-100",
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
