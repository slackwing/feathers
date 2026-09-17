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

## Cross-project standard paths (underscore convention)

Some files live in the SAME place in every website because the shared
auth system (`/admin/` console + hobby-server) reaches into them by
convention. They are named with a leading underscore so they stand out
from a site's own pages:

- `<site>/_invite/index.html` — the site's invite / set-password page.
  Invite links generated in the console point at `/<site>/_invite/?code=`.
  Opened without a code by a logged-in user it becomes "change password".
  It must make clear the invitee CHOOSES a password, say "password" (not
  "passphrase"), and honour `?preview=invite|change|void` so that
  `<site>/_invite/preview.html` — a plain admin-style previewer, same
  look as the email one — can show every state in an inert frame.
- `<site>/_email/` — the site's email templates: `templates.json`
  (manifest: id, name, subject, `invite`/`on` flags), one `<id>.html`
  body per template (email-safe HTML: tables + inline styles), and an
  admin-only `index.html` that previews them with sample data and can
  send a test. hobby-server fetches these over HTTP when the console
  sends mail — the server stores no templates.

Both are themed like their site; when a site's look changes, change
its `_invite/` page and `_email/` templates in the same commit. Full
spec and the variable list: `~/src/hobby-server/docs/SHARED_AUTH.md`.
Reference implementation: `hxh/`.
