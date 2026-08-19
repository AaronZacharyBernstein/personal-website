/**
 * Resume-specific content only. Experience and education live in timeline.ts
 * (shared with /timeline and /education) and the project entries live in
 * projects.ts — this file holds what exists solely because the resume is a
 * document: the contact header, the skills lines, the PDF, and which
 * projects the printed page lists.
 *
 * Contact and skills are transcribed verbatim from public/resume.pdf.
 */

interface ContactLink {
	/** As printed on the PDF, e.g. "github.com/AaronZacharyBernstein". */
	label: string;
	url: string;
}

export interface ResumeContact {
	name: string;
	/** label as printed ("925-899-8925"), url in E.164 ("tel:+19258998925"). */
	phone: ContactLink;
	email: string;
	/** As printed, e.g. "Walnut Creek, CA". */
	location: string;
	linkedin: ContactLink;
	github: ContactLink;
	/** Displayed but never linked — the reader is already on it. */
	website: string;
}

export const RESUME_CONTACT: ResumeContact = {
	name: "Aaron Bernstein",
	phone: {
		label: "925-899-8925",
		url: "tel:+19258998925",
	},
	email: "aaronbernstein2005@gmail.com",
	location: "Walnut Creek, CA",
	linkedin: {
		label: "linkedin.com/in/AaronZacharyBernstein",
		url: "https://www.linkedin.com/in/AaronZacharyBernstein",
	},
	github: {
		label: "github.com/AaronZacharyBernstein",
		url: "https://github.com/AaronZacharyBernstein",
	},
	website: "AaronBernstein.org",
};

export interface SkillGroup {
	/** Printed line label, e.g. "Languages". */
	label: string;
	/**
	 * Items keep the PDF's own grouping — "Cloudflare Workers and D1" is one
	 * item there, so it is one item here.
	 */
	items: string[];
}

export const RESUME_SKILLS: SkillGroup[] = [
	{ label: "Languages", items: ["C", "Java", "Python", "SQL"] },
	{
		label: "Technologies",
		items: [
			"TypeScript",
			"React",
			"Node.js",
			"Cloudflare Workers and D1",
			"Drizzle ORM",
			"tRPC",
			"PyTorch",
			"pandas",
			"scikit-learn",
		],
	},
	{
		label: "Tools",
		items: ["Git/GitHub", "Claude Code", "VS Code", "Linux/Unix CLI"],
	},
];

/**
 * The printed page's PROJECTS section, as an ordered list of projects.ts
 * ids — explicit, so adding a project to the site never silently adds it to
 * the resume.
 */
export const RESUME_PROJECT_IDS: readonly string[] = [
	"bluelinetradinggroup",
	"march-madness-model",
];

export interface ResumeMeta {
	/** Path under /public, e.g. "/resume.pdf". */
	pdfPath: string;
	/** ISO date "YYYY-MM-DD". */
	lastUpdated: string;
}

export const RESUME_META: ResumeMeta = {
	pdfPath: "/resume.pdf",
	lastUpdated: "2026-08-18",
};
