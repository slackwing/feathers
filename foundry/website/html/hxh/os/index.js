/* Bundle entry (esbuild → hxh.js, global `HxH`). Pages do:
     HxH.start({ apps: [HxH.apps.Summons, ...], autostart: ["summons"], ... })
   Everything below is also importable for tests. */
import "./os.css";
export { EventBus } from "./bus.js";
export { Component } from "./component.js";
export { h, esc, $, $$ } from "./dom.js";
export { Env } from "./env.js";
export { icon, sprite, avatar, textColorFor, ICONS, PAL } from "./icons.js";
export { Menus, Menu, MenuBar, renderItems } from "./menu.js";
export { Window, TitleBar, ChromeButton, CHROME } from "./window.js";
export { WindowManager } from "./wm.js";
export { Taskbar, TaskButton, StartButton, Tray, TrayIcon, Clock } from "./taskbar.js";
export { StartMenu } from "./startmenu.js";
export { App, AppRegistry } from "./apps.js";
export { Desktop, DesktopIcon, Backdrop } from "./desktop.js";
export { Toast } from "./toast.js";
export { type } from "./typewriter.js";
export { Boot, Badge, badgeHTML, bootLines } from "./boot.js";
export { Session, Nav, WARM_KEY } from "./session.js";
export { LogonDialog } from "./logon.js";
export { CRT, CRT_KEY } from "./crt.js";
export { Sounds, SOUND_KEY, CUES } from "./sound.js";
export { wallpaper, cloudSprite, Wallpaper } from "./wallpaper.js";
export { OS } from "./os.js";
import { OS } from "./os.js";
import * as apps from "../apps/index.js";
export { apps };

/** Boot the OS on this page. Resolves with the OS once the desktop is up. */
export function start(opts = {}) {
  const os = new OS();
  return os.start(opts);
}
