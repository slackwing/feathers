// Netflix roles — an admin-only card under Sabbatical '27: open Software
// Engineer 5/6 roles from the Netflix careers site and LinkedIn, checked
// hourly by hobby-server (internal/sxiva/jobs*.go). One card per role,
// marked with the source(s) posting it. Shown only to a signed-in admin;
// logged out, the footer offers a sign-in link instead.
(function () {
    'use strict';

    const ME = '/admin/api/me';
    const API = '/status/api/jobs';
    const GONE_DAYS = 7;      // a role that disappeared stays (in red) this long
    const REFRESH_MS = 5 * 60 * 1000;

    const SOURCES = {
        careers: { mark: 'N', title: 'Netflix careers' },
        linkedin: { mark: 'in', title: 'LinkedIn' }
    };

    let roles = [];
    let checks = [];
    let showAll = false;
    let card = null;

    // ---- helpers ----------------------------------------------------------

    const DAY = 86400000;

    function localTodayMs() {
        const d = new Date();
        return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    }

    // Whole days from a posting's (UTC) date to the viewer's today.
    function daysSince(iso) {
        if (!iso) return null;
        const day = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
        return Math.round((localTodayMs() - day) / DAY);
    }

    function ageLabel(days) {
        if (days === null) return '';
        if (days <= 0) return 'today';
        return `${days}d`;
    }

    // "Software Engineer 5 - iOS" → "SE5 - iOS"; "Senior Software Engineer (L5)" → "Senior SE5".
    function shortTitle(title) {
        return title
            .replace(/software\s+engineer(?:ing)?(\s*\d(?:\s*\/\s*\d)?)?/gi, (_, level) => 'SE' + (level ? level.replace(/\s+/g, '') : ''))
            .replace(/\bSE\s*\(L(\d)\)/g, 'SE$1')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function money(n) {
        if (n >= 1000000) return `${Number((n / 1000000).toFixed(2))}M`;
        return `${Math.round(n / 1000)}K`;
    }

    function salary(role) {
        if (role.salary_min == null || role.salary_max == null) return '';
        const lo = money(role.salary_min), hi = money(role.salary_max);
        // "$388–558K" when both are thousands, else "$600K–1.07M"
        return lo.endsWith('K') && hi.endsWith('K') ? `$${lo.slice(0, -1)}–${hi}` : `$${lo}–${hi}`;
    }

    // Locations worth showing: anything but plain remote-in-the-US.
    function place(role) {
        return role.locations
            .filter((l) => !/^(remote,\s*)?united states$/i.test(l.trim()))
            .join(' · ');
    }

    function el(tag, cls, text) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text !== undefined) e.textContent = text;
        return e;
    }

    // ---- data ---------------------------------------------------------------

    async function isAdmin() {
        try {
            const r = await fetch(ME);
            if (!r.ok) return false;
            const me = await r.json();
            return (me.roles || []).some((x) => x.website === 'admin' && x.role === 'admin');
        } catch (e) {
            return false;
        }
    }

    async function load() {
        const r = await fetch(API);
        if (!r.ok) throw new Error(`jobs: ${r.status}`);
        const data = await r.json();
        roles = data.roles || [];
        checks = data.checks || [];
        render();
    }

    async function mark(role, change) {
        const r = await fetch(`${API}/roles/${role.role_id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(change)
        });
        if (!r.ok) {
            console.error('jobs: mark failed', r.status);
            return;
        }
        Object.assign(role, change);
        render();
    }

    // ---- view ---------------------------------------------------------------

    function visible(role) {
        if (showAll) return true;
        if (role.hidden) return false;
        return !role.gone_at || daysSince(role.gone_at) < GONE_DAYS;
    }

    function rowFor(role) {
        const days = daysSince(role.posted_at);
        const row = el('li', 'nr-role');
        if (role.gone_at) row.classList.add('is-gone');
        if (!role.gone_at && days !== null && days <= 1) row.classList.add('is-new');
        if (role.hidden) row.classList.add('is-hidden');
        if (role.favorite) row.classList.add('is-favorite');

        const star = el('button', 'nr-star', role.favorite ? '★' : '☆');
        star.type = 'button';
        star.title = role.favorite ? 'Unfavorite' : 'Favorite';
        star.addEventListener('click', () => mark(role, { favorite: !role.favorite }));

        const live = role.postings.filter((p) => !p.gone_at);
        const main = (live.find((p) => p.source === 'careers') || live[0] || role.postings[0]) || {};
        const name = el('a', 'nr-title', shortTitle(role.title));
        name.href = main.url || '#';
        name.target = '_blank';
        name.rel = 'noopener';
        name.title = role.title;

        const marks = el('span', 'nr-marks');
        for (const p of role.postings) {
            const src = SOURCES[p.source] || { mark: '?', title: p.source };
            const m = el('a', `nr-mark nr-${p.source}${p.gone_at ? ' is-gone' : ''}`, src.mark);
            m.href = p.url;
            m.target = '_blank';
            m.rel = 'noopener';
            m.title = src.title + (p.gone_at ? ' (gone)' : '');
            marks.appendChild(m);
        }

        const age = el('span', 'nr-age', role.gone_at ? `gone ${ageLabel(daysSince(role.gone_at))}` : ageLabel(days));
        age.title = role.posted_at ? `posted ${role.posted_at.slice(0, 10)}` : '';
        const pay = el('span', 'nr-pay', salary(role));
        const where = el('span', 'nr-where', place(role));

        const hide = el('button', 'nr-hide', role.hidden ? '↺' : '×');
        hide.type = 'button';
        hide.title = role.hidden ? 'Unhide' : 'Hide';
        hide.addEventListener('click', () => mark(role, { hidden: !role.hidden }));

        row.append(star, name, marks, age, pay, where, hide);
        return row;
    }

    function checkedLabel() {
        const times = checks.filter((c) => c.checked_at).map((c) => Date.parse(c.checked_at));
        if (!times.length) return '';
        const mins = Math.round((Date.now() - Math.max(...times)) / 60000);
        return mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`;
    }

    function render() {
        if (!card) return;
        const list = card.querySelector('.nr-list');
        list.innerHTML = '';
        const shown = roles.filter(visible);
        for (const role of shown) list.appendChild(rowFor(role));
        if (!shown.length) list.appendChild(el('li', 'nr-empty', '—'));

        const status = card.querySelector('.nr-status');
        status.textContent = checkedLabel();
        const failed = checks.filter((c) => c.checked_at && !c.ok);
        status.classList.toggle('is-failing', failed.length > 0);
        status.title = checks.map((c) => `${(SOURCES[c.source] || {}).title || c.source}: ${c.ok ? 'ok' : (c.error || 'not checked yet')}`).join('\n');

        const all = card.querySelector('.nr-all');
        all.classList.toggle('is-on', showAll);
        all.textContent = showAll ? 'all' : `all (${roles.length})`;
    }

    function mount() {
        card = el('section', 'chart-card nr-card');
        card.innerHTML = '<header><h2>Netflix</h2><div class="nr-tools"><span class="nr-status"></span><button type="button" class="nr-all"></button></div></header><ul class="nr-list"></ul>';
        card.querySelector('.nr-all').addEventListener('click', () => {
            showAll = !showAll;
            render();
        });
        const sabbatical = document.querySelector('.sabbatical-card');
        if (sabbatical) sabbatical.after(card);
        else document.querySelector('main').prepend(card);
    }

    function offerSignIn() {
        const footer = document.querySelector('footer p');
        if (!footer || footer.querySelector('.nr-signin')) return;
        const link = el('a', 'nr-signin', 'sign in');
        link.href = '/admin/';
        footer.append(' | ', link);
    }

    (async function start() {
        if (!(await isAdmin())) {
            offerSignIn();
            return;
        }
        mount();
        try {
            await load();
        } catch (e) {
            console.error(e);
        }
        setInterval(() => load().catch((e) => console.error(e)), REFRESH_MS);
    })();

    // Test hook
    window.__netflixRoles = { shortTitle, salary, daysSince, get roles() { return roles; } };
})();
