// Netflix roles — an admin-only card under Sabbatical '27: open Software
// Engineer 5/6 roles from Netflix's job site and LinkedIn, checked hourly
// by hobby-server (internal/sxiva/jobs*.go). One tile per role, marked with
// the source(s) posting it, 12 tiles a page — starred first, then the rest,
// then the ones gone (red) — newest first within each; a tile opens the
// role's descriptions and details (both sources', combined). Shown only to
// a signed-in admin; logged out, the footer offers a sign-in link instead.
(function () {
    'use strict';

    const ME = '/admin/api/me';
    const API = '/status/api/jobs';
    const GONE_DAYS = 7;      // a role that disappeared stays (in red) this long
    const REFRESH_MS = 5 * 60 * 1000;
    const PER_PAGE = 12;

    const SOURCES = {
        netflix: { mark: 'N', title: 'Netflix' },
        linkedin: { mark: 'in', title: 'LinkedIn' }
    };

    // Detail labels that name the same thing on both sources.
    const SAME_LABEL = { locations: 'Location', teams: 'Team' };

    let roles = [];
    let checks = [];
    let showHidden = false;
    let page = 0;
    let card = null;
    let dialog = null;
    let openRole = null;      // the role the dialog shows
    const details = new Map(); // role_id → the role in full (descriptions, details)

    // ---- helpers ----------------------------------------------------------

    const DAY = 86400000;

    function localTodayMs() {
        const d = new Date();
        return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    }

    function dayMs(iso) {
        return Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
    }

    // Whole days from a posting's (UTC) date to the viewer's today.
    function daysSince(iso) {
        if (!iso) return null;
        return Math.round((localTodayMs() - dayMs(iso)) / DAY);
    }

    function ageLabel(days) {
        if (days === null) return '';
        if (days <= 0) return 'today';
        return `${days}d`;
    }

    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // "Oct 16", or "Jan 9, 2025" outside this year.
    function dateLabel(iso) {
        if (!iso) return '';
        const d = new Date(dayMs(iso));
        const label = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
        return d.getUTCFullYear() === new Date().getFullYear() ? label : `${label}, ${d.getUTCFullYear()}`;
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

    function button(cls, text, title, onClick) {
        const b = el('button', cls, text);
        b.type = 'button';
        if (title) b.title = title;
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            onClick();
        });
        return b;
    }

    // Hide / unhide: an eye, open while the role shows, slashed once hidden
    // (Feather icons, MIT).
    const EYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    const EYE_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

    function hideButton(role) {
        const b = button('nr-hide', undefined, role.hidden ? 'Unhide' : 'Hide', () => mark(role, { hidden: !role.hidden }));
        b.innerHTML = role.hidden ? EYE_OFF : EYE;
        b.setAttribute('aria-label', b.title);
        return b;
    }

    function sourceMark(p, withDate) {
        const src = SOURCES[p.source] || { mark: '?', title: p.source };
        const a = el('a', `nr-mark nr-${p.source}${p.gone_at ? ' is-gone' : ''}`);
        a.append(el('b', '', src.mark));
        if (withDate) a.append(el('span', 'nr-mark-date', dateLabel(p.posted_at)));
        a.href = p.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.title = `${src.title}${p.posted_at ? ' · ' + p.posted_at.slice(0, 10) : ''}${p.gone_at ? ' · gone' : ''}`;
        a.addEventListener('click', (e) => e.stopPropagation());
        return a;
    }

    // A source's description HTML, rebuilt from a small allowlist: text,
    // structure and plain links survive; nothing else (no attributes, no
    // scripts, no styles) is ever inserted.
    const KEEP = new Set(['P', 'DIV', 'BR', 'UL', 'OL', 'LI', 'B', 'STRONG', 'I', 'EM', 'U', 'A']);
    const DROP = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH',
        'HEAD', 'TITLE', 'BUTTON', 'FORM', 'INPUT', 'SELECT', 'TEXTAREA', 'IMG', 'VIDEO', 'AUDIO']);

    function sanitize(html) {
        const src = new DOMParser().parseFromString(html, 'text/html').body;
        const out = document.createDocumentFragment();
        (function copy(from, to) {
            for (const n of from.childNodes) {
                if (n.nodeType === Node.TEXT_NODE) {
                    to.appendChild(document.createTextNode(n.textContent));
                    continue;
                }
                if (n.nodeType !== Node.ELEMENT_NODE || DROP.has(n.tagName)) continue;
                let e = null;
                if (/^H[1-6]$/.test(n.tagName)) e = document.createElement('h4');
                else if (KEEP.has(n.tagName)) e = document.createElement(n.tagName.toLowerCase());
                if (!e) {
                    copy(n, to); // unknown wrapper: keep its contents
                    continue;
                }
                if (n.tagName === 'A') {
                    const href = n.getAttribute('href') || '';
                    if (/^https?:\/\//i.test(href)) {
                        e.href = href;
                        e.target = '_blank';
                        e.rel = 'noopener noreferrer';
                    }
                }
                copy(n, e);
                to.appendChild(e);
            }
        })(src, out);
        // spacer paragraphs (<p>&nbsp;</p>) — the margins already space them
        for (const e of out.querySelectorAll('p, div')) {
            if (!e.textContent.trim() && !e.querySelector('br, a')) e.remove();
        }
        return out;
    }

    function plain(html) {
        return new DOMParser().parseFromString(html, 'text/html').body.textContent.replace(/\s+/g, ' ').trim();
    }

    // ---- data ---------------------------------------------------------------

    async function isAdmin() {
        try {
            const r = await fetch(ME);
            const body = await r.text(); // always drain it — an unread 401 keeps the request open
            if (!r.ok) return false;
            const me = JSON.parse(body);
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

    async function loadDetail(role) {
        if (details.has(role.role_id)) return details.get(role.role_id);
        const r = await fetch(`${API}/roles/${role.role_id}`);
        if (!r.ok) throw new Error(`jobs: role ${r.status}`);
        const full = await r.json();
        details.set(role.role_id, full);
        return full;
    }

    // Star / hide / open: acting on a new role also marks it seen, which
    // ends its highlight.
    async function mark(role, change) {
        if (isNew(role)) change = { ...change, seen: true };
        if (!Object.keys(change).length) return;
        const r = await fetch(`${API}/roles/${role.role_id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(change)
        });
        if (!r.ok) {
            console.error('jobs: mark failed', r.status);
            return;
        }
        const { seen, ...marks } = change;
        Object.assign(role, marks);
        if (seen) role.seen_at = new Date().toISOString();
        render();
        if (openRole === role) renderDialogHead(role);
    }

    // ---- tiles --------------------------------------------------------------

    // Hidden roles, and roles gone over a week, only with "show hidden".
    function visible(role) {
        if (role.hidden && !showHidden) return false;
        return showHidden || !role.gone_at || daysSince(role.gone_at) < GONE_DAYS;
    }

    // Starred, then the rest (hidden ones among them), then gone; the API's
    // newest-first order within each.
    function group(role) {
        if (role.favorite) return 0;
        return role.gone_at ? 2 : 1;
    }

    function ordered(list) {
        return list.map((role, i) => [role, i])
            .sort((a, b) => group(a[0]) - group(b[0]) || a[1] - b[1])
            .map(([role]) => role);
    }

    // New: posted today or yesterday, and not acted on since (a repost —
    // a posting dated after seen_at — makes it new again).
    function isNew(role) {
        const days = daysSince(role.posted_at);
        if (role.gone_at || days === null || days > 1) return false;
        return !role.seen_at || Date.parse(role.seen_at) < dayMs(role.posted_at);
    }

    function stateClasses(e, role) {
        e.classList.toggle('is-gone', !!role.gone_at);
        e.classList.toggle('is-new', isNew(role));
        e.classList.toggle('is-hidden', role.hidden);
        e.classList.toggle('is-favorite', role.favorite);
    }

    function ageText(role) {
        return role.gone_at ? `gone ${ageLabel(daysSince(role.gone_at))}` : ageLabel(daysSince(role.posted_at));
    }

    function tileFor(role) {
        const tile = el('article', 'nr-role');
        tile.tabIndex = 0;
        tile.setAttribute('role', 'button');
        stateClasses(tile, role);

        const top = el('div', 'nr-top');
        const marks = el('span', 'nr-marks');
        for (const p of role.postings) marks.appendChild(sourceMark(p, false));
        top.append(
            marks,
            button('nr-star', role.favorite ? '★' : '☆', role.favorite ? 'Unfavorite' : 'Favorite', () => mark(role, { favorite: !role.favorite })),
            hideButton(role)
        );

        const name = el('h3', 'nr-title', shortTitle(role.title));
        name.title = role.title;

        const foot = el('div', 'nr-foot');
        const age = el('span', 'nr-age', ageText(role));
        age.title = role.posted_at ? `posted ${role.posted_at.slice(0, 10)}` : '';
        foot.append(age, el('span', 'nr-pay', salary(role)));

        tile.append(top, name);
        const where = place(role);
        if (where) tile.append(el('div', 'nr-where', where));
        tile.append(foot);

        tile.addEventListener('click', () => openDialog(role));
        tile.addEventListener('keydown', (e) => {
            if (e.target === tile && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                openDialog(role);
            }
        });
        return tile;
    }

    // Columns: as many tiles as fit, rounded down to a divisor of 12, so
    // every page is whole rows.
    function layColumns() {
        const grid = card.querySelector('.nr-grid');
        const style = getComputedStyle(grid);
        const min = parseFloat(style.getPropertyValue('--nr-min')) || 200;
        const gap = parseFloat(style.columnGap) || 0;
        const fit = Math.floor((grid.clientWidth + gap) / (min + gap));
        const cols = [6, 4, 3, 2, 1].find((c) => c <= fit) || 1;
        grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    }

    function render() {
        if (!card) return;
        const grid = card.querySelector('.nr-grid');
        const shown = ordered(roles.filter(visible));
        const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE));
        page = Math.min(page, pages - 1);
        grid.innerHTML = '';
        for (const role of shown.slice(page * PER_PAGE, (page + 1) * PER_PAGE)) grid.appendChild(tileFor(role));
        if (!shown.length) grid.appendChild(el('div', 'nr-empty', '—'));

        const pager = card.querySelector('.nr-pager');
        pager.hidden = pages < 2;
        pager.querySelector('.nr-page').textContent = `${page + 1}/${pages}`;
        pager.querySelector('.nr-prev').disabled = page === 0;
        pager.querySelector('.nr-next').disabled = page >= pages - 1;

        // a red dot by the title only when a source's last check failed
        const status = card.querySelector('.nr-status');
        const failed = checks.filter((c) => c.checked_at && !c.ok);
        status.classList.toggle('is-failing', failed.length > 0);
        status.title = failed.map((c) => `${(SOURCES[c.source] || {}).title || c.source}: ${c.error}`).join('\n');

        card.querySelector('.nr-show-hidden').classList.toggle('is-on', showHidden);
    }

    function turn(by) {
        page = Math.max(0, page + by);
        render();
    }

    // ---- dialog -------------------------------------------------------------

    function renderDialogHead(role) {
        const head = dialog.querySelector('.nr-dialog-head');
        stateClasses(dialog, role);
        head.innerHTML = '';
        const title = el('h3', 'nr-dialog-title', role.title);
        const tools = el('div', 'nr-dialog-tools');
        tools.append(
            button('nr-star', role.favorite ? '★' : '☆', role.favorite ? 'Unfavorite' : 'Favorite', () => mark(role, { favorite: !role.favorite })),
            hideButton(role),
            button('nr-close', '✕', 'Close', closeDialog)
        );
        const facts = el('div', 'nr-facts');
        for (const text of [salary(role), place(role), ageText(role)]) {
            if (text) facts.append(el('span', '', text));
        }
        const postings = el('div', 'nr-postings');
        for (const p of role.postings) postings.appendChild(sourceMark(p, true));
        head.append(title, tools, facts, postings);
    }

    // Details from every posting, one row per label; where sources differ,
    // each source's value with its mark.
    function detailRows(full) {
        const rows = new Map();
        const add = (label, source, value) => {
            const key = (SAME_LABEL[label.toLowerCase()] || label);
            if (!rows.has(key)) rows.set(key, []);
            const vals = rows.get(key);
            if (!vals.some((v) => v.source === source && v.value === value)) vals.push({ source, value });
        };
        // titles only when a source words the role differently ("4/5")
        const norm = (t) => t.toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
        if (full.postings.some((p) => norm(p.title) !== norm(full.title))) {
            for (const p of full.postings) add('Title', p.source, p.title);
        }
        for (const p of full.postings) {
            for (const m of p.meta || []) add(m.label, p.source, m.value);
        }
        const dl = el('dl', 'nr-details');
        for (const [label, vals] of rows) {
            dl.append(el('dt', '', label));
            const dd = el('dd');
            const agree = vals.every((v) => v.value === vals[0].value);
            for (const v of agree ? [vals[0]] : vals) {
                const line = el('div', 'nr-detail');
                if (!agree) line.append(el('b', `nr-chip nr-${v.source}`, (SOURCES[v.source] || {}).mark || '?'));
                line.append(document.createTextNode(v.value));
                dd.append(line);
            }
            dl.append(dd);
        }
        return dl;
    }

    // Descriptions: one when the sources say the same thing, else each.
    function descriptions(full) {
        const wrap = el('div', 'nr-descs');
        const seen = [];
        for (const p of full.postings) {
            if (!p.description) continue;
            const text = plain(p.description);
            if (seen.includes(text)) continue;
            seen.push(text);
            const sec = el('section', 'nr-desc');
            sec.dataset.source = p.source;
            sec.append(sanitize(p.description));
            wrap.append(sec);
        }
        if (seen.length > 1) {
            for (const sec of wrap.children) {
                sec.prepend(el('h4', 'nr-desc-source', (SOURCES[sec.dataset.source] || {}).title || sec.dataset.source));
            }
        }
        return wrap;
    }

    async function openDialog(role) {
        openRole = role;
        mark(role, {}); // seen, if it was new
        renderDialogHead(role);
        const body = dialog.querySelector('.nr-dialog-body');
        body.innerHTML = '';
        body.append(el('div', 'nr-loading'));
        body.scrollTop = 0;
        if (!dialog.open) dialog.showModal();
        try {
            const full = await loadDetail(role);
            if (openRole !== role) return;
            body.innerHTML = '';
            body.append(detailRows(full), descriptions(full));
            if (!body.querySelector('.nr-desc')) body.append(el('p', 'nr-empty', '—'));
        } catch (e) {
            console.error(e);
            if (openRole === role) {
                body.innerHTML = '';
                body.append(el('p', 'nr-empty', '—'));
            }
        }
    }

    function closeDialog() {
        if (dialog.open) dialog.close();
    }

    // ---- mount ----------------------------------------------------------------

    function mount() {
        card = el('section', 'chart-card nr-card');
        card.innerHTML = '<header><h2>Netflix Roles<span class="nr-status"></span></h2><div class="nr-tools">' +
            '<span class="nr-pager" hidden><button type="button" class="nr-prev" title="Previous">‹</button>' +
            '<span class="nr-page"></span><button type="button" class="nr-next" title="Next">›</button></span>' +
            '<button type="button" class="nr-show-hidden">show hidden</button></div></header><div class="nr-grid"></div>';
        card.querySelector('.nr-show-hidden').addEventListener('click', () => {
            showHidden = !showHidden;
            page = 0;
            render();
        });
        card.querySelector('.nr-prev').addEventListener('click', () => turn(-1));
        card.querySelector('.nr-next').addEventListener('click', () => turn(1));
        const sabbatical = document.querySelector('.sabbatical-card');
        if (sabbatical) sabbatical.after(card);
        else document.querySelector('main').prepend(card);

        new ResizeObserver(layColumns).observe(card.querySelector('.nr-grid'));

        dialog = el('dialog', 'nr-dialog');
        dialog.innerHTML = '<div class="nr-dialog-head"></div><div class="nr-dialog-body"></div>';
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) closeDialog(); // the backdrop
        });
        dialog.addEventListener('close', () => {
            openRole = null;
        });
        document.body.append(dialog);
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
    window.__netflixRoles = { shortTitle, salary, daysSince, sanitize, get roles() { return roles; } };
})();
