export interface Project {
	/** Stable slug other content references (e.g. RESUME_PROJECT_IDS). */
	id: string;
	name: string;
	/** One plain sentence for the /projects view; not resume wording. */
	description: string;
	/**
	 * Achievement bullets transcribed verbatim from public/resume.pdf, shared
	 * by /resume and the future /projects view so they cannot drift.
	 */
	bullets: string[];
	techStack: string[];
	/** Absent when there is no public repo. */
	repoUrl?: string;
	liveUrl?: string;
	/** Not printed on the resume; filled in during the projects phase. */
	year?: number;
}

export const PROJECTS: Project[] = [
	{
		id: "bluelinetradinggroup",
		name: "BlueLineTradingGroup.com",
		description: "Production website for a plumbing supply distributor.",
		bullets: [
			"Designed and shipped a five-page site for a plumbing supply distributor, replacing an aging WordPress build; live in production as the company's website",
			"Hardened the contact API with server-side validation, a strict field allowlist, IP-based rate limiting, and a honeypot, then ran a file-by-file security audit that surfaced an email header injection vector (CRLF sequences reaching the subject line) and a spoofable rate-limit bypass, fixing both",
			"Built the inquiry pipeline end to end: a Next.js API route that validates and sanitizes submissions before relaying them over authenticated SMTP through a dedicated sending account",
		],
		techStack: ["Next.js"],
		liveUrl: "https://bluelinetradinggroup.com",
	},
	{
		id: "march-madness-model",
		name: "March Madness model",
		description:
			"Predicts NCAA tournament champions from advanced team metrics.",
		bullets: [
			"Assembled a 17-season dataset (2008-2025, 544 tournament teams) of advanced college basketball metrics from public analytics sources including BartTorvik and KenPom",
			"Built leave-one-season-out cross-validation against a seed-only baseline, which revealed the initial 22-feature random forest ranked the eventual champion first in only 4 of 17 held-out seasons",
			"Cut to six features, normalized each stat within its own season to remove era effects, and replaced a forest with regularized logistic regression, raising top-1 accuracy to 8/17 and top-3 to 14/17 against baselines of 5 and 12",
		],
		// The resume names no stack for this project; fill in the projects phase.
		techStack: [],
		repoUrl: "https://github.com/AaronZacharyBernstein/MarchMadnessModel",
	},
];
