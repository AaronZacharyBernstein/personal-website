export interface SocialLink {
	platform: string;
	handle: string;
	url: string;
	category: "professional" | "personal";
}

export const SOCIAL_LINKS: SocialLink[] = [];
