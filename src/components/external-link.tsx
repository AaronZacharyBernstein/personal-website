import type { ReactNode } from "react";

/**
 * A link that leaves the site: always a new tab, always
 * `rel="noopener noreferrer"`, so no call site can forget either.
 */
export function ExternalLink({
	href,
	className,
	children,
}: {
	href: string;
	className?: string;
	children: ReactNode;
}) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className={className}
		>
			{children}
		</a>
	);
}
