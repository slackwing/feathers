/* About Beetle — a cracktro: ASCII beetle, a scrolling greetz line,
   credits to purple square, and an original chiptune ("Beetle 07",
   os/sound.js TUNES) that starts when the window opens and stops when it
   closes. In the spirit of the keygen splash screens of the era. */
import { Window } from "../../os/window.js";
import { esc } from "../../os/dom.js";

export const ART = String.raw`
            ,-.               ,-.
            \  \             /  /
          .--\  \___________/  /--.
         /    '-.   _   _   .-'    \
        |   .-'  \ / \_/ \ /  '-.   |
        |  /      \|  |  |/      \  |
        |  |       |  |  |       |  |
         \ |       |  |  |       | /
          \ \      |  |  |      / /
           \ '-.___|__|__|___.-' /
            '-._  /       \  _.-'
               .'/         \'.
              '-'           '-'`;

export const GREETZ = "· BEETLE 1.0 · HUNTER NETWORK MESSENGER · NO LICENSE CHECK, NO SERIAL · CRACKED FOR THE 289TH HUNTER EXAM · GREETZ TO THE HUNTER ASSOCIATION, ABI, THE EXAM COMMITTEE, EVERY APPLICANT WHO SHOWS UP IN COSTUME · PRESS OK TO CONTINUE ·";

export class AboutWindow extends Window {
  /** props: sounds (os.sounds) */
  constructor(props = {}) {
    super({
      id: "win-chat-about", title: "About Beetle", icon: "beetle", width: 560, cls: "chat cracktro", popup: true,
      content: `
        <div class="ct">
          <pre class="art">${esc(ART)}</pre>
          <div class="ttl">B E E T L E <span>v1.0</span></div>
          <div class="sub">Hunter Network Messenger · HunterOS 99</div>
          <div class="marquee"><span>${esc(GREETZ)} ${esc(GREETZ)}</span></div>
          <div class="credits">
            <div><b>Code</b> purple square</div>
            <div><b>Art</b> purple square</div>
            <div><b>Music</b> "Beetle 07", an original chiptune</div>
            <div><b>Made for</b> Hunter × Halloween, Oct 31, 2026</div>
          </div>
          <div class="actions"><button class="btn" type="button" data-act="music">Music</button><button class="btn primary" type="button" data-act="ok">OK</button></div>
        </div>`,
      onClose: () => props.sounds?.stopTune(),
      ...props,
    });
  }

  render() {
    const el = super.render();
    this.musicBtn = el.querySelector('[data-act="music"]');
    this.musicBtn.addEventListener("click", () => this.toggleMusic());
    el.querySelector('[data-act="ok"]').addEventListener("click", () => this.close());
    return el;
  }

  /** Start the tune (if sounds are on); called by the app when the window opens. */
  startMusic() {
    const s = this.props.sounds;
    const on = !!s?.playTune("beetle");
    this.musicBtn.classList.toggle("pressed", on);
    return on;
  }

  toggleMusic() {
    const s = this.props.sounds;
    if (!s) return false;
    if (s.tunePlaying) { s.stopTune(); this.musicBtn.classList.remove("pressed"); return false; }
    return this.startMusic();
  }
}
