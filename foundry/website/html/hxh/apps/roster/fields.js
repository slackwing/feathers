/* One source for the names of things: the profile fields (labels shown
   in the character window AND as the list's column headers) and the
   picture categories (gallery sections AND the list's Pics counts).
   Nothing else spells these out. */
export const FIELDS = [
  ["card_number", "No."], ["name", "Name"], ["name_ja", "Japanese"], ["first", "Short"], ["rank", "Card Rank"], ["nen_types", "Nen"],
  ["affiliation", "Affiliation"], ["arcs", "Arcs"], ["arms", "Arms"], ["description", "Description"], ["card_description", "Card description"], ["notes", "Notes"],
];
/* fields a bot may change on an accepted card without reopening review: text fixes are self-approved (Andrew, 2026-09-22) */
export const AUTO_ACCEPTED = ["name", "first", "description", "card_description"];
/* the two picture slots a card needs: avatar 1:1, card illustration 16:9 (the Greed Island card's picture window) */
export const AVATAR_RATIO = 1, CARD_RATIO = 16 / 9;
export const CARD_RATIO_LABEL = "16:9";
export const LABEL = Object.fromEntries(FIELDS);
/* type key → label; the order is the gallery order and the Pics column order */
export const TYPES = [["raw", "Random"], ["uploaded", "Uploaded"], ["cropped", "Edited"], ["pixelated", "Pixel art"], ["upscaled", "Upscaled"], ["transparent", "Transparent"]];
export const TYPE_LABEL = Object.fromEntries(TYPES);
/* review states in the order the list sorts them. Requests are not a state (Andrew, 2026-09-21): a character
   keeps its verdict while requests are open; open_requests is a count shown beside the chip. */
export const STATUSES = [["pending", "Pending"], ["accepted", "Accepted"], ["rejected", "Rejected"], ["skipped", "Skipped"]];
/* skipped: a stub the bot filed for a character deliberately left out — hidden from the default view, frozen in the window */
export const STATUS_ORDER = Object.fromEntries(STATUSES.map(([s], i) => [s, i]));
