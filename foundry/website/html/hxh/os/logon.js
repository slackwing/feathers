/* AccountDialog — the ONE frame for every account page (Andrew, 2026-09-28:
   "why is the invite page not using the default theming? it should have
   been DRY"): the logon, the invite's choose-a-password and the reset
   page are all a static, unclosable Window alone on the bare desktop,
   titled "Hunter × Halloween — <what it is>", with the logotype on top.
   Only the line under the logo and the form differ.

   LogonDialog is the logon: emits "login" with the account; "forgot"
   posts a reset request. The set-password pages build theirs in
   apps/setpw.js. */
import { Window } from "./window.js";
import { esc } from "./dom.js";

export const SITE_TITLE = "Hunter × Halloween";
export const LOGO = `<h1 class="logo">HUNTER<span class="x">×</span><br><span class="hallow">HALLOWEEN</span></h1>`;

export class AccountDialog extends Window {
  /** { id, subtitle (title bar: SITE_TITLE — subtitle), lead (HTML under the logo), body (HTML: the form and the rest) } */
  constructor({ id, subtitle, lead = "", body = "" } = {}) {
    super({
      id, title: `${SITE_TITLE} — ${subtitle}`, icon: "card", chrome: "static",
      closable: false, task: false, width: 500,
      content: `${LOGO}${lead}${body}`,
    });
  }

  render() {
    const el = super.render();
    el.classList.add("logon");
    return el;
  }
}

export class LogonDialog extends AccountDialog {
  constructor({ session } = {}) {
    super({
      id: "win-logon", subtitle: "Log in",
      lead: `<p>${esc("Summoned applicants only. No summons? Reach out to the hosts.")}</p>`,
      body: `
        <form id="logon-form" class="logon-form">
          <label class="lbl" for="lg-u">Applicant name or email</label>
          <input class="field" id="lg-u" name="username" autocomplete="username" required>
          <label class="lbl" for="lg-p">Password</label>
          <input class="field" id="lg-p" name="password" type="password" autocomplete="current-password" required>
          <div class="actions"><button class="btn primary wide" type="submit">Log in</button></div>
          <div class="msg err" id="lg-msg"></div>
        </form>
        <p class="forgot"><a href="#" id="lg-forgot">Forgot password?</a></p>`,
    });
    this.session = session;
  }

  render() {
    const el = super.render();
    const form = el.querySelector("#logon-form"), msg = el.querySelector("#lg-msg");
    const u = el.querySelector("#lg-u"), p = el.querySelector("#lg-p");
    el.querySelector("#lg-forgot").addEventListener("click", async e => {
      e.preventDefault();
      const name = u.value.trim();
      if (!name) { msg.className = "msg err"; msg.textContent = "Type your applicant name or email first."; u.focus(); return; }
      msg.textContent = "";
      await this.session.forgot(name);
      msg.className = "msg ok";
      msg.textContent = "If that account has an email on file, a reset link is on its way.";
    });
    form.addEventListener("submit", async e => {
      e.preventDefault();
      msg.className = "msg err"; msg.textContent = "";
      try {
        const me = await this.session.login(u.value.trim(), p.value);
        this.emit("login", me);
      } catch (err) {
        msg.textContent = err.message;
      }
    });
    return el;
  }

  focusUser() { this.el?.querySelector("#lg-u")?.focus(); }
}
