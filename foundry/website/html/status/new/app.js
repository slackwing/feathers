// /status/new/ — the status dashboard on TradingView Lightweight Charts.
// The ENTIRE history is loaded once at page load (limit=5000); the charts
// zoom (wheel / pinch) and pan (drag) over it, linked to one time axis.
// Category lists + chip tooltips: ../js/config.js (shared with /status/).
const API_BASE_URL = '/status/api';
const FETCH_LIMIT = 5000;
const ROLLING_WINDOW_DAYS = 7;
const DECAY_LAMBDA = 0.5; // Calibrated so day 6 has 5% weight
const DEFAULT_DAYS = 30;  // Initial visible range
const REFRESH_MS = 5 * 60 * 1000;

const LWC = LightweightCharts;
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const COLORS = {
    // Good/bad states (stat cards)
    RED: '#dc2626',
    YELLOW: '#ca8a04',
    GREEN: '#16a34a',
    GREEN_LIGHT: '#22c55e',
    GREEN_DARK: '#15803d',

    // Background zones
    ZONE_RED: 'rgba(220, 38, 38, 0.15)',
    ZONE_YELLOW: 'rgba(202, 138, 4, 0.15)',
    ZONE_GREEN: 'rgba(22, 163, 74, 0.15)',
    ZONE_GREEN_LIGHT: 'rgba(100, 200, 100, 0.08)',

    // Lines: solid for "Actual", light for "Feels Like" / long averages
    HOBBY: '#10b981',
    HOBBY_LIGHT: 'rgba(16, 185, 129, 0.3)',
    WORK: '#ef4444',
    WORK_LIGHT: 'rgba(239, 68, 68, 0.3)',
    ALCOHOL: '#ca8a04',
    ALCOHOL_LIGHT: 'rgba(202, 138, 4, 0.35)',
    MOOD: '#3b82f6',
    MOOD_LIGHT: 'rgba(59, 130, 246, 0.35)',
    SLEEP: '#8b5cf6',
    SLEEP_LIGHT: 'rgba(139, 92, 246, 0.35)',

    GRID: '#eef0f3',
    AXIS: '#d1d5db',
    CROSSHAIR: '#9ca3af',
    CROSSHAIR_LABEL: '#374151'
};

// Fixed y-ranges (minutes for hobby/work), shared by the summary and the individual charts
const SCALES = {
    hobby: [0, 28 * 60],
    work: [7 * 60, 35 * 60],
    mood: [-2, 2],
    sleep: [0, 100]
};

// Zones: [minHours, maxHours, color]
const HOBBY_ZONES = [
    [0, 7, COLORS.ZONE_RED],
    [7, 14, COLORS.ZONE_YELLOW],
    [14, 21, COLORS.ZONE_GREEN],
    [21, 100, COLORS.ZONE_GREEN]
];
const WORK_ZONES = [
    [SCALES.work[0] / 60, 14, COLORS.ZONE_GREEN],
    [14, 21, COLORS.ZONE_GREEN_LIGHT],
    [21, 28, COLORS.ZONE_YELLOW],
    [28, 100, COLORS.ZONE_RED]
];

// ---------------------------------------------------------------------------
// Value transforms (same as /status/)

// Extra-exaggerated mood: 0..0.5 takes the same space as 0.5..2.0
function transformMood(mood) {
    if (mood === null || mood === undefined) return null;
    const sign = mood >= 0 ? 1 : -1;
    const abs = Math.abs(mood);
    if (abs <= 0.5) return sign * (abs * 2.0);
    return sign * (1.0 + (abs - 0.5) / 1.5);
}

// Exponential sleep: 80 lands in the middle of the 40..100 axis
const SLEEP_K = 1.099;
function transformSleep(sleep) {
    if (sleep === null || sleep === undefined) return null;
    const normalized = (sleep - 40) / 60;
    return ((Math.exp(SLEEP_K * normalized) - 1) / (Math.exp(SLEEP_K) - 1)) * 100;
}
function inverseSleep(value) {
    const normalized = Math.log((value / 100) * (Math.exp(SLEEP_K) - 1) + 1) / SLEEP_K;
    return normalized * 60 + 40;
}

// ---------------------------------------------------------------------------
// Dates

