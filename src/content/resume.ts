export interface ResumeMeta {
	/** Path under /public, e.g. "/resume.pdf". */
	pdfPath: string;
	/** ISO date "YYYY-MM-DD". */
	lastUpdated: string;
}

/** Null until a resume PDF is published. */
export const RESUME_META: ResumeMeta | null = null;
