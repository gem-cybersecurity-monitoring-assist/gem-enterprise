# GEM Call Studio virtual team update — 2026-10-11

Installed on GEM-ASSIST in C:\Program Files\GEM Call Studio\app.
Prior installed sources and bundle backed up under
C:\ProgramData\GEM Call Studio\backups\virtual-team-20261011.

Implemented: browser-local IndexedDB team profiles; 1–8 reference images,
separate background and voice reference; previews; save/select/delete; full-body
mode as default; disabled local fallback; live output blocked before camera
capture while full-body engine and voice conversion are unavailable.
Legacy explicit demonstration modes are preserved and labeled as such.

Verification on the actual computer:
- Node syntax checks and esbuild bundle: passed.
- Local installed application test suite: 19/19 passed.
- Headless Edge actual UI: saved two reference images plus background;
  persistence after reload passed; missing engine rejected before source or
  output capture; synthetic test profile removed.

Still missing: full-body motion synthesis from uploaded images, expression/lip
synchronization, live custom voice conversion, virtual microphone, actual
two-client Zoom/Teams/WhatsApp acceptance. Uploading a sample does not create a
voice model. Existing local-avatar.js overlays a face on camera footage and is
not the requested full-body renderer. No paid services were activated.

The files here are installed-app source snapshots for review, not a new Next.js
route or auto-install action. They rely on the existing GEM Call Studio 2.3.1
package dependencies, backend and other source files. Never overwrite an
active user's installation blindly; compare source and back up first.

Profiles are browser-local, not encrypted vault storage or cloud-synced team
records. Shared Windows/browser users can access the same profile store.
Deleted profile records are removed from IndexedDB; forensic deletion is not
guaranteed. No original customer media was used during testing.

Rollback: restore studio.js, index.html and studio.bundle.js from the backup to
app/src/studio.js, app/public/index.html and app/public/assets/studio.js.
Remove the new virtual-team module/test if desired. No database migration.
