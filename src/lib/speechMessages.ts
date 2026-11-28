/** User-facing copy for the voice pipeline, kept in one place. */

/** Shown when the whole utterance was filler, noise or unknown speech. */
export const NO_PRODUCT_MESSAGE = "No recognizable grocery product found. Please try again.";

/** Spoken list ended with a connector ("…aur 3 kilo sugar aur") — harmless. */
export const DROPPED_CONNECTOR_MESSAGE =
  "Heard you — I’ll add the next item when you carry on speaking.";

/** Nothing has been said for a while but the microphone is still open. */
export const IDLE_SESSION_MESSAGE = "Still listening — speak whenever you’re ready.";
