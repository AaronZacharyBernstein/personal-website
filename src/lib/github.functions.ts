import { createServerFn } from "@tanstack/react-start";
import { loadGithubProfile } from "./github.server";

/**
 * The GitHub panel's data. Safe to import anywhere: on the client the Start
 * compiler replaces the handler with an RPC stub and drops the import of
 * github.server with it, so neither the fetching code nor the token's name
 * reaches the browser.
 */
export const getGithubProfile = createServerFn({ method: "GET" }).handler(() =>
	loadGithubProfile(),
);