function getTodayLocal() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Lightweight Charts hands times back as the string we gave it, a
// {year, month, day} business day, or a UTC timestamp — normalize to YYYY-MM-DD
function toDateStr(time) {
    if (typeof time === 'string') return time;
    if (typeof time === 'number') return new Date(time * 1000).toISOString().slice(0, 10);
    return `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}`;
}

function formatDate(dateStr, withYear = false) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', withYear
        ? { month: 'short', day: 'numeric', year: 'numeric' }
        : { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Value formatters (axis labels + legend readout)

const fmt = {
    hours: v => (v / 60).toFixed(1) + 'h',
    hoursAxis: v => Math.round(v / 60) + 'h',
    alcohol: v => v.toFixed(1),
    alcoholAxis: v => v.toFixed(0),
    mood: v => (v > 0 ? '+' : '') + v.toFixed(2),
    sleep: v => Math.round(v).toString(),
    sleepAxis: v => Math.round(inverseSleep(v)).toString(),
    none: () => ''
};

// ---------------------------------------------------------------------------
// Fetch (whole history, today excluded since it's in flux)

async function fetchJSON(path, params) {
    const response = await fetch(`${API_BASE_URL}/${path}?${new URLSearchParams(params)}`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    const today = getTodayLocal();
    data.data = data.data.filter(d => d.date !== today);
    return data;
}

function fetchCategoryData() {
    return fetchJSON('category-rolling-sum', {
        hobby: HOBBY_CATEGORIES.join(','),
        work: WORK_CATEGORIES.join(','),
        days: ROLLING_WINDOW_DAYS,
        limit: FETCH_LIMIT,
        lambda: DECAY_LAMBDA
    });
}

function fetchAlcoholMoodData() {
    return fetchJSON('alcohol-depression', { limit: FETCH_LIMIT });
}

function fetchSleepData() {
    return fetchJSON('sleep-score', { limit: FETCH_LIMIT });
}

// ---------------------------------------------------------------------------
// Background zones: a series primitive that fills horizontal bands behind the
// series (zOrder 'bottom'), using the series' own price scale for y

class ZonesPrimitive {
    constructor(zones) {
        this._zones = zones; // [minHours, maxHours, color]
        this._bands = [];
        const self = this;
        this._views = [{
            zOrder: () => 'bottom',
            renderer: () => ({
                draw: target => target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
                    for (const band of self._bands) {
                        ctx.fillStyle = band.color;
                        ctx.fillRect(0, band.top, mediaSize.width, band.bottom - band.top);
                    }
                })
            })
        }];
    }

    attached({ series }) {
        this._series = series;
    }

    detached() {
        this._series = null;
    }

    updateAllViews() {
        if (!this._series) return;
        this._bands = this._zones.map(([minHours, maxHours, color]) => {
            const bottom = this._series.priceToCoordinate(minHours * 60);
            const top = this._series.priceToCoordinate(maxHours * 60);
            return bottom === null || top === null ? null : { top, bottom, color };
        }).filter(Boolean);
    }

    paneViews() {
        return this._views;
    }
}

// ---------------------------------------------------------------------------
// Smooth line: a series primitive that strokes a monotone cubic curve
// (Fritsch–Carlson, as d3's curveMonotoneX / Chart.js "monotone") through the
// series' points. The library's own Curved type is a Bézier with no
// monotonicity guarantee, so dense data loops backwards in time; this one
// is monotone in x by construction and never overshoots the data in y.
// Runs break at absent days; an isolated point is drawn as a dot.

class SmoothLinePrimitive {
    constructor(color) {
        this._color = color;
        this._points = []; // calendar order: { index, value } or null (absent)
        this._runs = [];   // pixel runs: [[{x, y}, ...], ...]
        const self = this;
        this._views = [{
            zOrder: () => 'normal',
            renderer: () => ({
                draw: target => target.useMediaCoordinateSpace(({ context: ctx }) => self._draw(ctx))
            })
        }];
    }

    setPoints(points) {
        this._points = points;
    }

    attached({ chart, series }) {
        this._chart = chart;
        this._series = series;
    }

    detached() {
        this._chart = null;
        this._series = null;
    }

    updateAllViews() {
        if (!this._chart || !this._series) return;
        const timeScale = this._chart.timeScale();
        const runs = [];
        let run = [];
        for (const p of this._points) {
            const x = p && timeScale.logicalToCoordinate(p.index);
            const y = p && this._series.priceToCoordinate(p.value);
            if (!p || x === null || y === null) {
                if (run.length) runs.push(run);
                run = [];
                continue;
            }
            run.push({ x, y });
        }
        if (run.length) runs.push(run);
        this._runs = runs;
    }

