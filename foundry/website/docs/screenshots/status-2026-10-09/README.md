# /status/ baseline — 2026-10-09

Screenshots of the Chart.js status dashboard before the chart rewrite
(new page developed at /status/new/, to replace /status/ later).
Captured headless (Chrome via playwright-core) at 1400px/2x and 390px/3x;
`capture.mjs` is the script. Sleep chart is empty because sleep data
stops at 2026-08-20.

## The rewrite (same day)

`new-*.png`: `/status/new/` (TradingView Lightweight Charts) at its initial
1M view, the All view, mid-hover, and mobile. `check_new.mjs` drives the
page headless (initial 30-day range, linked wheel zoom / drag pan / hover,
range buttons, mobile overflow) and re-takes these shots; `serve.mjs` is
the local preview it was developed against (serves `html/`, proxies
`/status/api/*` to prod). Both need playwright-core + system Chrome.
