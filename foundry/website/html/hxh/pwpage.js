/* hxh skin for the shared set-password pages (_invite/ and _reset/): the
   OS boots as a logon-style splash (no taskbar, no wallpaper), then one
   dialog appears, wired to /admin/assets/setpw.js — the machinery lives
   there; this file only supplies the look and the words. */
const PwPage = {
  async start({ title, heading, submit, done, nocode, invalid }) {
    const desktop = document.getElementById("desktop");
    desktop.innerHTML = `
      <div class="win static" id="win-pw" data-title="${title}" data-icon="x" data-noclose data-notask data-width="525" hidden>
        <div class="body">
          <h1 class="dialog-h">${heading}</h1>
          <form data-pw="form">
            <div class="msg err" data-pw="nocode" hidden>${nocode}</div>
            <label class="lbl" for="u">Applicant</label>
            <input class="field" id="u" data-pw="username" autocomplete="username" readonly>
            <label class="lbl" for="p">Password</label>
            <input class="field" id="p" data-pw="password" type="password" autocomplete="new-password" minlength="8" required>
            <div class="actions"><button class="btn primary wide" type="submit" data-pw="submit">${submit}</button></div>
            <div class="msg err" data-pw="msg"></div>
          </form>
          <div data-pw="done" hidden>
            <p class="ok">${done.replace("{name}", '<b data-pw="name"></b>')}</p>
            <div class="actions"><a class="btn primary" href="/hxh/" data-pw="enter">Enter the exam site</a></div>
          </div>
          <p class="err" data-pw="invalid" hidden>${invalid}</p>
        </div>
      </div>`;
    await Retro.os({ wallpaper: false, taskbar: false, gate: false });
    const win = document.getElementById("win-pw");
    const st = await SetPassword.mount(win);
    // Into the site without rebooting — this page already booted.
    win.querySelector('[data-pw="enter"]').addEventListener("click", e => { e.preventDefault(); Retro.go(e.currentTarget.getAttribute("href")); });
    await Retro.open("win-pw", null, { scroll: false, jank: true });
    if (st.state === "ok") win.querySelector('[data-pw="password"]').focus();
  },
};
