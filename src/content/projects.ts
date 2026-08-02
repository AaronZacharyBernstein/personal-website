export interface Project {
	name: string;
	description: string;
	techStack: string[];
	repoUrl: string;
	liveUrl?: string;
	year: number;
}

export const PROJECTS: Project[] = [];
