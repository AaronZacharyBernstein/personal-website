/**
 * One list, two sections. The scene splits the timeline across two boards:
 * the chalkboard ("MY CAREER PATH") routes to /timeline and the whiteboard
 * ("my education") routes to /education. Both read this array and filter on
 * `kind`, so the discriminator is load-bearing for routing, not decorative —
 * an entry with the wrong `kind` shows up under the wrong section. The shared
 * fields stay defined once here rather than in two parallel types.
 */
export interface TimelineEntry {
	organization: string;
	role: string;
	/** ISO "YYYY-MM". */
	startDate: string;
	/** ISO "YYYY-MM", or null while ongoing. */
	endDate: string | null;
	/** "school" → /education, "work" → /timeline. */
	kind: "school" | "work";
	bullets: string[];
}

export const TIMELINE: TimelineEntry[] = [];
