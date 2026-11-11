import { createFileRoute } from "@tanstack/react-router";
import { Instagram, Linkedin } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { ExternalLink } from "#/components/external-link";
import { SectionPanel } from "#/components/section-panel";
import { PANEL_NARROW_MAX_WIDTH } from "#/config/panel";
import { sectionLabel } from "#/config/scene";
import { SOCIAL_LINKS, type SocialLink } from "#/content/socials";

export const Route = createFileRoute("/_scene/links")({
	head: () => ({ meta: [{ title: sectionLabel("/links") }] }),
	component: LinksSection,
});

/** The X mark; lucide has no icon for it. */
function XMark(props: SVGProps<SVGSVGElement>) {
	return (
		<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
			<path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
		</svg>
	);
}

const ICONS: Partial<
	Record<SocialLink["platform"], ComponentType<SVGProps<SVGSVGElement>>>
> = {
	LinkedIn: Linkedin,
	Instagram,
	X: XMark,
};

function LinksSection() {
	return (
		<SectionPanel
			title={sectionLabel(Route.fullPath)}
			maxWidth={PANEL_NARROW_MAX_WIDTH}
		>
			<ul className="flex flex-col gap-2">
				{SOCIAL_LINKS.map((link) => {
					const Icon = ICONS[link.platform];
					return (
						<li key={link.platform}>
							<ExternalLink
								href={link.url}
								className="flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-muted-foreground focus-visible:outline-none"
							>
								{Icon ? (
									<Icon aria-hidden="true" className="size-5 shrink-0" />
								) : null}
								<span className="font-medium">{link.platform}</span>
								{/* A long handle wraps rather than widening the row. */}
								<span className="ml-auto text-sm text-muted-foreground [overflow-wrap:anywhere]">
									@{link.handle}
								</span>
								<span className="sr-only"> (opens in a new tab)</span>
							</ExternalLink>
						</li>
					);
				})}
			</ul>
		</SectionPanel>
	);
}
