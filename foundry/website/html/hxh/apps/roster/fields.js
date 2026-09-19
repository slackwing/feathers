/* One source for the names of things: the profile fields (labels shown
   in the character window AND as the list's column headers) and the
   picture categories (gallery sections AND the list's Pics counts).
   Nothing else spells these out. */
export const FIELDS = [
  ["name", "Name"], ["name_ja", "Japanese"], ["first", "Short"], ["rank", "Card Rank"], ["nen_types", "Nen"],
  ["affiliation", "Affiliation"], ["arcs", "Arcs"], ["arms", "Arms"], ["description", "Description"], ["card_description", "Card description"], ["notes", "Notes"],
];
/* the two picture slots a card needs: avatar 1:1, card illustration 16:9 (the Greed Island card's picture window) */
export const AVATAR_RATIO = 1, CARD_RATIO = 16 / 9;
export const CARD_RATIO_LABEL = "16:9";
export const LABEL = Object.fromEntries(FIELDS);
/* type key → label; the order is the gallery order and the Pics column order */
export const TYPES = [["raw", "Random"], ["uploaded", "Uploaded"], ["cropped", "Edited"], ["pixelated", "Pixel art"], ["upscaled", "Upscaled"], ["transparent", "Transparent"]];
export const TYPE_LABEL = Object.fromEntries(TYPES);
/* review verdicts in the order the list sorts them */
export const STATUSES = [["pending", "Pending"], ["accepted", "Accepted"], ["rejected", "Rejected"]];
export const STATUS_ORDER = Object.fromEntries(STATUSES.map(([s], i) => [s, i]));
