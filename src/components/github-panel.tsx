import { Star } from "lucide-react";
import { ExternalLink } from "#/components/external-link";
import { SOCIALS } from "#/content/socials";
import type { GithubPinnedRepo, GithubProfile } from "#/lib/github.types";
import { cn } from "#/lib/utils.ts";

/**
 * GitHub's own contribution ramp, so the grid reads at a glance as a GitHub
 * graph. Local to this panel, not theme tokens. The empty level borrows the
 * theme's border colour: GitHub's cool grey all but vanishes on the warm
 * panel.
 */
const LEVEL_COLORS = [
	"var(--border)",
	"#9be9a8",
	"#40c463",
	"#30a14e",
	"#216e39",
] as const;

const LINK_CLASS =
	"underline decoration-muted-foreground underline-offset-[3px] hover:decoration-current";

/** Days in a week, and so rows in the grid. */
const ROWS = 7;

function gridColumns(firstWeekday: number, days: number): number {
	return Math.max(1, Math.ceil((firstWeekday + days) / ROWS));
}

/**
 * The contribution calendar: one column per week, Sunday at the top, filled
 * column by column. Fluid — the squares share the panel's width — so a
 * year fits a phone without scrolling sideways.
 */
function ContributionGrid({
	levels,
	firstWeekday,
	label,
	className,
}: {
	/** One character per day, "0".."4". */
	levels: string;
	/** 0 (Sunday) to 6: the row the first day starts on. */
	firstWeekday: number;
	label?: string;
	className?: string;
}) {
	const grid = {
		className: cn(
			"grid grid-flow-col grid-rows-7 gap-[2px] sm:gap-[3px]",
			className,
		),
		style: {
			gridTemplateColumns: `repeat(${gridColumns(firstWeekday, levels.length)}, minmax(0, 1fr))`,
		},
	};
	const squares = Array.from(levels, (level, index) => (
		<span
			// biome-ignore lint/suspicious/noArrayIndexKey: the calendar is a fixed run of days; a square's position is its identity
			key={index}
			className="aspect-square rounded-[1px] sm:rounded-[2px]"
			style={{
				backgroundColor: LEVEL_COLORS[Number(level)] ?? LEVEL_COLORS[0],
				// The first day starts partway down the first column.
				gridRowStart: index === 0 ? firstWeekday + 1 : undefined,
			}}
		/>
	));
	// With a label the grid is one image to a screen reader; without one
	// (the loading placeholder) it is hidden from it altogether.
	return label ? (
		<div role="img" aria-label={label} {...grid}>
			{squares}
		</div>
	) : (
		<div aria-hidden="true" {...grid}>
			{squares}
		</div>
	);
}

/** Two across for 2 or 4 repos, three across for 3, 5 or 6: no orphan card. */
function repoColumns(count: number): string {
	if (count <= 1) {
		return "sm:max-w-md";
	}
	return count === 2 || count === 4
		? "sm:grid-cols-2"
		: "sm:grid-cols-2 md:grid-cols-3";
}

function RepoCard({ repo }: { repo: GithubPinnedRepo }) {
	return (
		<ExternalLink
			href={repo.url}
			className="flex h-full flex-col gap-2 rounded-lg border p-4 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-muted-foreground focus-visible:outline-none"
		>
			<span className="flex items-start justify-between gap-3">
				<span className="font-medium [overflow-wrap:anywhere]">
					{repo.name}
				</span>
				<span className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground tabular-nums">
					<Star aria-hidden="true" className="size-3.5" />
					{repo.stars}
					<span className="sr-only">
						{repo.stars === 1 ? " star" : " stars"}
					</span>
				</span>
			</span>
			{repo.description ? (
				<span className="text-sm text-muted-foreground">
					{repo.description}
				</span>
			) : null}
			{repo.language ? (
				<span className="mt-auto flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
					{repo.language.color ? (
						<span
							aria-hidden="true"
							className="size-2.5 rounded-full"
							style={{ backgroundColor: repo.language.color }}
						/>
					) : null}
					{repo.language.name}
				</span>
			) : null}
			<span className="sr-only"> (opens in a new tab)</span>
		</ExternalLink>
	);
}

/** The loaded panel: graph with the avatar at its centre, pinned repos, footer. */
export function GithubProfileView({ profile }: { profile: GithubProfile }) {
	const { calendar, pinned } = profile;
	// UTC, so the server render and every client agree on the weekday.
	const firstWeekday = calendar.start
		? new Date(`${calendar.start}T00:00:00Z`).getUTCDay()
		: 0;
	return (
		<div className="flex flex-col gap-6">
			<div className="relative">
				<ContributionGrid
					levels={calendar.levels}
					firstWeekday={firstWeekday}
					label={`${calendar.total.toLocaleString("en-US")} contributions in the past year`}
				/>
				{/* Decorative: the footer names the account. The ring is the
				    panel's own colour, so the avatar reads as set into the grid. */}
				<img
					src={profile.avatarUrl}
					alt=""
					width={80}
					height={80}
					className="absolute top-1/2 left-1/2 size-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background ring-4 ring-background sm:size-20"
				/>
			</div>

			{pinned.length > 0 ? (
				<ul className={cn("grid gap-3", repoColumns(pinned.length))}>
					{pinned.map((repo) => (
						<li key={repo.url}>
							<RepoCard repo={repo} />
						</li>
					))}
				</ul>
			) : null}

			<p className="text-sm text-muted-foreground">
				<ExternalLink
					href={profile.profileUrl}
					className={cn(LINK_CLASS, "text-foreground")}
				>
					@{profile.login}
				</ExternalLink>
				{" · "}joined {profile.joinedYear}
				{" · "}
				{profile.publicRepos} public{" "}
				{profile.publicRepos === 1 ? "repo" : "repos"}
			</p>
		</div>
	);
}

/** While the data is on its way: the grid's outline, so nothing jumps. */
export function GithubLoading() {
	return (
		<div className="flex flex-col gap-6">
			<ContributionGrid
				levels={"0".repeat(53 * ROWS)}
				firstWeekday={0}
				className="motion-safe:animate-pulse"
			/>
			<p className="text-sm text-muted-foreground">Loading GitHub activity…</p>
		</div>
	);
}

/**
 * No token, or GitHub could not be reached: the panel still has something
 * to say, and it is the one link that always works.
 */
export function GithubUnavailable() {
	return (
		<p className="text-muted-foreground">
			GitHub activity is not available right now. You can still see my work at{" "}
			<ExternalLink
				href={SOCIALS.github.url}
				className={cn(LINK_CLASS, "text-foreground")}
			>
				github.com/{SOCIALS.github.handle}
			</ExternalLink>
			.
		</p>
	);
}
