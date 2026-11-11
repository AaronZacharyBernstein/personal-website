import {
	INTRO_CLASS,
	INTRO_FAILSAFE_KEYFRAMES,
	INTRO_PARAM,
	INTRO_PENDING_CLASS,
	INTRO_STORAGE_KEY,
} from "#/config/intro";
import { DESKTOP_MEDIA_QUERY } from "#/config/scene";

const quote = (value: string) => JSON.stringify(value);

/**
 * Runs in <head>, before first paint, on every page load. The server always
 * renders the finished board, so if the intro only started after hydration
 * the visitor would see the whole board, watch it vanish, then watch it
 * drop back in. This script decides — before anything is painted — whether
 * the intro will play, and if so puts two classes on <html> that the
 * stylesheet uses to hold the items back until the timeline takes over.
 *
 * It touches nothing but those classes and the session flag. React never
 * reads either while rendering, so server and client markup cannot differ.
 *
 * In order:
 *   - read and set the once-per-session flag (set on EVERY load, so a
 *     session that began on a section page never gets a late intro; if
 *     storage is unavailable the read fails closed to "not played");
 *   - bail unless this is the board itself, at desktop width, with motion
 *     allowed, and not under a dev tool;
 *   - add the classes;
 *   - any pointerdown or keydown before the timeline exists skips straight
 *     to the finished board by removing them again;
 *   - when the CSS failsafe has run (JavaScript failed or was too slow),
 *     remove them, so class presence always means "intro still owed". Only
 *     while the hold is still on: if the timeline took over just as the
 *     failsafe's delay ran out, its queued animationend must not strip the
 *     `intro` class out from under the running timeline.
 *
 * No comments in the string itself: ScriptOnce appends a statement to it.
 */
export const INTRO_BOOT = `(function(){try{var c=document.documentElement.classList,q=location.search,f=/[?&]${INTRO_PARAM}=/.test(q),s=false;try{s=sessionStorage.getItem(${quote(INTRO_STORAGE_KEY)})==="1";sessionStorage.setItem(${quote(INTRO_STORAGE_KEY)},"1")}catch(e){}if(s&&!f)return;if(location.pathname!=="/")return;if(!f&&/[?&](debug|calibrate)=/.test(q))return;if(!matchMedia(${quote(DESKTOP_MEDIA_QUERY)}).matches||matchMedia("(prefers-reduced-motion: reduce)").matches)return;var off=function(){c.remove(${quote(INTRO_CLASS)},${quote(INTRO_PENDING_CLASS)})};c.add(${quote(INTRO_CLASS)},${quote(INTRO_PENDING_CLASS)});addEventListener("pointerdown",off,{capture:true,once:true});addEventListener("keydown",off,{capture:true,once:true});addEventListener("animationend",function(e){if(e.animationName===${quote(INTRO_FAILSAFE_KEYFRAMES)}&&c.contains(${quote(INTRO_PENDING_CLASS)}))off()})}catch(e){}})()`;
