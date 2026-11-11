import { RESUME_CONTACT } from "./resume";

/**
 * The "Say hi" envelope and nav entry open Gmail's compose window with
 * these three values filled in. Edit the plain strings here; the URL below
 * encodes them, so no wording change can produce a broken link.
 */
export const SAY_HI_ADDRESS = RESUME_CONTACT.email;
export const SAY_HI_SUBJECT = "Website visitor";
export const SAY_HI_BODY = "Hi Aaron, I was checking out your website!";

export const SAY_HI_URL = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(SAY_HI_ADDRESS)}&su=${encodeURIComponent(SAY_HI_SUBJECT)}&body=${encodeURIComponent(SAY_HI_BODY)}`;