    paneViews() {
        return this._views;
    }

    _draw(ctx) {
        ctx.save();
        ctx.strokeStyle = this._color;
        ctx.fillStyle = this._color;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        for (const run of this._runs) {
            if (run.length === 1) {
                ctx.beginPath();
                ctx.arc(run[0].x, run[0].y, 2, 0, Math.PI * 2);
                ctx.fill();
                continue;
            }
            const m = monotoneTangents(run);
            ctx.beginPath();
            ctx.moveTo(run[0].x, run[0].y);
            for (let i = 0; i < run.length - 1; i++) {
                const a = run[i], b = run[i + 1], dx = (b.x - a.x) / 3;
                ctx.bezierCurveTo(a.x + dx, a.y + dx * m[i], b.x - dx, b.y - dx * m[i + 1], b.x, b.y);
            }
            ctx.stroke();
        }
        ctx.restore();
    }
}

// Tangent (dy/dx) at each point of a run, Fritsch–Carlson style: zero at local
// extrema, otherwise limited by the neighbouring secants so the curve never
// overshoots; one-sided at the ends
function monotoneTangents(pts) {
    const n = pts.length;
    const m = new Array(n);
    const sign = v => (v > 0) - (v < 0);
    const secant = i => (pts[i + 1].y - pts[i].y) / ((pts[i + 1].x - pts[i].x) || 1);
    for (let i = 1; i < n - 1; i++) {
        const h0 = pts[i].x - pts[i - 1].x, h1 = pts[i + 1].x - pts[i].x;
        const s0 = secant(i - 1), s1 = secant(i);
        const p = (s0 * h1 + s1 * h0) / (h0 + h1);
        m[i] = (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
    }
    const end = (i, j, t) => (3 * secant(Math.min(i, j)) - t) / 2;
    m[0] = n > 2 ? end(0, 1, m[1]) : secant(0);
    m[n - 1] = n > 2 ? end(n - 2, n - 1, m[n - 2]) : secant(n - 2);
    return m;
}

// ---------------------------------------------------------------------------
// Charts

function createChart(el) {
    return LWC.createChart(el, {
        autoSize: true,
        layout: {
            background: { type: 'solid', color: '#ffffff' },
            textColor: COLORS.CROSSHAIR_LABEL,
            fontFamily: FONT,
            fontSize: 11,
            attributionLogo: false // credited in the footer instead
        },
        grid: {
            vertLines: { color: COLORS.GRID },
            horzLines: { color: COLORS.GRID }
        },
        rightPriceScale: {
            borderColor: COLORS.AXIS,
            minimumWidth: 44,              // identical across the stack so time axes line up
            scaleMargins: { top: 0, bottom: 0 },
            ticksVisible: false,
            entireTextOnly: true
        },
        leftPriceScale: { visible: false },
        overlayPriceScales: { scaleMargins: { top: 0, bottom: 0 } },
        timeScale: {
            borderColor: COLORS.AXIS,
            fixLeftEdge: true,
            fixRightEdge: true,
            lockVisibleTimeRangeOnResize: true,
            rightOffset: 0,
            minBarSpacing: 0.5,
            timeVisible: false
        },
        crosshair: {
            mode: LWC.CrosshairMode.Normal,
            vertLine: {
                color: COLORS.CROSSHAIR,
                width: 1,
                style: LWC.LineStyle.Solid,
                labelBackgroundColor: COLORS.CROSSHAIR_LABEL
            },
            horzLine: { visible: false, labelVisible: false }
        },
        handleScroll: { vertTouchDrag: false }, // leave vertical swipes to the page
        handleScale: { axisPressedMouseMove: { time: true, price: false } },
        localization: {
            locale: 'en-US',
            timeFormatter: time => formatDate(toDateStr(time), true)
        }
    });
}

function addLine(chart, item) {
    const { color, scaleId, axisFormat, light = false } = item;
    return chart.addSeries(LWC.LineSeries, {
        color,
        lineWidth: 2,
        // The line itself is drawn by SmoothLinePrimitive (monotone curve);
        // the series still owns the data: crosshair markers, scale, hover
        lineVisible: false,
        priceScaleId: scaleId,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: light ? 3 : 4,
        crosshairMarkerBorderWidth: 2,
        crosshairMarkerBorderColor: '#ffffff',
        crosshairMarkerBackgroundColor: color,
        priceFormat: { type: 'custom', formatter: axisFormat, minMove: 0.01 },
        // Fixed range, read lazily: the alcohol range is only known once data arrives
        autoscaleInfoProvider: () => ({
            priceRange: { minValue: item.range[0], maxValue: item.range[1] },
            margins: { above: 0, below: 0 }
        })
    });
}

// A card = one chart + its legend readout. items: [{ name, color, series,
// key, format, transform }], where key picks the API field and format turns
// the RAW value into the legend string (transform only shapes the plotted value).
const cards = [];
let charts = [];
let dates = [];        // all dates in the loaded history, ascending
let linking = false;   // re-entrancy guard for range/crosshair sync

function buildCard(id, legendId, items, { zones = null } = {}) {
    const chart = createChart(document.getElementById(id));
    const legend = document.getElementById(legendId);

    const dateEl = document.createElement('span');
    dateEl.className = 'legend-date';
    legend.appendChild(dateEl);

    for (const item of items) {
        item.series = addLine(chart, item);
        item.curve = new SmoothLinePrimitive(item.color);
        item.series.attachPrimitive(item.curve);
        item.lookup = new Map(); // date → legend string

        const el = document.createElement('span');
        el.className = 'legend-item';
        const key = document.createElement('i');
        key.className = 'key';
        key.style.background = item.color;
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = item.name;
        const val = document.createElement('b');
        val.className = 'val';
        el.append(key, name, val);
        legend.appendChild(el);
        item.valueEl = val;
    }

    if (zones) items[0].series.attachPrimitive(new ZonesPrimitive(zones));

    // Transparent series with a value on every date, on the right scale:
    // 1. a chart's right edge is its last REAL value (whitespace doesn't extend
    //    it), so a chart whose data stops early (sleep) would otherwise clamp
    //    the linked range for everyone;
    // 2. the linked crosshair (setCrosshairPosition) needs the pane's default
    //    scale to have a value in view, which sleep alone can't guarantee.
    // Added last so it never owns the axis formatter; excluded from autoscale.
    const spine = chart.addSeries(LWC.LineSeries, {
        color: 'rgba(0, 0, 0, 0)', lineWidth: 1, priceScaleId: 'right',
        priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
        autoscaleInfoProvider: () => null
    });

    const card = { chart, items, dateEl, spine };
    cards.push(card);
    charts.push(chart);
    return card;
}

// Alcohol ranges are placeholders until setData() sizes them to the whole history
function buildCharts() {
    buildCard('summaryChart', 'summaryLegend', [
        // Hobbies + work share one hidden hours axis, as on /status/ (work is ×2)
        { name: 'Hobbies', color: COLORS.HOBBY, scaleId: 'right', range: SCALES.hobby, axisFormat: fmt.none, key: 'hobby_weighted', format: fmt.hours },
        { name: 'Work', color: COLORS.WORK, scaleId: 'right', range: SCALES.hobby, axisFormat: fmt.none, key: 'work_weighted', format: fmt.hours, transform: v => v * 2 },
        { name: 'Alcohol', color: COLORS.ALCOHOL, scaleId: 'alcohol', range: [0, 10], axisFormat: fmt.none, key: 'alc_7day_sum', format: fmt.alcohol },
        { name: 'Mood', color: COLORS.MOOD, scaleId: 'mood', range: SCALES.mood, axisFormat: fmt.none, key: 'dep_7day_avg', requires: 'dep_raw', format: fmt.mood, transform: transformMood },
        { name: 'Sleep', color: COLORS.SLEEP, scaleId: 'sleep', range: SCALES.sleep, axisFormat: fmt.none, key: 'sleep_7day_avg', requires: 'sleep_raw', format: fmt.sleep, transform: transformSleep }
    ]);

    buildCard('hobbyChart', 'hobbyLegend', [
        { name: 'Actual', color: COLORS.HOBBY, scaleId: 'right', range: SCALES.hobby, axisFormat: fmt.hoursAxis, key: 'hobby_raw', format: fmt.hours },
        { name: 'Feels like', color: COLORS.HOBBY_LIGHT, scaleId: 'right', range: SCALES.hobby, axisFormat: fmt.hoursAxis, key: 'hobby_weighted', format: fmt.hours, light: true }
    ], { zones: HOBBY_ZONES });

    buildCard('workChart', 'workLegend', [
        { name: 'Actual', color: COLORS.WORK, scaleId: 'right', range: SCALES.work, axisFormat: fmt.hoursAxis, key: 'work_raw', format: fmt.hours, transform: v => v * 2 },
        { name: 'Feels like', color: COLORS.WORK_LIGHT, scaleId: 'right', range: SCALES.work, axisFormat: fmt.hoursAxis, key: 'work_weighted', format: fmt.hours, transform: v => v * 2, light: true }
    ], { zones: WORK_ZONES });

    const alcohol = buildCard('alcoholChart', 'alcoholLegend', [
        { name: 'Alcohol', color: COLORS.ALCOHOL, scaleId: 'right', range: [0, 10], axisFormat: fmt.alcoholAxis, key: 'alc_7day_sum', format: fmt.alcohol },
        { name: '15-day', color: COLORS.ALCOHOL_LIGHT, scaleId: 'right', range: [0, 10], axisFormat: fmt.alcoholAxis, key: 'alc_15day_avg', format: fmt.alcohol, light: true },
        { name: 'Mood', color: COLORS.MOOD, scaleId: 'mood', range: SCALES.mood, axisFormat: fmt.none, key: 'dep_raw', format: fmt.mood, transform: transformMood },
        { name: '7-day', color: COLORS.MOOD_LIGHT, scaleId: 'mood', range: SCALES.mood, axisFormat: fmt.none, key: 'dep_7day_avg', requires: 'dep_raw', format: fmt.mood, transform: transformMood, light: true }
    ]);
    // Mood zero, dashed
    alcohol.items[2].series.createPriceLine({
        price: 0, color: '#999', lineWidth: 1, lineStyle: LWC.LineStyle.Dashed, axisLabelVisible: false, title: ''
    });

    buildCard('sleepChart', 'sleepLegend', [
        { name: 'Raw', color: COLORS.SLEEP, scaleId: 'right', range: SCALES.sleep, axisFormat: fmt.sleepAxis, key: 'sleep_raw', format: fmt.sleep, transform: transformSleep },
        { name: '7-day', color: COLORS.SLEEP_LIGHT, scaleId: 'right', range: SCALES.sleep, axisFormat: fmt.sleepAxis, key: 'sleep_7day_avg', requires: 'sleep_raw', format: fmt.sleep, transform: transformSleep, light: true }
    ]);

    linkCharts();
}

function rowsFor(key, data) {
    if (key.startsWith('alc') || key.startsWith('dep')) return data.alcohol.data;
    if (key.startsWith('sleep')) return data.sleep.data;
    return data.category.data;
}

// Alcohol axis max from the whole history (rounded up to a 10), so zooming
// never rescales it and the summary + alcohol charts agree
function alcoholMaxOf(data) {
    const max = Math.max(0, ...data.alcohol.data.flatMap(d => [d.alc_7day_sum ?? 0, d.alc_15day_avg ?? 0]));
    return Math.max(10, Math.ceil(max / 10) * 10);
}

// Every calendar day from the first to the last row across the datasets
function calendarOf(data) {
    const all = [data.category, data.alcohol, data.sleep].flatMap(d => d.data.map(r => r.date)).sort();
    const out = [];
    for (let d = new Date(all[0] + 'T00:00:00Z'), end = new Date(all[all.length - 1] + 'T00:00:00Z'); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        out.push(d.toISOString().slice(0, 10));
    }
    return out;
}

// A day with no row, a null value, or (for a derived series) a null
// underlying raw value is ABSENT: whitespace, so no line is drawn through it.
// The API carries 7-day averages forward over days with no entry, which
// would otherwise draw a line across the gap.
function setData(data) {
    dates = calendarOf(data);
    const alcoholRange = [0, alcoholMaxOf(data)];
    const spine = dates.map(d => ({ time: d, value: 0 }));
    for (const card of cards) {
        card.spine.setData(spine);
        for (const item of card.items) {
            if (item.key.startsWith('alc')) item.range = alcoholRange;
            const byDate = new Map(rowsFor(item.key, data).map(r => [r.date, r]));
            const plotted = v => (item.transform ? item.transform(v) : v);
            // Hours readouts follow what's plotted (work is ×2); mood/sleep
            // readouts show the raw value, not the axis-shaping transform
            const shown = /^(hobby|work)/.test(item.key) ? plotted : v => v;
            item.lookup.clear();
            const points = dates.map(date => {
                const r = byDate.get(date);
                const v = r ? r[item.key] : null;
                const absent = v === null || v === undefined || (item.requires && r[item.requires] === null);
                if (absent) return { time: date };
                item.lookup.set(date, item.format(shown(v)));
                return { time: date, value: plotted(v) };
            });
            item.series.setData(points);
            item.curve.setPoints(points.map((p, index) => (p.value === undefined ? null : { index, value: p.value })));
        }
    }
    setHover(null);
}

// ---------------------------------------------------------------------------
// Linking: one time axis for every chart, one crosshair, one legend readout

function linkCharts() {
    for (const chart of charts) {
        chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
            if (linking || !range) return;
            linking = true;
            try {
                for (const other of charts) {
                    if (other !== chart) other.timeScale().setVisibleLogicalRange(range);
                }
            } finally {
                linking = false;
            }
            updateRangeButtons(range);
        });

        chart.subscribeCrosshairMove(param => {
            if (linking) return;
            const date = param.time ? toDateStr(param.time) : null;
            setHover(date);
            linking = true;
            try {
                for (const card of cards) {
                    if (card.chart === chart) continue;
                    if (date) card.chart.setCrosshairPosition(0, param.time, card.spine);
                    else card.chart.clearCrosshairPosition();
                }
            } finally {
                linking = false;
            }
        });
    }
}

