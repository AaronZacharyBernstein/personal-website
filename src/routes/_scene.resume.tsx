import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { SectionPanel } from "#/components/section-panel";
import { sectionLabel } from "#/config/scene";
import { PROJECTS, type Project } from "#/content/projects";
import {
	RESUME_CONTACT,
	RESUME_META,
	RESUME_PROJECT_IDS,
	RESUME_SKILLS,
} from "#/content/resume";
import {
	formatDateRange,
	formatMonthYear,
	type SchoolEntry,
	TIMELINE,
	type WorkEntry,
	workEntrySpan,
} from "#/content/timeline";

const schoolEntries = TIMELINE.filter(
	(entry): entry is SchoolEntry => entry.kind === "school",
);
const workEntries = TIMELINE.filter(
	(entry): entry is WorkEntry => entry.kind === "work",
);

/**
 * The printed page's PROJECTS section, resolved from the ordered id list.
 * An id with no matching project drops out rather than crashing SSR.
 */
const resumeProjects = RESUME_PROJECT_IDS.map((id) =>
	PROJECTS.find((project) => project.id === id),
).filter((project): project is Project => project !== undefined);

const school = schoolEntries[0];
const currentJob = workEntries[0];

/** Derived from the resume data itself, so it tracks the document. */
const META_DESCRIPTION =
	school !== undefined && currentJob !== undefined
		? `Resume of ${RESUME_CONTACT.name} — ${school.degree} student at ${school.organization} and ${currentJob.positions[0].title} at ${currentJob.organization}.`
		: `Resume of ${RESUME_CONTACT.name} — education, skills, experience, and projects.`;

export const Route = createFileRoute("/_scene/resume")({
	head: () => ({
		meta: [
			{ title: sectionLabel("/resume") },
			{ name: "description", content: META_DESCRIPTION },
		],
	}),
	component: ResumeSection,
});

/** Same on the server and every client, so hydration never disagrees. */
const lastUpdatedLabel = new Intl.DateTimeFormat("en-US", {
	dateStyle: "long",
	timeZone: "UTC",
}).format(new Date(RESUME_META.lastUpdated));

/**
 * Quiet document links: a hairline underline that inks in on hover. The
 * resume is monochrome, so links are distinguished by the underline alone,
 * never by an accent color.
 */
const LINK_CLASS =
	"underline decoration-muted-foreground underline-offset-[3px] transition-colors hover:decoration-current";
const MUTED_LINK_CLASS = `${LINK_CLASS} hover:text-foreground`;

