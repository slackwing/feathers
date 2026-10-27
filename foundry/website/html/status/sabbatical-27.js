// Sabbatical '27 — a temporary card at the top of the status page: one
// column of squares per day. Squares are counted by hobby-server
// (GET /status/api/sabbatical, keyed by color); the grid is tuft's
// grid-of-squares (vendor/, re-vendor with scripts/vendor-tuft.sh).
// What the colors mean is deliberately not on the page: no legend, and
// tooltips show only the date.
//
// To remove after the sabbatical: delete this file and, in index.html, its
// <script> plus the vendor/grid-of-squares <link> and <script>.
(function () {
    'use strict';

    // Hide the card after this date ('YYYY-MM-DD'); null = keep showing.
    const SHOW_UNTIL = null;

    const SETTINGS = {
        // Squares before the sabbatical don't count.
        start: '2026-10-22',
        // Higher rank sits lower in a day's column; max caps what a day
        // earns, before bulldozing.
        schema: [
            { type: 'green', color: 'green', rank: 7, bulldoze: true, max: 6 },
            { type: 'red', color: 'red', rank: 6, bulldoze: true },
            { type: 'orange', color: 'orange', rank: 5, bulldoze: true },
            { type: 'white', color: 'white', rank: 4, bulldoze: true },
            { type: 'yellow', color: 'yellow', rank: 3, bulldoze: true, max: 3 },
            { type: 'blue', color: 'blue', rank: 2, bulldoze: true },
            { type: 'brown', color: 'brown', rank: 1, bulldoze: true },
            { type: 'purple', color: 'purple', rank: 0, bulldoze: true }
        ],
        height: 20,
        // e.g. { from: '2027-01-24', height: 43 } once the date is known
        heightChanges: [],
        bulldozeMode: 'proportional',
        lookahead: 0.2,
        legend: false,
        tooltip: 'date',
        todayMarker: true
    };

    const API = '/status/api/sabbatical';
    const REFRESH_MS = 5 * 60 * 1000;

    function localToday() {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    if (SHOW_UNTIL && localToday() > SHOW_UNTIL) return;
    if (!window.Tuft || !window.Tuft.GridOfSquares) return;

    const card = document.createElement('section');
    card.className = 'chart-card sabbatical-card';
    card.innerHTML = `<header><h2>Sabbatical '27</h2></header><div class="sabbatical-grid"></div>`;
    document.querySelector('main').prepend(card);

    const grid = window.Tuft.GridOfSquares.mount(card.querySelector('.sabbatical-grid'), SETTINGS);
    const types = SETTINGS.schema.map((t) => t.type);

    async function load() {
        try {
            const response = await fetch(API);
            if (!response.ok) throw new Error(`API error: ${response.status}`);
            const data = await response.json();
            grid.clear();
            for (const day of data.days) {
                for (const type of types) {
                    if (day[type] > 0) grid.add(day.date, type, day[type]);
                }
            }
            grid.render();
        } catch (error) {
            console.error('Sabbatical grid:', error);
        }
    }

    load();
    setInterval(load, REFRESH_MS);
})();
