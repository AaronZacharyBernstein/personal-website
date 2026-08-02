export interface TimelineEntry {
	organization: string;
	role: string;
	/** ISO "YYYY-MM". */
	startDate: string;
	/** ISO "YYYY-MM", or null while ongoing. */
	endDate: string | null;
	kind: "school" | "work";
	bullets: string[];
}

export const TIMELINE: TimelineEntry[] = [];
