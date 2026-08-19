import { useNavigate, useRouter } from "@tanstack/react-router";
import { X } from "lucide-react";
import {
	type CSSProperties,
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";
import { NAV_TOGGLE_ID, SECTION_NAV_ID } from "#/components/scene/section-nav";
import { Button } from "#/components/ui/button";
import { PANEL_MAX_HEIGHT, PANEL_MAX_WIDTH } from "#/config/panel";
import { DESKTOP_MEDIA_QUERY } from "#/config/scene";

/**
 * Whether the collapsible desktop nav is open, provided by the scene
 * layout. The panel's Escape handler yields while it is true, so one
 * keypress never closes both surfaces — and because each listener acts
 * only in its own lane (the nav's runs only while the nav is open, the
 * panel's only while it is not), the outcome does not depend on which
 * document listener happened to register first.
 */
export const NavOpenContext = createContext(false);

export interface SectionPanelProps {
	title: string;
	children: ReactNode;
}

/**
 * The shared presentation surface for every section route. Desktop: a
 * centered dialog over the dimmed scene, internally scrolling past
 * PANEL_MAX_HEIGHT. Mobile: the full page — no scrim, and the layout hides
 * the (purely decorative) scene entirely while a section is open.
 *
 * This is a route's component, not modal state: closing is a navigation to
 * "/", and a cold load of a section URL renders the open panel directly.
 * Escape handling leans on NavOpenContext, so a consumer mounted outside
 * the scene layout would lose the nav-first Escape ordering (and nothing
 * else).
 */
export function SectionPanel({ title, children }: SectionPanelProps) {
	const navigate = useNavigate();
	const navOpen = useContext(NavOpenContext);
	const router = useRouter();
	// This panel's own route, captured once: during the close navigation
	// the router re-renders the panel with the DESTINATION location before
	// unmounting it, so a live subscription would make focus return chase
	// "/" (the Home link) instead of the section being left. One instance
	// never legitimately changes section — each route mounts its own.
	// Lowercased: the router matches routes case-insensitively, so a
	// /Resume load must still find the /resume link.
	const [sectionPath] = useState(() =>
		router.state.location.pathname.toLowerCase(),
	);
	const panelRef = useRef<HTMLDivElement | null>(null);
	const titleId = useId();

	const close = useCallback(() => {
		void navigate({ to: "/" });
	}, [navigate]);

	// Focus return lives in the unmount cleanup, not in close(): by the
	// time the cleanup runs the router has committed, so the nav list —
	// max-md:hidden while the panel was open — is visible and focusable
	// again, and one code path covers every close route (Escape, scrim,
	// close button, browser back). Desktop gets the toggle button: the
	// collapsed popover's links are inert and would silently drop focus
	// to <body>. Mobile gets the section's own link in the restored list.
	useEffect(() => {
		const target = sectionPath;
		return () => {
			// A section-to-section switch also unmounts this panel; the next
			// panel takes focus itself, so only the exit to the scene counts.
			if (window.location.pathname !== "/") {
				return;
			}
			if (window.matchMedia(DESKTOP_MEDIA_QUERY).matches) {
				document.getElementById(NAV_TOGGLE_ID)?.focus();
				return;
			}
			const links =
				document
					.getElementById(SECTION_NAV_ID)
					?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? [];
			// Match on pathname, not the href attribute: retained search
			// params (?debug=1) ride along on link hrefs.
			Array.from(links)
				.find((link) => new URL(link.href).pathname === target)
				?.focus();
		};
	}, [sectionPath]);

	// Escape closes the panel — unless the nav is open (its own listener
	// takes that press) or something inside the panel already claimed it.
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || event.defaultPrevented || navOpen) {
				return;
			}
			close();
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [navOpen, close]);

	// On open (client navigation and cold load alike), move focus into the
	// dialog so keyboard users start at the title, not behind the scrim.
	useEffect(() => {
		panelRef.current?.focus();
	}, []);

	// The page behind must not scroll while a panel is open. A removed
	// classic scrollbar widens BOTH boxes things are laid out against, so
	// two compensations: root padding keeps the in-flow scene from
	// shifting, and --scroll-lock-gap is consumed by everything positioned
	// against the viewport (the nav chrome's right offset, this panel's
	// desktop right padding) so the fixed layer doesn't jump either.
	useEffect(() => {
		const root = document.documentElement;
		const scrollbarWidth = window.innerWidth - root.clientWidth;
		const previousOverflow = root.style.overflow;
		const previousPaddingRight = root.style.paddingRight;
		root.style.overflow = "hidden";
		if (scrollbarWidth > 0) {
			root.style.paddingRight = `${scrollbarWidth}px`;
			root.style.setProperty("--scroll-lock-gap", `${scrollbarWidth}px`);
		}
		return () => {
			root.style.overflow = previousOverflow;
			root.style.paddingRight = previousPaddingRight;
			root.style.removeProperty("--scroll-lock-gap");
		};
	}, []);

	return (
		<div className="fixed inset-0 z-40 md:flex md:items-center md:justify-center md:py-6 md:pl-6 md:pr-[calc(1.5rem+var(--scroll-lock-gap,0px))]">
			{/* Pointer-only redundant affordance: the close button and Escape
			    are the accessible close paths, so this stays aria-hidden and
			    unfocusable. */}
			<div
				aria-hidden="true"
				onClick={close}
				className="absolute inset-0 hidden bg-foreground/40 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150 md:block"
			/>
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				tabIndex={-1}
				style={
					{
						"--panel-max-width": PANEL_MAX_WIDTH,
						"--panel-max-height": PANEL_MAX_HEIGHT,
					} as CSSProperties
				}
				className="relative flex h-full w-full flex-col overflow-hidden bg-background outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-150 md:h-auto md:max-h-(--panel-max-height) md:max-w-(--panel-max-width) md:rounded-xl md:border md:shadow-xl"
			>
				<header className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 md:px-8 md:pt-8">
					<h1 id={titleId} className="text-2xl font-semibold">
						{title}
					</h1>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label="Close"
						onClick={close}
						// Pull the icon into the panel's corner radius so the
						// visual close target sits in the top-right corner.
						className="-mt-1 -mr-2 text-muted-foreground hover:text-foreground"
					>
						<X />
					</Button>
				</header>
				<div className="flex-1 overflow-y-auto px-6 pb-6 md:px-8 md:pb-8">
					{children}
				</div>
			</div>
		</div>
	);
}
