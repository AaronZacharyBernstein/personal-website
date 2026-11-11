/**
 * Every profile link the site shows, in one place. The /links panel lists
 * SOCIAL_LINKS; the resume's contact header and the GitHub panel read the
 * individual entries.
 */

export interface SocialLink {
	platform: "LinkedIn" | "Instagram" | "X" | "GitHub";
	/** Shown after an @, and never guessed: these are the real accounts. */
	handle: string;
	url: string;
}

export const GITHUB_USERNAME = "AaronZacharyBernstein";

export const SOCIALS = {
	linkedin: {
		platform: "LinkedIn",
		handle: "AaronZacharyBernstein",
		url: "https://www.linkedin.com/in/AaronZacharyBernstein",
	},
	instagram: {
		platform: "Instagram",
		handle: "aaron__bernstein",
		url: "https://www.instagram.com/aaron__bernstein/",
	},
	x: {
		platform: "X",
		handle: "aaronbernsteinq",
		url: "https://x.com/aaronbernsteinq",
	},
	github: {
		platform: "GitHub",
		handle: GITHUB_USERNAME,
		url: `https://github.com/${GITHUB_USERNAME}`,
	},
} as const satisfies Record<string, SocialLink>;

/**
 * The /links panel: the three on the board's "Socials" card, in the order
 * the card draws them. GitHub has its own item on the board, so it is not
 * repeated here.
 */
export const SOCIAL_LINKS: ReadonlyArray<SocialLink> = [
	SOCIALS.linkedin,
	SOCIALS.instagram,
	SOCIALS.x,
];
