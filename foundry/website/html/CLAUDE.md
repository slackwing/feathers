# Website (foundry/website/html)

Source-controlled website that gets deployed to a GCP VM via rsync.

## Deploying

From this directory (`html/`), run:

```
ws_prod
```

This is a shell alias for `website_sync . . master` (defined in the user's shell rc). It rsyncs the current directory to `acheong87@35.243.192.242:/var/www/html/` with `--delete`, requires the `master` branch, and must be run from a directory named `html`.

Protected paths (not deleted/overwritten on the remote): `.staging/`, `shared/assets/`, `**/wordpress/`.

### Expected non-fatal errors

Exit code 23 with `Permission denied` on `.well-known/ssl-manager/*` is normal — those files are owned by the SSL manager on the VM and rsync's `--delete` can't remove them. Site content still uploads successfully. Only worry if the errors involve other paths.

## Built sites: hxh

`hxh/` is not hand-written JS any more: its source is ES modules in
`hxh/os/` + `hxh/apps/`, bundled by esbuild into the committed
`hxh/hxh.js` + `hxh/hxh.css`. From `foundry/website/`:

```
npm install        # once per machine (node_modules/ is git-ignored)
npm run check      # = npm run build && npm test — REQUIRED before ws_prod
```

`npm test` (node --test + jsdom) includes a bundle-staleness test, so
a forgotten build fails the check. Never edit `hxh.js`/`hxh.css` by
hand; bump their `?v=` in the three hxh pages when they change. Details
in `hxh/CLAUDE.md`.

## Cross-project standard paths (underscore convention)

Some files live in the SAME place in every website because the shared
auth system (`/admin/` console + hobby-server) reaches into them by
convention. They are named with a leading underscore so they stand out
from a site's own pages:

- `<site>/_invite/index.html` — the site's invite page (choose a
  password). Invite links point at `/<site>/_invite/?code=`.
- `<site>/_reset/index.html` — the site's password-reset page. Reset
  links point at `/<site>/_reset/?code=`.
  Both are SKINS: markup + styling only, tagged with `data-pw` hooks,
  over the shared machinery `/admin/assets/setpw.js` (hxh's skin is
  the `SetPassword` app in `hxh/apps/setpw.js`). A site with no
  skin gets the default pages `/admin/_invite/` and `/admin/_reset/`
  automatically. Without a code either page renders disabled.
- `<site>/_email/` — the site's email templates: `templates.json`
  (manifest: id, name, subject, title, kicker, heading, and
  `invite` / `reset` / `on` flags), `_layout.html` (the one shared
  frame), one `<id>.html` body per template, and an admin-only
  `index.html` that previews them (plain admin style, inert frame,
  `?template=&user=`). hobby-server fetches these over HTTP when the
  console sends mail — the server stores no templates.

Themed like their site (except the `_email/` previewer, which stays
plain); when a site's look changes, change its `_invite/`, `_reset/`
and `_email/` in the same commit. Full spec and the variable list:
`~/src/hobby-server/docs/SHARED_AUTH.md`. Reference implementation:
`hxh/`.