function ExternalLink({
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

/**
 * Contact details in the PDF's own two-line grouping — reach-me first
 * (phone · email · location), then profiles (linkedin · github · site) —
 * rather than one long line wrapping wherever it runs out of room. Each
 * line centers independently. Within a line, each item renders glued to
 * its trailing separator dot inside one nowrap flex child, so a wrapped
 * row can end with a dot but never start with one.
 */
const CONTACT_LINES: Array<{
	key: string;
	items: Array<{ key: string; node: ReactNode }>;
}> = [
	{
		key: "reach",
		items: [
			{
				key: "phone",
				node: (
					// tel: link on every platform — desktop handlers (FaceTime,
					// Phone Link) exist too, so no branching.
					<a href={RESUME_CONTACT.phone.url} className={MUTED_LINK_CLASS}>
						{RESUME_CONTACT.phone.label}
					</a>
				),
			},
			{
				key: "email",
				node: (
					<a
						href={`mailto:${RESUME_CONTACT.email}`}
						className={MUTED_LINK_CLASS}
					>
						{RESUME_CONTACT.email}
					</a>
				),
			},
			{ key: "location", node: RESUME_CONTACT.location },
		],
	},
	{
		key: "profiles",
		items: [
			{
				key: "linkedin",
				node: (
					<ExternalLink
						href={RESUME_CONTACT.linkedin.url}
						className={MUTED_LINK_CLASS}
					>
						{RESUME_CONTACT.linkedin.label}
					</ExternalLink>
				),
			},
			{
				key: "github",
				node: (
					<ExternalLink
						href={RESUME_CONTACT.github.url}
						className={MUTED_LINK_CLASS}
					>
						{RESUME_CONTACT.github.label}
					</ExternalLink>
				),
			},
			// Unlinked on purpose: the reader is already here.
			{ key: "website", node: RESUME_CONTACT.website },
		],
	},
];

/**
 * Tracked-out caps on a running hairline — the document's skeleton. Weight
 * and the rule carry the hierarchy; no boxes, no cards.
 */
function SectionHeading({ children }: { children: ReactNode }) {
	return (
		<div className="flex items-center gap-3">
			<h3 className="text-xs font-semibold uppercase tracking-[0.15em]">
				{children}
			</h3>
			<div aria-hidden="true" className="h-px flex-1 bg-border" />
		</div>
	);
}

/** Org + location left, dates right on desktop; stacked below sm. */
function EntryHeader({
	organization,
	location,
	dates,
}: {
	organization: string;
	location: string;
	dates: string;
}) {
	return (
		<div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between sm:gap-x-6">
			<p className="text-sm">
				<span className="font-semibold">{organization}</span>
				<span className="text-muted-foreground">, {location}</span>
			</p>
			<p className="text-sm text-muted-foreground tabular-nums">{dates}</p>
		</div>
	);
}

function BulletList({ bullets }: { bullets: string[] }) {
	return (
		<ul className="list-disc space-y-1 pl-4 marker:text-muted-foreground">
			{bullets.map((bullet) => (
				<li key={bullet} className="text-sm">
					{bullet}
				</li>
			))}
		</ul>
	);
}

/** "a, b and c" — the PDF's own list punctuation (no Oxford comma). */
function joinWithAnd(items: string[]): string {
	const last = items.at(-1);
	if (last === undefined) {
		return "";
	}
	if (items.length === 1) {
		return last;
	}
	return `${items.slice(0, -1).join(", ")} and ${last}`;
}

/** "https://github.com/x/y" → "github.com/x/y", the document-style label. */
function stripProtocol(url: string): string {
	return url.replace(/^https?:\/\//, "");
}

function educationDates(entry: SchoolEntry): string {
	const graduation = formatMonthYear(entry.endDate);
	return entry.anticipatedEnd
		? `Anticipated graduation: ${graduation}`
		: graduation;
}

function ResumeSection() {
	return (
		<SectionPanel title={sectionLabel(Route.fullPath)}>
			<article>
				{/* Centered like the printed page; every section below stays
				    left-aligned. */}
				<header className="text-center">
					<h2 className="text-3xl font-semibold tracking-tight">
						{RESUME_CONTACT.name}
					</h2>
					<div className="mt-2 space-y-0.5 text-sm text-muted-foreground">
						{CONTACT_LINES.map((line) => (
							<p
								key={line.key}
								className="flex flex-wrap justify-center gap-x-2 gap-y-0.5"
							>
								{line.items.map((item, index) => (
									<span key={item.key} className="whitespace-nowrap">
										{item.node}
										{index < line.items.length - 1 && (
											<span aria-hidden="true" className="ml-2">
												·
											</span>
										)}
									</span>
								))}
							</p>
						))}
					</div>
					{/* Secondary by design: recruiters want the file, but the
					    document on this page is the primary artifact — so it sits
					    under the contact block instead of competing with the name
					    for the header row. */}
					<p className="mt-3">
						<a
							href={RESUME_META.pdfPath}
							download
							className={`text-sm text-muted-foreground ${MUTED_LINK_CLASS}`}
						>
							Download PDF
						</a>
					</p>
				</header>

				<div className="mt-7 space-y-7">
					<section className="space-y-3">
						<SectionHeading>Education</SectionHeading>
						{schoolEntries.map((entry) => (
							<div
								key={`${entry.organization}-${entry.startDate}`}
								className="space-y-1"
							>
								<EntryHeader
									organization={entry.organization}
									location={entry.location}
									dates={educationDates(entry)}
								/>
								<p className="text-sm font-medium">
									{entry.degree}
									{entry.minor !== null && `, Minor in ${entry.minor}`}
									{entry.gpa !== null && (
										<span className="font-normal text-muted-foreground">
											{" "}
											· GPA: {entry.gpa}
										</span>
									)}
								</p>
								{entry.coursework.length > 0 && (
									<p className="text-sm">
										<span className="font-medium">Relevant Coursework:</span>{" "}
										{joinWithAnd(entry.coursework)}
									</p>
								)}
								{entry.honors.length > 0 && (
									<p className="text-sm">
										<span className="font-medium">Honors:</span>{" "}
										{entry.honors.join("; ")}
									</p>
								)}
							</div>
						))}
					</section>

					<section className="space-y-3">
						<SectionHeading>Skills</SectionHeading>
						{/* Label:value lines, not a list — and preflight's
						    list-style:none would strip list semantics anyway. */}
						<div className="space-y-1">
							{RESUME_SKILLS.map((group) => (
								<p key={group.label} className="text-sm">
									<span className="font-semibold">{group.label}:</span>{" "}
									{group.items.join(", ")}
								</p>
							))}
						</div>
					</section>

					<section className="space-y-4">
						<SectionHeading>Experience</SectionHeading>
						{workEntries.map((entry) => {
							const span = workEntrySpan(entry);
							// Org+date: a later return to the same organization is a
							// second entry, so the org name alone is not unique.
							return (
								<div
									key={`${entry.organization}-${span.startDate}`}
									className="space-y-2"
								>
									<EntryHeader
										organization={entry.organization}
										location={entry.location}
										dates={formatDateRange(span.startDate, span.endDate)}
									/>
									<div className="space-y-2.5">
										{entry.positions.map((position) => (
											<div
												key={`${position.title}-${position.startDate}`}
												className="space-y-1"
											>
												<p className="text-sm italic">
													{position.title}
													{/* A lone position inherits the org dates above,
													    exactly as the printed page omits them. */}
													{entry.positions.length > 1 &&
														` (${formatDateRange(position.startDate, position.endDate)})`}
												</p>
												<BulletList bullets={position.bullets} />
											</div>
										))}
									</div>
								</div>
							);
						})}
					</section>

					<section className="space-y-4">
						<SectionHeading>Projects</SectionHeading>
						{resumeProjects.map((project) => (
							<div key={project.id} className="space-y-1">
								<p className="text-sm">
									{project.liveUrl !== undefined ? (
										<ExternalLink
											href={project.liveUrl}
											className={`font-semibold ${LINK_CLASS}`}
										>
											{project.name}
										</ExternalLink>
									) : (
										<span className="font-semibold">{project.name}</span>
									)}
									{project.repoUrl !== undefined && (
										// wrap:anywhere — the bare repo path is one unbroken
										// token wider than a phone; let it break mid-path
										// rather than force a horizontal scroll.
										<span className="text-muted-foreground [overflow-wrap:anywhere]">
											{" ("}
											<ExternalLink
												href={project.repoUrl}
												className={MUTED_LINK_CLASS}
											>
												{stripProtocol(project.repoUrl)}
											</ExternalLink>
											{")"}
										</span>
									)}
								</p>
								<BulletList bullets={project.bullets} />
							</div>
						))}
					</section>
				</div>

				<p className="mt-8 text-xs text-muted-foreground">
					Last updated {lastUpdatedLabel}
				</p>
			</article>
		</SectionPanel>
	);
}
