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
