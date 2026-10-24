# Design-direction mockups (Oct 24, 2026)

Sources of the mockups in `docs/design-options.md`. Not app code: static HTML with Tailwind's play CDN, logical classes only. `a/` is direction A «آشنا», `b/` B «صیقل‌خورده», `c/` C «محله»; each has `home`, `category`, `listing` and `post`, responsive (phone and computer from the same page).

Not in Git (put them next to this README before rendering):
- `Vazirmatn-subset.woff2`: copy from `src/app/fonts/`.
- `Estedad.woff2` and `Estedad-latin.woff2` (direction C): `@fontsource-variable/estedad@5.3.0`, files `estedad-arabic-wght-normal.woff2` and `estedad-latin-wght-normal.woff2` from jsDelivr.
- `img/`: `room1–9.webp` and `rug1–3.webp` from the two staging listings; `car.jpg`, `phone.jpg`, `setar.jpg`, `yalda.jpg` from Wikimedia Commons (credits in `docs/design-options.md`).

Render (one Chromium at a time; run `free -m` first). `render-mockups.mjs` expects this folder as `/work/mock` and writes to `/work/shots/mock`:

    docker run --rm --memory=1g -v "$PWD/..":/work -w /work mcr.microsoft.com/playwright:v1.63.0-noble \
      sh -c 'npm i --no-save --prefix /tmp/pw playwright@1.63.0 && NODE_PATH=/tmp/pw/node_modules node mockups/render-mockups.mjs a/home a/listing'

(rename the folder to `mock` or adjust the paths in the script). `shoot-staging.mjs <outdir>` takes the staging screenshots and replaces seller names, emails and phone-like numbers on the page before each shot.

## Final design (round 2, Oct 24, 2026)

`final/` holds the final proposal built on direction B (the owner's choice): `home`, `browse`, `category`, `filters` (the same page with the phone filter sheet open), `listing`, `post1`–`post4`, `posted`, `mylistings`, `mylistings-menu`, `chat`, `account`, `admin-item`, `admin-overview`, `admin-system`. Shared parts are in `final/ui.js`. `faDigits()` in `common.js` writes codes and years without separators.

Signed-in screenshots of staging: `shoot-signed-in.mjs <email> <code> <outdir>` enters an email code the owner requested on their own phone (Turnstile blocks headless Chromium on "send code", but not on entering it), saves the session to `/work/state.json` and screenshots the signed-in pages with names, emails, phone numbers and chat texts replaced. `shoot-admin.mjs` (needs `ADMIN_PATH` in the environment, never printed) waits on the admin's two-step page for a code in `/work/totp.txt`, then screenshots every admin page with user names, emails, phones and IPs replaced. A 6-digit TOTP code expired on the way through the chat; a fresh one sent right after it changed worked. Sign the session out afterwards and delete `state.json`.
