/* The emoji palette behind the smiley in a chat's compose tools: a grid of
   the usual suspects plus the party's own (Halloween, the island, the
   Beetle). Any modern emoji typed or pasted works regardless — the font
   stacks fall back to the system's colour emoji face — this is just the
   quick pick. */
import { Menu } from "../../os/menu.js";

export const EMOJI = [
  "😀", "😄", "😂", "🤣", "😊", "😍", "😘", "😎",
  "🤔", "🙄", "😏", "😬", "🤯", "😱", "😭", "🥳",
  "🥺", "😤", "🫠", "🫶", "🫡", "🤝", "👀", "🤡",
  "👍", "👎", "👏", "🙌", "🙏", "💪", "🔥", "✨",
  "💯", "❤️", "💔", "💀", "👻", "🎃", "🦇", "🕷️",
  "🕸️", "🧟", "🧛", "🧙", "🍬", "🍭", "🎉", "🎈",
  "🎁", "🐞", "🐋", "🐟", "🌊", "🏝️", "⛵", "✈️",
  "🃏", "⚡", "🌙", "⭐", "🍕", "🍺", "☕", "🌮",
  "🎮", "🎵", "📸", "🗺️", "🔑", "💤", "🚀", "🏆",
];

/** A Menu whose items are the emoji; `onPick(emoji)` inserts one. */
export class EmojiMenu extends Menu {
  constructor({ onPick, parent = null } = {}) {
    super({ cls: "emoji", parent, items: () => EMOJI.map(e => ({ label: e, attrs: { "data-emoji": e, title: e }, onclick: () => onPick?.(e) })) });
  }
}
