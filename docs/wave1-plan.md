# Wave 1 build plan: the «صیقل‌خورده» redesign

Oct 27, 2026 · for the owner's approval · no app code changed yet · branch `wave0` (`/root/classifieds-wave0`; wave 0 and wave 1 go live together)

Sources: `docs/design-options.md` (round 2 "Final design", round 3, round 5 dark mode, and the owner's decisions), the plan page `docs/design-options/launch-plan.html` (version 6, "build": wave 1), the mockups in `docs/design-options/mockups/final/`, and today's code.

## In short

Today's look stays: turquoise, saffron, Vazirmatn, rounded cards, logo. What changes is how easy each page is to use. No URL changes, no data lost. One small migration (event reminders and business follows).

| # | Part | Days (estimate) | Mockups (`final/`) |
| --- | --- | --- | --- |
| 1 | Everywhere: Gregorian dates, prices, sizes, bottom bar, founding badge on cards, colours as tokens | 1.5 | — |
| 2 | Finding: first visit, country chooser, browse pages, filter sheet, «خبرم کن» | 2.5–3 | `home`, `countries`, `browse`, `category`, `filters` |
| 3 | Listing page | 1.5 | `listing` |
| 4 | Posting in 4 steps, check page, published page | 3 | `post1`–`post4`, `posted` |
| 5 | Me: my listings, chat, account hub, settings | 2 | `mylistings`, `mylistings-menu`, `chat`, `account`, `notifications` |
| 6 | Events: list, event page, posting; reminders for saved events; follow a business | 3–3.5 | `events`, `event`, `post-event1`, `post-event2` |
| 7 | Pro, new business in 3 steps, business page | 2 | `pro`, `business-new`, `business-legal`, `business-page` |
| 8 | Footer and legal links | 0.5 | footer in `ui.js` |
| 9 | Admin: own bar, one item at a time, shortcuts, overview, system status | 2 | `admin-item`, `admin-overview`, `admin-system` |
| 10 | Dark mode (automatic, light, dark) | 1.5 | `*-dark`, `appearance` |
| 11 | Phone-size check of every page, Stripe test clock, docs | 1.5 | — |
| | **Total** | **20.5–22** | |

The launch plan said 15–18 days. It grew with event reminders and business follows (now in, as the owner decided in round 4), the founding badge on cards (moved from wave 0), and the final phone-size check moved here from wave 0. Cuts are under "Decisions".

**Build order:** the parts in the table's order. Each part: tests, commit, push to `wave0`, merge to `main` (staging deploy), then a short list for the owner of exactly what to look at on staging. Production gets nothing until the owner asks for `peydoo-promote` (wave 0 and wave 1 together, then delete the Cloudflare Iran rule).

## 1. Everywhere (1.5 days)

- **Dates Gregorian** with Persian month names and digits (`fa-u-ca-gregory`): `src/lib/format.ts` (today `fa-IR-u-ca-persian`), chat day dividers, admin charts. Relative dates («۲ ساعت پیش») for the first 7 days. Jalali only as a second label on Nowruz, Yalda and Chaharshanbe Suri.
- **Date fields** (`<input type=date>` shows «mm/dd/yyyy» from the browser's language): one `DateField` with day / Persian month name / year, used by the listing form (available from) and the event form. «از همین حالا» and «اول ماه بعد» where it fits.
- **Prices** «۸۷۰ €» (number first), «،» instead of «·», nothing under 12px, tap targets at least 44px, radios and checkboxes in brand colour.
- **Bottom bar** only on browsing pages (not in chat, posting, admin).
- **Founding badge on listing cards** for a business's listings while its badge runs (wave 0 put it on the business page only).
- **Colours as tokens** (`src/app/globals.css`): pages use surface and text tokens instead of `bg-white` / `text-neutral-900`, so dark mode (part 10) is a token swap.

## 2. Finding (2.5–3 days)

- **First page** (`src/app/page.tsx`): never redirects. «به نظر می‌رسد در آلمان هستید» from `CF-IPCountry`, Berlin first with counts, search at once, one line on what Peydoo is. A country that isn't open gets its waitlist card (built in wave 0).
- **Country chooser:** the header's place chip opens a sheet: open countries with counts, then «به‌زودی» with «خبرم کن».
- **Browse pages** (`src/app/[country]/_browse/*`): one search field and one chip row, results high on the phone screen; applied filters as removable chips.
- **Filter sheet:** buttons instead of selects, a typical-price hint, «نمایش ۲۳ آگهی» on the button.
- **Result line:** «خبرم کن» saves the search (saved searches exist; this is the new entry point).
- **Rooms and flats:** a rent-scam warning.

## 3. Listing page (1.5 days)

`src/app/v/[slug]/[token]/page.tsx`, `contact.tsx`.
- Phone: a fixed bar with chat, phone and save; back, share and save over the photo.
- Computer: title, price and contact beside a shorter photo.
- Rent in full (cold, costs, deposit); a safety box per category; the seller with response time; similar listings.

## 4. Posting in 4 steps (3 days)

`src/app/new/*`, `src/app/my/listings/[id]/*` (today one long form, about 9 phone screens).
- The steps work on the existing draft: 1 category (search with suggestions), 2 photos and text, 3 details and price, 4 place and check.
- Autosave after each step; optional fields marked «(اختیاری)»; choices as buttons; nothing preselected.
- Photos moved with ⋯ (no dragging).
- Check page with «تغییر» per section; Turnstile only there.
- Published page: Telegram and WhatsApp sharing first, the bump second.
- Editing a live listing keeps one page with sections (the steps are for new listings).

## 5. Me (2 days)

- **My listings** (`src/app/my/listings/page.tsx`): one button for the state (sold or rented, renew, continue), edit, and «بیشتر ⋯» with a labelled sheet; views, saves and chats per listing; tabs by status.
- **Chat** (`src/app/chat/[id]/*`): full screen with the listing bar; report and block in ⋯ instead of a flag on every message; one safety note per conversation; quick replies.
- **Account** (`src/app/account/page.tsx`): a hub with the profile card, «فعالیت من» tiles with counts, the business only when there is one, one row into Settings (account, notifications, security and devices, privacy and data, appearance), help, the legal links, sign out.

## 6. Events (3–3.5 days)

- **List:** a season strip when there is one (Yalda with both dates); 14 days with dots; type chips that apply at once (concert, party, literary and cultural, meetup, workshop, memorial and solidarity, children); free and online; the paid «ویژه» slot labelled; grouped by week with the 4:5 poster.
- **Event page:** the poster whole on a blurred copy; date, place and tickets as three rows with their actions (calendar, route, tickets) and «۱۴ روز دیگر»; details; the organiser with «دنبال کردن»; the ticket-scam warning; similar events; «خرید بلیت» fixed at the bottom on phones.
- **Posting:** poster first, type as chips, the new date field, time as hours, repeats as chips, the venue suggested from earlier events. Tours stay as today's series (see decisions).
- **New:** reminders for saved events (the day before, Telegram or email), and following a business: its new events reach followers, at most 2 messages a day. Migration 0022: `organization_follows`, a reminder mark on saved events, grants. Through the outbox, as every notice.

## 7. Pro and business (2 days)

- **Pro** (`src/app/pro`): the founding offer first (as built in wave 0), the monthly / yearly switch, three plans with «پیشنهاد ما», a short FAQ. Pay buttons still hidden from Iran.
- **New business in 3 steps** (`src/app/business/new`): name, category, city, logo; contact and hours; the country's legal details last (they can wait until "verified" or the first payment).
- **Business page** (`src/app/b/[slug]`): cover, logo, verified, founding badge, «الان باز است»; message, call, route; listings / events / about tabs; follow; the Impressum folded at the bottom.

## 8. Footer and legal (0.5 days)

Help, Legal (Impressum, AGB, Datenschutz, DSA contact), Peydoo (about, Pro, events, Telegram), Countries. Flat on phones. From chat and posting, the Impressum stays within two taps through «حساب من».

## 9. Admin (2 days)

`src/app/admin/*`.
- Its own dark bar with «پنل مدیریت» and the environment; no public header, footer or bottom bar.
- Review one item at a time: large photos with a greyscale switch, risky phrases highlighted, reports, the seller's history. **Nothing preselected** (today `decision-form.tsx` preselects «برداشتن آگهی»); options from mild to severe; keys ۱–۵, J/K, Enter for «ثبت و بعدی»; reason chips pick the terms section.
- Overview: "needs attention" first, the week with its change, Berlin against its goals; small stat cards on phones.
- System status: problems first, in red, with what to do; the queue table scrolls.

## 10. Dark mode (1.5 days)

Automatic by default (follows the device), with «خودکار / روشن / تیره» in Settings › Appearance and in the footer, stored in a cookie like `view` (no account needed, no flash on load). Dark tokens from round 3 (surfaces #0f1716 / #16211f, turquoise #5cc0c7 with dark text on buttons, saffron #f5c862); photos never dimmed. Every page passes WCAG AA contrast in both modes (checked by script). Emails stay light.

## 11. Check, Stripe test clock, docs (1.5 days)

- Phone-size browser check of every page on staging (light and dark), one browser at a time, no real users' data in screenshots.
- The Stripe test-clock run of founding Pro (left from wave 0).
- `docs/setup.md`, `docs/progress.md`; remove the `wave0-test-*` containers at the end.

## What doesn't change

URLs, data, prices, payments, the Iran rule (`src/lib/region.ts`), the phone check, the wave 0 waitlist and countries logic. Tests stay green after every part (743 today).

## Not in wave 1

Private vs business declaration and limits, "view as country" and "sign in as user" for admin, Turkey and US starter pages (wave 2); WhatsApp (postponed); AI screening (wave 4). The `iran` mockup is out of date (read-only); the Iran banner keeps today's rule.

## Decisions for the owner

1. **Event tours:** keep today's series (same place, more dates) now and add «شهر و تاریخ دیگر» (one page per city) later (recommended), or build tours now (+1 day)?
2. **"Paste your Instagram post" for events:** later with AI screening in wave 4 (recommended), or now (+1.5 days, uses an AI model per post)?
3. **"Where did you sell it?"** when marking sold: skip (recommended), or add (+0.5 day)?
4. **To shorten wave 1** if needed: dark mode can follow within 60 days of launch (−1.5 days).