function setHover(date) {
    const shown = date || dates[dates.length - 1] || null;
    for (const card of cards) {
        card.dateEl.textContent = shown ? formatDate(shown) : '';
        for (const item of card.items) {
            item.valueEl.textContent = shown ? (item.lookup.get(shown) ?? '–') : '';
        }
    }
}

// ---------------------------------------------------------------------------
// Range buttons (1M 3M 6M 1Y All)

function setRange(days) {
    const n = dates.length;
    if (!n) return;
    // autoSize hands the chart its width a frame after creation; a range set at 0 px is garbage
    if (charts[0].timeScale().width() === 0) { requestAnimationFrame(() => setRange(days)); return; }
    const to = n - 0.5;
    const from = days ? Math.max(-0.5, to - days) : -0.5;
    charts[0].timeScale().setVisibleLogicalRange({ from, to });
}

// Highlight the preset the current view matches (the widest one when the
// history is shorter than a preset, so "All" wins over "1Y"); none after a manual zoom
function updateRangeButtons(range) {
    const n = dates.length;
    const span = range.to - range.from;
    const atEnd = Math.abs(range.to - (n - 0.5)) < 0.75;
    let match = null;
    for (const button of document.querySelectorAll('#range button')) {
        const days = Number(button.dataset.days);
        const expected = days ? Math.min(days, n - 1) : n - 1; // the library clamps to [0, n-1]
        if (atEnd && Math.abs(span - expected) < 0.75) match = button;
        button.classList.remove('active');
    }
    if (match) match.classList.add('active');
}

