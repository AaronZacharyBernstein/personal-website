/**
 * One list, three consumers. The scene splits the timeline across two boards
 * — the chalkboard ("MY CAREER PATH") routes to /timeline and the whiteboard
 * ("my education") routes to /education — and /resume renders both halves as
 * a document. All three read this array, so the discriminator is load-bearing
 * for routing, not decorative: an entry with the wrong `kind` shows up under
 * the wrong section. A discriminated union (not optional fields) keeps the
 * shapes honest — a work entry cannot carry a GPA, and a school entry cannot
 * carry positions.
 *
 * Every dated string, title, and bullet below is transcribed verbatim from
 * public/resume.pdf. Do not "fix" wording here without changing the PDF too.
 */

interface TimelineEntryBase {
	organization: string;
	/** As printed on the resume, e.g. "San Jose, CA". */
	location: string;
}

/** One position held during a work stint. */
export interface WorkPosition {
	title: string;
	/** ISO "YYYY-MM". */
	startDate: string;
	/** ISO "YYYY-MM", or null while ongoing. */
	endDate: string | null;
	bullets: string[];
}

export interface WorkEntry extends TimelineEntryBase {
	/** "work" → /timeline. */
	kind: "work";
	/**
	 * Newest first, matching the document. At least one — the org-level date
	 * range is derived from these (see workEntrySpan), never stored, so the
	 * two can't drift.
	 */
	positions: [WorkPosition, ...WorkPosition[]];
}

export interface SchoolEntry extends TimelineEntryBase {
	/** "school" → /education. */
	kind: "school";
	/**
	 * ISO "YYYY-MM". Not printed on the resume (it shows only the graduation
	 * date); inferred from the first Dean's List term and used only to order
	 * the timeline, never rendered on /resume.
	 */
	startDate: string;
	/**
	 * ISO "YYYY-MM". Never null: an in-progress degree still has an
	 * anticipated graduation date, which is what `anticipatedEnd` flags.
	 */
	endDate: string;
	/** True while endDate is a projected graduation rather than a past date. */
	anticipatedEnd: boolean;
	degree: string;
	minor: string | null;
	/** Kept as the printed string so "3.46" can never re-format to "3.5". */
	gpa: string | null;
	coursework: string[];
	honors: string[];
}

export type TimelineEntry = WorkEntry | SchoolEntry;

/** Newest first by start date, mixed kinds; each consumer filters on `kind`. */
export const TIMELINE: TimelineEntry[] = [
	{
		kind: "work",
		organization: "Snapback Sports",
		location: "New York City, NY",
		positions: [
			{
				title: "Software Engineer, Part-Time",
				startDate: "2026-08",
				endDate: null,
				bullets: [
					"Maintain the Snapback games hub in production, handling upkeep and fixes across the platform’s seven games",
					"Serve as the primary tester for new products ahead of release, writing detailed feedback reports",
					"Add value in the eyes of sponsors/partners by creating websites specific to Snapback’s partnerships",
				],
			},
			{
				title: "AI Intern",
				startDate: "2026-06",
				endDate: "2026-07",
				bullets: [
					"Shipped a four-game daily sports trivia platform as sole engineer on React Router v7, Cloudflare Workers, and Drizzle ORM over D1, then integrated it into a seven-game hub unifying all intern-built games under one login",
					"Co-built and launched a college football gameday review platform (TanStack Start, Cloudflare Workers, D1, R2) with a three-person team, reaching 100+ users within a week of launch",
					"Managed and created videos and social media posts, generating 24 million impressions across all platforms promoting the internship program and products we shipped",
				],
			},
		],
	},
	{
		kind: "work",
		organization: "Alphawave Semi",
		location: "San Jose, CA",
		positions: [
			{
				title: "Semiconductor chip testing intern",
				startDate: "2025-07",
				endDate: "2025-08",
				bullets: [
					"Performed environmental stress testing on semiconductor chips, validating chip performance under different conditions to verify and track failure points",
					"Analyzed and documented error logs within Excel, categorizing errors to assist senior engineers in debugging and analysis",
				],
			},
		],
	},
	{
		kind: "school",
		organization: "Penn State University",
		location: "State College, PA",
		startDate: "2024-08",
		endDate: "2027-05",
		anticipatedEnd: true,
		degree: "Bachelor of Science in Computer Science",
		minor: "AI Engineering",
		gpa: "3.46",
		coursework: [
			"Data Structures & Algorithms",
			"Machine Learning & AI",
			"Systems Programming",
			"Object-Oriented Programming with Web Applications",
			"Programming Language Concepts",
			"Computer Organization & Design",
			"Discrete Mathematics",
			"Probability & Statistics",
			"Exploratory Data Mining",
			"Theory of Computation",
		],
		honors: ["Dean's List (Fall 2024, Spring 2025, Fall 2025)"],
	},
];

/**
 * UTC-pinned so the label is the same on the server and every client — a
 * "YYYY-MM" parsed as UTC midnight would otherwise render as the previous
 * month in western-hemisphere timezones.
 */
const MONTH_YEAR = new Intl.DateTimeFormat("en-US", {
	month: "long",
	year: "numeric",
	timeZone: "UTC",
});

/** "2026-06" → "June 2026". */
export function formatMonthYear(isoMonth: string): string {
	return MONTH_YEAR.format(new Date(`${isoMonth}-01T00:00:00Z`));
}

/** "2026-06", null → "June 2026 – Present". */
export function formatDateRange(
	startDate: string,
	endDate: string | null,
): string {
	const end = endDate === null ? "Present" : formatMonthYear(endDate);
	return `${formatMonthYear(startDate)} – ${end}`;
}

/**
 * A work stint's overall range, derived from its positions: earliest start,
 * and null (ongoing) if any position is ongoing. "YYYY-MM" strings compare
 * chronologically, so plain string comparison is safe.
 */
export function workEntrySpan(entry: WorkEntry): {
	startDate: string;
	endDate: string | null;
} {
	let startDate = entry.positions[0].startDate;
	let endDate: string | null = entry.positions[0].endDate;
	for (const position of entry.positions) {
		if (position.startDate < startDate) {
			startDate = position.startDate;
		}
		if (
			endDate !== null &&
			(position.endDate === null || position.endDate > endDate)
		) {
			endDate = position.endDate;
		}
	}
	return { startDate, endDate };
}
