# Smooth loading: caching research and loading plan (Nov 5, 2026)

The owner asked for page changes to feel as smooth as Divar: tap a listing, see something move at once, then the page. Also: put caching first, check the "cookie caching" from before, and show the loading styles to choose from. This is research only. **Nothing in the app or in Cloudflare was changed.**

How it was checked:
- Cloudflare's settings read through the API (read-only), and every kind of address measured with `curl` from this server (Germany).
- Today's tap measured in a headless phone browser on a slowed connection (Lighthouse's "slow 4G": 150 ms round trip, 1.6 Mbit/s, phone CPU 4× slower), 12 taps.
- Divar's web site opened in the same way, and its loading screens captured.
- Cloudflare's and Next.js's documentation, and what big sites send (sources at the end).

---

## 1. The short answers

1. **Our server is fast. What's missing is a sign that something is happening.**
   - Pages answer in 0.1–0.3 s.
   - On a slowed phone, a tap on a listing card changes **nothing on screen for 0.7–1.4 s** (median 0.9 s), then the whole page appears at once.
   - Divar shows a circle within 0.15 s, and the listing within 0.4 s.
   - The reason: we have no loading screens. Next.js keeps the old page frozen until the new one has fully arrived. Without a loading screen it also can't prepare links ahead.
2. **Cloudflare caching makes the *first* page faster, not taps inside the site.**
   - A tap inside the site fetches a special "page data" request. Cloudflare never keeps those, for anyone, signed in or not.
   - So caching helps people who arrive from Telegram, WhatsApp or Google, and every reload.
   - The smooth feel when moving around the site comes from loading screens, which are a code change.
   - Both are in the plan: caching first, as asked (section 3), then loading screens (sections 5–6).
3. **The "cookie caching": we never had it on.** Section 4 explains it in plain words.
4. **Recommended loading style: option 4, a thin turquoise line at the top plus grey outlines of the coming page.** It is what YouTube does. Divar uses option 1, the circle. The owner decides (section 5).

---

## 2. What we have today (measured Nov 5, 2026)

**Plan:** Cloudflare **Free** (`peydoo.com`, which covers staging and production).

### Pages and files

| What | Cloudflare | Time from Germany | Notes |
| --- | --- | --- | --- |
| Browse pages (`/germany`, `/germany/berlin`, `/germany/berlin/jobs`) | HIT for 60 s, then one MISS | 0.08 s HIT, 0.22–0.26 s MISS | Signed-out visitors only (`s-maxage=60`) |
| Listing page (`/v/…`) | BYPASS (never kept) | 0.19–0.29 s | `private, no-store` for everyone |
| Home `/`, `/help`, `/login` | BYPASS | 0.11–0.21 s | `private, no-store` |
| A tap inside the site (page data, "RSC") | never kept | 0.25–0.33 s | Left out of the Cache Rule on purpose ("Browsing and favorites" in `docs/setup.md`) |
| A link prepared ahead (prefetch) of a listing | never kept | 0.19–0.24 s, **304 bytes** | Almost empty: with no loading screen, Next.js has nothing to prepare |
| JS and CSS (`/_next/static`) | HIT, kept 1 year | 0.08 s | Arrives **gzip-compressed** (see "Compression") |
| Font (Vazirmatn, 80 KB) | HIT after the first visit | 0.08–0.12 s | Preloaded in the page's `Link` header |
| Photos (`img-staging.peydoo.com`, imgproxy) | HIT, kept 1 year | 0.08 s | WebP, fixed sizes, blurred placeholder on the listing page |
| Street map (`/map/`) | its own Cache Rule | — | Not on browse or listing pages |

What one Berlin page weighs: 26 KB HTML, 12 JavaScript files (260 KB compressed), 16 KB CSS and an 80 KB font. Everything after the HTML is kept a year in the browser, so repeat visits only fetch the HTML.

### Cloudflare speed settings

