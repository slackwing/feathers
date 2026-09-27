/* Heavens Arena — a placeholder (Andrew, 2026-09-27): opening it covers
   the whole screen with the Player Select splash (os/splash.js), which
   says COMING SOON instead of Click to start; a click, tap, Enter, Space
   or Escape closes it, back to the desktop. No window of its own, so
   nothing for the saved desktop to bring back. */
import { App } from "../os/apps.js";

export class HeavensArenaApp extends App {
  static id = "arena";
  static name = "Heavens Arena";
  static icon = "arena";
  static order = 22;   // after the Binder

  launch() { return this.os.showSplash("select", { prompt: "COMING SOON", chime: false }); }

  reopen() { return Promise.resolve(false); }   // nothing to bring back
}
