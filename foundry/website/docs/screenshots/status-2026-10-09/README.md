# /status/ baseline — 2026-10-09

Screenshots of the Chart.js status dashboard before the chart rewrite.
The rewrite was developed at /status/new/ and promoted to /status/ on
2026-10-13 (the old page lives on in git history before that commit).
Captured headless (Chrome via playwright-core) at 1400px/2x and 390px/3x;
`capture.mjs` is the script. Sleep chart is empty because sleep data
stops at 2026-08-20.

## The rewrite (same day)

`new-*.png`: the rewrite (TradingView Lightweight Charts) at its initial
1M view, the All view, mid-hover, and mobile. `check_new.mjs` drives the
page headless (initial 30-day range, linked wheel zoom / drag pan / hover,
range buttons, DRC readout, mobile overflow) and re-takes these shots —
prod by default, `URL=http://127.0.0.1:8771/status/` for the local
preview `serve.mjs` (serves `html/`, proxies `/status/api/*` to prod).
Both need playwright-core + system Chrome.