document.getElementById('range').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button) setRange(Number(button.dataset.days));
});

// ---------------------------------------------------------------------------
// Stat cards

function getHobbyColor(hours) {
    if (hours < 7) return COLORS.RED;
    if (hours < 14) return COLORS.YELLOW;
    if (hours < 21) return COLORS.GREEN;
    return COLORS.GREEN_DARK;
}

function getWorkColor(hours) {
    if (hours < 14) return COLORS.GREEN;
    if (hours < 21) return COLORS.GREEN_LIGHT;
    if (hours < 28) return COLORS.YELLOW;
    return COLORS.RED;
}

function setStat(kind, side, hours, color, opacity) {
    const value = document.getElementById(`${kind}Value${side}`);
    const label = document.getElementById(`${kind}Label${side}`);
    const ring = document.getElementById(`${kind}Ring${side}`);
    value.textContent = hours;
    value.style.color = color;
    value.style.opacity = opacity;
    label.style.color = color;
    label.style.opacity = opacity;
    ring.style.setProperty('--p', Math.min(hours / 21, 1) * 100);
    ring.style.setProperty('--c', color);
    ring.style.opacity = opacity;
}

function updateStats(data) {
    const latest = data.data[data.data.length - 1];

    const hobbyRaw = Math.round(latest.hobby_raw / 60);
    const hobbyWeighted = Math.round(latest.hobby_weighted / 60);
    setStat('hobby', 'Left', hobbyRaw, getHobbyColor(hobbyRaw), 1);
    setStat('hobby', 'Right', hobbyWeighted, getHobbyColor(hobbyWeighted), 0.4);

    const workRaw = Math.round((latest.work_raw * 2) / 60);
    const workWeighted = Math.round((latest.work_weighted * 2) / 60);
    setStat('work', 'Left', workRaw, getWorkColor(workRaw), 1);
    setStat('work', 'Right', workWeighted, getWorkColor(workWeighted), 0.4);

    document.getElementById('latestOther').textContent = Math.round(latest.other_raw / 60);
}

