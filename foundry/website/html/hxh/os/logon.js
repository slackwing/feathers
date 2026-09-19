/* LogonDialog — the Windows-style logon, a static Window alone on the bare
   desktop. Emits "login" with the account; "forgot" posts a reset request. */
import { Window } from "./window.js";

export class LogonDialog extends Window {
  constructor({ session } = {}) {
    super({
      id: "win-logon", title: "Hunter × Halloween — Log in", icon: "card", chrome: "static",
      closable: false, task: false, width: 500,
      content: `
        <h1 class="logo">HUNTER<span class="x">×</span><br><span class="hallow">HALLOWEEN</span></h1>
        <p>Summoned applicants only. No summons? Reach out to the hosts.</p>
        <form id="logon-form" class="logon-form">
          <label class="lbl" for="lg-u">Applicant</label>
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
    el.classList.add("logon");
    const form = el.querySelector("#logon-form"), msg = el.querySelector("#lg-msg");
    const u = el.querySelector("#lg-u"), p = el.querySelector("#lg-p");
    el.querySelector("#lg-forgot").addEventListener("click", async e => {
      e.preventDefault();
      const name = u.value.trim();
      if (!name) { msg.className = "msg err"; msg.textContent = "Type your applicant name first."; u.focus(); return; }
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