| Setting | Now | Comment |
| --- | --- | --- |
| HTTP/3, HTTP/2, TLS 1.3 | on | good |
| Smart Tiered Cache | on (Nov 2) | good, free |
| Compression to visitors | Zstandard (Free plan's default) | only where our server doesn't compress first |
| **Early Hints** | **off** | free; worth turning on (section 3) |
| **Speed Brain** | off | doesn't work with our security header (nonce). Leave off |
| 0-RTT | off | free; possible later, after a check (section 3) |
| Rocket Loader | off | keep off: it rewrites our scripts and would fight the security header |
| Auto Minify, Mirage | off / retired by Cloudflare | nothing to do |
| Polish (image compression) | not on Free | imgproxy already makes WebP |
| Always Online | off | keep off: it disables "serve stale while refreshing" |
| Cache Rules | 2 of 10 | `staging_browse_logged_out` (both hosts) and `/map/` |
| Regional Tiered Cache, Cache Reserve | not on our plan | Enterprise only, or a paid add-on (section 3) |

**Why the 60-second browse cache rarely helps today.** We send `s-maxage=60`. Cloudflare's docs say `s-maxage` *forbids* serving an expired copy while refreshing. So the first visitor after each quiet minute waits for a full render (EXPIRED). At today's traffic most visitors arrive after a quiet minute, so most of them wait.

---

## 3. Caching options, best gain first

Each option below says what it is, what we would gain, and what it costs.

### 3.1 Serve the stored copy while it refreshes ("stale-while-revalidate") on browse pages. **Do first.**

- **What.** Keep a browse page "fresh" for 60 s as now, and after that allow Cloudflare to keep handing out the stored copy for up to 10 more minutes while it fetches a new one in the background. Since Feb 2026 Cloudflare refreshes truly in the background (status UPDATING); its docs list no plan limit for this.
- **How.** Send a second header meant only for Cloudflare: `Cloudflare-CDN-Cache-Control: max-age=60, stale-while-revalidate=600, stale-if-error=86400`. Visitors' browsers keep `max-age=0`, so a browser never shows its own old copy. One line in `browseCacheControl()` (`src/proxy.ts`); the Cache Rule stays as it is.
- **Gain.** Almost every signed-out browse page opens in about 0.08 s instead of 0.22–0.26 s, even after a quiet spell. Bonus (`stale-if-error`): if the server is down or restarting, browse pages still show for a day instead of an error page.
- **Cost.** After a quiet spell, the first visitor may see a list up to 10 minutes old. Only that visitor: the next one gets the new list. A new listing still shows on its own page at once.
- **Check on staging.** Cloudflare's page on this header names `stale-if-error` but not `stale-while-revalidate`. Test that UPDATING appears before relying on it. If it doesn't, the same works with a Cache Rule edge time plus `max-age` in the normal header.

### 3.2 Keep signed-out listing pages too, and clear them when the listing changes. **Biggest gain for newcomers.**

- **What.** Listing pages are what people open from a Telegram post, a WhatsApp share or Google. Today every one of those is rendered fresh. Keep them like browse pages (60 s fresh plus stale-while-revalidate), and clear the listing's address in Cloudflare the moment the seller edits, pauses, sells or deletes it. The worker already clears pages for take-downs with `CLOUDFLARE_PURGE_TOKEN`.
- **Gain.** First opens go from 0.19–0.29 s to about 0.08 s. More important at launch: a busy Telegram post can send hundreds of people to one listing within a minute. Today each one is a render on our server; afterwards it is one render a minute.
- **Work (about 1–2 days, then a security check).**
  - **View counting** for sellers' stats happens during the page render today (`countView`). With a stored copy, most visits would no longer count. It has to move to a small "seen" request sent after the page loads, as the visit counter already does.
  - **Personal bits.** The ♡ state, the seller's own buttons and "۴ نفر نشان کرده‌اند", the published banner and test-account listings must not be in the shared copy. Signed-out visitors don't see these today, and signed-in visitors keep a fresh page as now (the Cache Rule skips the session cookie). Only `viewerSeesTest()` needs a look.
  - **The nonce.** The security code (nonce) is shared by everyone who gets one stored copy, as it already is on browse pages. That was accepted on Oct 19 because those pages have no place where the browser itself writes outside text into the page. The listing page needs the same check. The photo viewer reads `#photos` from the address but only opens a dialog with it; check that and keep it that way.
  - **Purge on change.** Clear the listing page's address and its old addresses when the title, and so the slug, changes. Browse pages keep their 60-second bound.

### 3.3 Early Hints. **Free, a few clicks.**

- **What.** While our server is still building a page, Cloudflare already tells the browser "you will need this CSS and this font", from what the same page needed last time.
- **Gain.** On a first visit the font (80 KB) and the CSS start 0.1–0.3 s earlier, so text appears sooner. This helps every page, even uncached ones. Repeat visitors gain nothing (the files are already in their browser).
- **Safe for us.** Our `Link` header lists only our own font and CSS, no scripts, so the nonce doesn't matter here.
- **Note.** The switch covers the whole zone, so staging and production together. A staging-only switch needs a Configuration Rule per host, which our tokens can't make. It is off again in one click.

### 3.4 Let Cloudflare do the compression. **Small, free, one line of code.**

- **What.** Next.js gzips our JS and CSS itself. Cloudflare passes gzip on as it is, so visitors never get the smaller Zstandard. Setting `compress: false` in `next.config.ts` lets Cloudflare compress instead.
- **Gain.** About 12% smaller files: the CSS measured 16.4 KB with gzip against 14.1 KB with Zstandard. That is roughly 30 KB less on a first visit, about 0.15 s on a slow phone, plus less CPU work on the 4 GB server.
- **Correction (Nov 6, after the build).** `compress: false` alone changed nothing for visitors: Coolify's Traefik also gzips every answer of the web app (its `gzip` middleware), so JS and CSS still arrive as gzip. The rest of this step is turning off Coolify's gzip for `classifieds-web` and checking that Cloudflare then sends Zstandard.
- **Side note.** Photos and the font also arrive gzip-wrapped, which gains nothing on WebP or WOFF2. Probably Traefik's compression on the imgproxy service. Low priority.

### 3.5 0-RTT. **Later, after a check.**

- **What.** It saves one round trip (about 0.05–0.15 s) on the first request of a returning visitor. Free.
- **Risk.** Those first requests can be replayed by an attacker. Cloudflare only allows it for GET, so first every GET address that changes something (unsubscribe links, sign-out, "mark as read") must be checked. Small gain; not now.

### 3.6 Signed-in users get the shared copy ("hole punching"). **Not now: revisit after launch.**

- **What.** Signed-in visitors would get the same stored page as everyone. Their personal bits fill in from one small request after the page loads: avatar instead of «ورود», the unread badge, filled hearts, the seller's own buttons.
- **Where it fits.** Browse pages, listing pages, help and legal pages, the home page. Not "my listings", chat, account, the posting form or saved listings: those are personal throughout.
- **Gain.** Signed-in users' first loads and reloads would drop from about 0.2–0.3 s to 0.08 s. But signed-in users mostly move by taps, and taps are never cached (section 1). So the felt gain is small: a few reloads a day.
- **Cost and risks.**
  - **Work.** About 3–5 days. The header, hearts, theme choice and seller tools move to small personal requests, and these pages must never read the session while rendering. That needs a test to guard it, because a single slip would put one person's data into a page everyone sees.
  - **Flash.** For a split second the header shows a neutral placeholder before the avatar, and hearts fill in late. This can be softened (keep space for the avatar, never show «ورود» first) but not removed.
  - **Theme.** Today a chosen light or dark theme is rendered by the server, so it skips the cache. It would move to a tiny script that runs before the page paints.
  - **The nonce.** It would be shared with signed-in users too. That is acceptable only with the same "no page-writing" rule as above.
- **What big sites do** (checked with `curl` today):
  - Airbnb, Vinted, Kleinanzeigen, GitHub and Divar send `private` or `no-store`, or bypass the CDN. **None of them share stored pages even with signed-out visitors.**
  - Shared copies with personal holes are common in shops (Fastly/Varnish ESI, Shopware 6.7).
  - Wikipedia shares pages with signed-out readers only, as we do now.
  - Next.js's own way to do this (`"use cache: private"`, Partial Prerendering) doesn't work with a nonce security header.
- **Verdict.** Our server already answers in 0.1–0.3 s, so the gain doesn't pay for the work and the leak risk now. Look again if traffic grows enough that signed-in reloads load the server.

### 3.7 Paid options. **None worth it at our size.**

| Option | Price | What it would do for us | Verdict |
| --- | --- | --- | --- |
| Pro plan | $25 a month ($20 a month paid yearly) | Polish image compression (imgproxy does this already), 25 Cache Rules instead of 10, Brotli instead of Zstandard. Nothing for taps | Not worth it |
| Argo Smart Routing (now inside "Smart Shield + Argo") | from $5 a month plus traffic | Faster path from Cloudflare to our server for uncached requests. Our server is in Germany and most visitors are in Europe, so roughly 10–30 ms | Not now |
| Cache Reserve | $0.015 per GB a month plus requests | Keeps files for long periods; needs at least 10-hour times | Our pages live 60 s and photos already stay at Cloudflare. No use; the Smart Shield package that includes it isn't sold to Free or Pro plans |
| Regional Tiered Cache | Enterprise | — | Smart Tiered Cache (free, on) covers us |
| APO | $5 a month | WordPress only | Not for us |

### 3.8 Not chosen

- **Speed Brain.** Cloudflare says it doesn't work with a nonce security header, and it only prepares pages Cloudflare has stored. Next.js's own link preparation does this job better.
- **Caching tap requests ("page data").** Possible in theory for signed-out visitors, but Next.js varies these by headers, and Cloudflare can only key the cache on headers on Enterprise. One wrong copy breaks navigation for everyone (we saw this risk on Oct 19). Not worth it.

---

## 4. The "cookie caching", in plain words

**We never had it on.** Better Auth (our sign-in library) has a setting called "cookie cache". It has been **off since the first sign-in code on Oct 16, 2026**, on purpose (`src/modules/users/auth.ts`, `docs/setup.md` "Sessions").

**What it would do.** When you are signed in, every page asks our database "is this sign-in still valid?". That takes a few milliseconds. The cookie cache would put a signed copy of the answer in your browser for 5 minutes, so the server skips that question.

**What it would not do.** It doesn't put signed-in users on Cloudflare's cache. Pages would still be built fresh for each signed-in person, so it makes no visible difference to speed.

**The price.** If you remove a device in «دستگاه‌های من», or an account is banned or deleted, that device stays signed in for up to 5 more minutes.

**What you may remember.** On Oct 19 we added a Cloudflare rule that looks at the sign-in cookie. It does the opposite of caching for signed-in users: when it sees the cookie, it skips the cache. That way nobody ever sees a page meant for someone else.

**Recommendation: keep it off.** The one place it could matter is link preparation (section 6). Each prepared link asks the database once for a signed-in user. Measure that first; turn the cache on only if the measurement shows the database struggling.

---

## 5. The loading styles, for the owner to choose

All four are drawn on our real pages: the real Berlin and listing pages from staging, with the app's own fonts, colours and right-to-left layout. Each grey outline was made from the real page, so it has exactly that page's shape. Sample listings only; the seller's name is replaced with «فروشندهٔ نمونه».

| | Style | What you see after a tap | Who does it |
| --- | --- | --- | --- |
| 1 | **Circle in the middle** | The header stays; the page goes blank with a turquoise circle in the middle; then the page | **Divar** (web: a small grey circle, then the listing; a circle on the photo until it loads) |
| 2 | **Grey outlines** | At once, grey shapes of the coming page (photo, title, price, fact tiles, cards) with a soft shimmer moving right to left; then the page fills in, in place | Facebook, Airbnb, Vinted |
| 3 | **Thin line at the top** | The old page stays (the tapped card lightly highlighted) while a thin turquoise line grows across the top; then the new page | YouTube's top bar, GitHub |
| 4 | **Line + outlines (recommended)** | The line starts at the top **and** the grey outlines appear at once | YouTube (red line plus grey outlines) |

**Pictures** in `/root/peydoo-media/wave2/smooth-loading/png/`:
- `circle/`, `skeleton/`, `line/`, `combo/`: each style on phone (390 px) and computer (1440 px), light and dark, while a listing loads (`*-listing.png`) and while Berlin's list loads (`*-city.png`). 32 pictures.
- `divar/`: Divar's web site on a computer-size window. `computer-after-tap-150ms.png` (blank page with a circle), `-400ms.png` (the listing, a circle on the photo), `computer-direct-*.png` (a listing opened from a link).
  - Divar's phone layout couldn't be captured: its site picks the phone layout by browser identity, and pretending to be a phone was refused.
- `before/phone-listing-after-tap.png`: today, once the listing finally appears.

**Recordings** in `/root/peydoo-media/wave2/smooth-loading/video/`:
- **`compare-phone-light.webm` and `compare-phone-dark.webm`: all four side by side on a phone, the same tap at the same moment. Start here.**
- One recording per style, phone and computer: `circle-*.webm`, `skeleton-*.webm`, `line-*.webm`, `combo-*.webm`. Each shows tapping a listing in Berlin, then tapping Berlin on the Germany page.
- `before-peydoo-phone-slow4g.webm`: today's tap on a slowed phone (frozen, then the page).
- `divar-computer-slow4g.webm`: Divar on the same slowed connection.

The demos hold each loading screen for about 1.9 s so it can be seen. With links prepared ahead, the real wait will usually be shorter.

### Why option 4

- **The outlines are what makes it feel like the page is "already there".** The page fills in where the grey shapes were instead of replacing a blank screen, so nothing jumps. Nielsen Norman Group recommends outlines for full-page loads.
- **The line covers every other page.** On pages where an outline isn't worth drawing (help pages, settings, admin), the line alone says "working on it". One small piece of code covers the whole site.
- **The circle (Divar) is honest but empty.** A blank page with a circle makes the wait the main thing on screen. NN/g suggests circles for 2–10 second waits; ours are under 1.5 s. Divar can do it because its text arrives in 0.4 s.
- **The line alone keeps the old page frozen**, which is today's problem with a hint added. On a slow phone, people tap again.
- **The research is mixed, so practice decides.** One study (Viget, 136 people) found outlines felt slightly *slower* than a circle; others found a slow, gentle shimmer feels shorter. The big apps people use every day (YouTube, Facebook, Airbnb, Vinted) show outlines for page loads, so that is what our users are used to.
- **Fine points.**
  - The line waits about 0.1 s before showing, so fast taps don't flicker.
  - The shimmer moves right to left, in our reading direction.
  - In dark mode the outlines use the dark card colours.

---

## 6. The loading plan (after the owner picks a style)

Loading screens use Next.js's `loading.tsx`, one per page type. Each outline is drawn by hand to match its page, simpler than the demo: no text widths, just the shapes.

| Page | Loading screen |
| --- | --- |
| Listing page | Photo block (phone: full width with back, share and ♡ circles; computer: photo with the card beside it), title, price, place, 4 fact tiles; phone: the bottom chat bar outline |
| Country, city and category pages, events lists | Search and chips stay real; result line, then 6 card outlines (grid; list view uses list rows) |
| Search results (`?q=`) | Same as browse pages |
| Posting form (`/new`, the 4 steps) | Step header with the progress dots, then field blocks |
| My listings, saved listings | 4 list rows (photo square, two lines, the action button) |
| Chat | List: 6 conversation rows. A conversation: the header and 4 message bubbles, alternating sides |
| Account and settings | Hub rows |
| Everything else | Only the top line |

**Links prepared ahead.**
- Once loading screens exist, Next.js prepares the loading screen of every link on screen, so the outline appears instantly on tap.
- The prepared requests aren't cached (section 1), so each one is a small render on our server. Measure the server load on staging with a full city page.
- If it's too much, prepare only when a finger touches a card or a mouse rests on it. That still gives about 0.1–0.2 s of head start.

**An instant back button.**
- Next.js already brings back the previous page from memory on Back, with no server request. Check that it does so with the scroll position kept.
- Then set `staleTimes.dynamic` to 30 s in `next.config.ts`. Going back to a page through a link (not the back button) within 30 s also opens instantly.
- Actions that refresh the page (♡, save, send) should clear that memory, so nobody sees an outdated heart. Check each one when building.

**Photos without jumps.**
- Already done for cards (fixed 4:3 boxes) and the listing photo (fixed box with a blurred preview).
- Two business forms show photos without a fixed size (`src/app/b/[slug]/manage/page.tsx`, `src/app/business/business-form.tsx`); give them one.
- The "after" measurement checks layout jumps (CLS) on every page above.

**Measuring before and after.**
- The script `/root/peydoo-media/wave2/smooth-loading/scripts/measure.mjs` taps a Berlin listing on a slowed phone and times the first change on screen and the listing's title.
- **Before (today, 12 taps):** first change 0.7–1.4 s (median 0.9 s), and that first change *is* the whole page; nothing in between.
- **Goal after:** first change under 0.1 s (the outline), the full listing under 1 s on the same slowed phone, no layout jumps (CLS under 0.1), and first opens of cached pages under 0.1 s from Germany.
- Run it again after each step; check light and dark, phone and computer, open sheets and menus.

---

## 7. Plan for approval

### In Cloudflare (free; each step on staging first, after the owner's OK)

1. **Early Hints on.** The switch is zone-wide, so production gets it too. Off again in one click.
2. Nothing else changes in Cloudflare. The Cache Rule stays as it is: stale-while-revalidate and listing pages are decided by the server's headers.

### In code (each step: plan, approval, staging, measure)

1. **Loading screens and the top line**, in the style the owner picks, for the pages in section 6. This is the part the owner will feel on every tap. About 2–3 days.
2. **Stale-while-revalidate on browse pages** (one header, section 3.1). Test UPDATING on staging. Half a day.
3. **Signed-out listing pages cached and cleared on change** (section 3.2): view counting after load, purge on every change, security check. 1–2 days.
4. **Cloudflare compresses** (`compress: false`, section 3.4). An hour, plus a check that every file still arrives compressed.
5. **Back button and 30-second memory** (`staleTimes`), and fixed photo sizes on the two business forms. Half a day.
6. **Measure again** with the same script, and report before and after.

### Later

- 0-RTT, after checking that no GET address changes anything.
- Signed-in users on the shared copy, if traffic ever calls for it.
- The Better Auth cookie cache, only if link preparation measurably loads the database.

---

## Sources

- Cloudflare, revalidation and `s-maxage`: https://developers.cloudflare.com/cache/concepts/revalidation/
- Cloudflare, background refresh (Feb 26, 2026): https://developers.cloudflare.com/changelog/post/2026-02-26-async-stale-while-revalidate
- Cloudflare, `CDN-Cache-Control`: https://developers.cloudflare.com/cache/concepts/cdn-cache-control/
- Cloudflare, Early Hints: https://developers.cloudflare.com/cache/advanced-configuration/early-hints/
- Cloudflare, Speed Brain (not with nonce or `strict-dynamic`): https://developers.cloudflare.com/speed/optimization/content/speed-brain/
- Cloudflare, compression (Free sends Zstandard; origin gzip passes through): https://developers.cloudflare.com/speed/optimization/content/compression/
- Cloudflare, 0-RTT: https://developers.cloudflare.com/speed/optimization/protocol/0-rtt-connection-resumption/
- Cloudflare, Cache Rules (10 on Free; cookie cache keys Enterprise only): https://developers.cloudflare.com/cache/how-to/cache-rules/
- Cloudflare, Tiered Cache: https://developers.cloudflare.com/cache/how-to/tiered-cache/
- Cloudflare, Cache Reserve pricing: https://developers.cloudflare.com/cache/advanced-configuration/cache-reserve/
- Cloudflare, plans and prices: https://www.cloudflare.com/plans/network-cdn/
- Next.js, security header with nonce (pages must be dynamic; no PPR): https://nextjs.org/docs/app/guides/content-security-policy
- Next.js, `loading.js` and prefetching: https://nextjs.org/docs/app/api-reference/file-conventions/loading
- Next.js, `staleTimes`: https://nextjs.org/docs/app/api-reference/config/next-config-js/staleTimes
- Next.js, `useLinkStatus`: https://nextjs.org/docs/app/api-reference/functions/use-link-status
- Better Auth, session cookie cache: https://www.better-auth.com/docs/concepts/session-management
- Fastly, edge side includes: https://www.fastly.com/blog/using-esi-part-1-simple-edge-side-include
- Shopware 6.7 caching for signed-in users: https://www.shopware.com/en/news/new-caching-system
- Wikipedia's cache for signed-out readers: https://www.mediawiki.org/wiki/Manual:Varnish_caching
- Nielsen Norman Group, response times: https://www.nngroup.com/articles/response-times-3-important-limits/
- Nielsen Norman Group, progress indicators: https://www.nngroup.com/articles/progress-indicators/
- Nielsen Norman Group, skeleton screens: https://www.nngroup.com/articles/skeleton-screens/
- Viget, skeleton screens study: https://www.viget.com/articles/a-bone-to-pick-with-skeleton-screens
- Luke Wroblewski on spinners: https://www.lukew.com/ff/entry.asp?1797
- Big sites' headers (Airbnb, Vinted, Kleinanzeigen, GitHub, Divar): checked with `curl` on Nov 5, 2026.
- Divar's loading screens: captured on Nov 5, 2026 (pictures above).