// ---------------------------------------------------------------------------
// Category chips (instant tooltip; native title has a built-in delay)

let tagTooltipEl = null;

function getTagTooltip() {
    if (!tagTooltipEl) {
        tagTooltipEl = document.createElement('div');
        tagTooltipEl.className = 'tag-tooltip';
        document.body.appendChild(tagTooltipEl);
    }
    return tagTooltipEl;
}

function attachTagTooltip(tag, cat) {
    const info = TAG_INFO[cat];
    if (!info) return;

    tag.addEventListener('mouseenter', () => {
        const tooltip = getTagTooltip();
        tooltip.textContent = info;
        tooltip.style.visibility = 'hidden';
        tooltip.classList.add('visible');

        const rect = tag.getBoundingClientRect();
        const tipRect = tooltip.getBoundingClientRect();
        let left = rect.left + rect.width / 2 - tipRect.width / 2;
        left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));
        let top = rect.bottom + 8;
        if (top + tipRect.height > window.innerHeight - 8) top = rect.top - tipRect.height - 8;
        tooltip.style.left = `${left + window.scrollX}px`;
        tooltip.style.top = `${top + window.scrollY}px`;
        tooltip.style.visibility = '';
    });

    tag.addEventListener('mouseleave', () => {
        getTagTooltip().classList.remove('visible');
    });
}

