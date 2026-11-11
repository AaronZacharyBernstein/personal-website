/**
 * The slice of the Workers runtime module this app uses, declared by hand.
 *
 * `wrangler types` could generate this, but its output is the whole Workers
 * global surface laid over a project that also loads the DOM lib, and it
 * would type the secret as always present. Optional is the honest type: the
 * token is missing in any environment where nobody has set it, and that
 * branch has to exist. Worth switching to generated types once the Worker
 * has real bindings; delete this file then.
 *
 * A script file on purpose (no top-level import or export), so the
 * declaration is ambient.
 */
declare module "cloudflare:workers" {
	export const env: {
		/** Set with `.dev.vars` locally and `wrangler secret put` in production. */
		readonly GITHUB_TOKEN?: string;
	};
	/** Keeps the Worker alive until the promise settles, after the response. */
	export function waitUntil(promise: Promise<unknown>): void;
}
