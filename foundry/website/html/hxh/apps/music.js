/* Music (Andrew, 2026-09-28) — a small player window: the YouTube embed of
   one video, playing as soon as it opens. A first-time visitor gets it with
   the Summons (index.html's autostart): the player opens first and starts,
   then the Summons lands on top of it, active, covering only a strip of the
   player's left edge, so most of the video — where the sound is coming
   from — stays in sight. The click on the title screen before the desktop
   is what lets a browser play it with sound; the iframe passes that on
   (allow="autoplay").
   Closing the window stops the music (the iframe goes with it); minimizing
   keeps it playing, like any music player. The saved desktop brings an
   open player back on the next visit — and it plays again. */
import { App } from "../os/apps.js";
import { Window } from "../os/window.js";
import { h } from "../os/dom.js";
import { SUMMONS_AT, SUMMONS_W } from "./summons.js";
import "./music.css";

export const VIDEO = "lMmoUqf4Ags";
export const TITLE = "Hunter x Hunter Lofi Beats to Relax / Study To — Killua Tokyo Night Mix";   // Wilty, on YouTube
/** The window's width: at most WIDTH, down to MIN_W on a narrow desktop. */
export const WIDTH = 480, MIN_W = 360;
/** How far the Summons covers the player's left edge, and how much lower the player sits. */
export const OVERLAP = 38, DROP = 72;   // 38: the Summons covers the player's title-bar icon whole (it ends 34 px in), never half of it, and none of "Music" (from 42)
const MARGIN = 12;

/** The embed: privacy-enhanced (no cookies until played), autoplaying, looping the one video, no suggestions from other channels at the end. */
export function embedSrc(id = VIDEO) {
  const q = new URLSearchParams({ autoplay: "1", playsinline: "1", rel: "0", loop: "1", playlist: id, enablejsapi: "1" });   // the JS API: the page hears the player's state and can say play
  return `https://www.youtube-nocookie.com/embed/${id}?${q}`;
}

/**
 * Where the player opens on a desktop `width` wide: just right of the
 * Summons, its left edge OVERLAP px under the Summons' right edge and DROP px
 * lower. A narrower desktop narrows the player first (to MIN_W), and only
 * then tucks more of it under the Summons.
 */
export function besideSummons(width) {
  const x = SUMMONS_AT.x + SUMMONS_W - OVERLAP;
  const w = Math.max(MIN_W, Math.min(WIDTH, width - x - MARGIN));
  return { x: Math.max(0, Math.min(x, width - w - MARGIN)), y: SUMMONS_AT.y + DROP, w };
}

export class MusicApp extends App {
  static id = "music";
  static name = "Music";
  static icon = "music";
  static order = 23;   // after Heavens Arena

  window() {
    if (this.win) return this.win;
    // no menu bar: File › Exit would only repeat the ×, and the Summons, overlapping the player's left edge, would cut "File" to a stray "e"
    this.win = new Window({ id: "win-music", title: "Music", icon: "music", width: WIDTH, cls: "music", content: `<div class="vid"></div>`, onClose: () => this.stop() });
    this.os.wm.add(this.win);
    return this.win;
  }

  /** Open (with the jank at boot, beside where the Summons will land) and play. Launching it again while it plays just brings it forward. */
  async launch({ autostart = false } = {}) {
    const win = this.window(), env = this.os.env;
    const at = !win.state.placed && env.floating() ? besideSummons(env.width) : null;
    await this.os.wm.open(win.id, at, { scroll: false, jank: autostart });
    this.play();
    return win;
  }

  play() {
    if (this.frame) return this.frame;
    this.playing = this.started = false;
    this.frame = h("iframe", { src: embedSrc(), title: TITLE, allow: "autoplay; encrypted-media; picture-in-picture; fullscreen", allowfullscreen: true, referrerpolicy: "strict-origin-when-cross-origin",
      onload: () => this.say({ event: "listening", id: "hxh-music" }) });   // ask the player to report its state
    this.win.$(".vid").append(this.frame);
    this.nudge ||= this.watchGestures();
    return this.frame;
  }

  /** Send the player a message (YouTube's iframe API speaks JSON over postMessage). */
  say(msg) { try { this.frame?.contentWindow?.postMessage(JSON.stringify(msg), "*"); } catch {} }

  /**
   * A browser may refuse to autoplay with sound — Firefox on the page after
   * an invite, whose click was on the page before (Andrew, 2026-09-28: "for
   * my new test user the music didn't autoplay"). Then the first click or
   * key anywhere on the page, a gesture the browser accepts, tells the
   * player to play. The player's own reports (onStateChange / infoDelivery)
   * say whether it already is, so a playing video is never touched.
   */
  watchGestures() {
    const win = this.os.win, doc = this.os.doc;
    win.addEventListener("message", e => {
      if (!this.frame || e.source !== this.frame.contentWindow) return;
      let d; try { d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch { return; }
      const state = d?.event === "onStateChange" ? d.info : d?.event === "infoDelivery" ? d.info?.playerState : undefined;
      if (typeof state !== "number") return;
      this.playing = state === 1 || state === 3;   // 1 playing, 3 buffering
      if (this.playing) this.started = true;
    });
    // only ever to get it STARTED: once it has played, a pause is the listener's — a tap elsewhere (Heavens Arena)
    // must not start it again (Andrew, 2026-09-28: "clicking heavens arena actually plays and unplays the music")
    const gesture = () => { if (this.frame && !this.started) this.say({ event: "command", func: "playVideo", args: [] }); };
    for (const t of ["pointerdown", "keydown"]) doc.addEventListener(t, gesture, true);
    return true;
  }

  /** The window closed: the iframe goes, and the sound with it. */
  stop() { this.frame?.remove(); this.frame = null; this.playing = this.started = false; }
}