function updateCategories(data) {
    const hobbyContainer = document.getElementById('hobbyCategories');
    const otherContainer = document.getElementById('otherCategories');
    hobbyContainer.innerHTML = '';
    otherContainer.innerHTML = '';

    for (const cat of data.hobby_categories) {
        const tag = document.createElement('span');
        tag.className = 'category-tag matched';
        tag.textContent = cat;
        attachTagTooltip(tag, cat);
        hobbyContainer.appendChild(tag);
    }
    for (const cat of data.other_categories) {
        const tag = document.createElement('span');
        tag.className = 'category-tag';
        tag.textContent = cat;
        attachTagTooltip(tag, cat);
        otherContainer.appendChild(tag);
    }
}

function updateTimestamp() {
    document.getElementById('lastUpdated').textContent = new Date().toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
}

function showError(message) {
    const main = document.querySelector('main');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = `Error: ${message}`;
    main.insertBefore(errorDiv, main.firstChild);
}

// ---------------------------------------------------------------------------

async function fetchAll() {
    const [category, alcohol, sleep] = await Promise.all([
        fetchCategoryData(), fetchAlcoholMoodData(), fetchSleepData()
    ]);
    return { category, alcohol, sleep };
}

function applyData(data) {
    setData(data);
    updateStats(data.category);
    updateCategories(data.category);
    updateTimestamp();
}

async function init() {
    const container = document.querySelector('.container');
    try {
        container.classList.add('loading');
        buildCharts(); // before the fetch, so they're laid out by the time data lands
        applyData(await fetchAll());
        setRange(DEFAULT_DAYS);
        container.classList.remove('loading');
    } catch (error) {
        console.error('Failed to load dashboard:', error);
        showError(error.message);
        container.classList.remove('loading');
    }

    setInterval(async () => {
        try {
            applyData(await fetchAll());
        } catch (error) {
            console.error('Auto-refresh failed:', error);
        }
    }, REFRESH_MS);
}

document.addEventListener('DOMContentLoaded', init);

// Test hook
window.__status = { get charts() { return charts; }, get cards() { return cards; }, get dates() { return dates; }, setRange };
