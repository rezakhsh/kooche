# Two checks before production (plan, Oct 31, 2026)

The owner tests staging by hand; production follows only when staging has no known bugs. Two separate checks, each started on its own (after a compact), each ending with a page for the owner and fixes only after the owner approves them. Nothing in the app changes before that approval.

## Check A: the design of every page

**Why:** the owner saw design problems on staging. Every page should look like its approved mockup (`docs/design-options/mockups/final/`, about 60) or, where there is none, like the approved style (direction B: turquoise, saffron, Vazirmatn, rounded cards).

**What gets photographed:** all 86 pages (`find src/app -name page.tsx`), each on a phone (390 px) and a computer (1280 px), in light and dark: about 350 screenshots, plus the states that matter:
- who looks: a visitor, a signed-in person, a business owner, an admin (temporary accounts, removed afterwards; sample listings and events stay);
- empty and full (no listings yet / many), a form with errors, 404 and the error page;
- long Persian titles and big numbers, a visitor from Iran (view-as), a country in Starter mode and a city behind its gate.

**Checked by machine on every screenshot:** horizontal scroll; text cut off or overlapping (element boxes); broken images; console errors; contrast and accessibility (axe-core); tap targets under 40 px on phones; English or left-to-right text leaking into Persian; dark mode with unreadable text; layout jumping while loading.

**Checked by eye:** each page side by side with its mockup (phone and computer), the rest against the approved style.

**In four groups, one at a time:**
1. Public pages: home, country, city, category, listing, events and event, business pages, Pro, help, legal pages, waitlist, login.
2. The person's own pages: account (13), my listings (10), posting, chat, alerts, notices.
3. Business: dashboard, team, billing, verification, business page editing.
4. Admin (20 pages).

**For each group:** a review page (artifact) with the screenshots, every problem found (with its picture and where in the code), and separately **ideas to make it better or easier to use**, each with a before/after mockup. The owner approves which problems to fix and which ideas to build; then the fixes, the tests, staging, and new screenshots side by side with the old ones.

**Rules:** `free -m` before each browser run, one browser at a time, no browser while staging builds; screenshots kept in `/root/peydoo-media/after-wave2/design-check/<group>/`; no real users' data in screenshots.

## Check B: bugs and errors in the code

**Why:** the code check of Oct 30 found no critical error, but 8 serious and 13 medium ones (all fixed). They came from six patterns that can appear anywhere, some areas got a lighter look, and the visitor counter and the software check were built afterwards.

**The six patterns, searched in the whole code:**
1. Rights based on an old status (someone removed, banned or whose session ended keeps a power): event organizers, chat after a block or ban, business invites, saved searches.
2. A form value decides the permission (a missing or changed field gives more rights): every server action and admin form.
3. A retry sends twice: every job that sends email or Telegram, every payment step.
4. A promise without a job behind it: every promise in the privacy policy, the terms and the help pages compared with the code.
5. Clock and calendar: time zones, the clock-change nights, reminders, event times, quiet hours.
6. Trusting another service's data: Stripe, Telegram, Cloudflare, R2, imgproxy, n8n, the npm and GitHub sources.

**Plus:** the areas with a lighter look last time (chat, events, posting and photos, search and saved searches, the Telegram bot, business pages) and the new code (visitor counter, software check); every input checked with Zod on the server; what a person sees when something fails (error pages and messages, never a blank page or a stack trace); the real errors already logged on staging (Sentry, web and worker logs since the deploys).

**How (like the first check):**
1. Machines first: type check, `npm audit`, a scan for server actions without a permission check, jobs that send without a "once" claim, inputs without Zod.
2. About 6 reviewers in parallel, read-only, each with one or two patterns or areas.
3. Each serious finding checked again in the code; the biggest proven with a test that fails today.
4. A findings page for the owner: fix first, fix soon, small, each in plain words with what would happen.
5. Fixes in packages, each package's plan approved by the owner first; tests, staging, checks.

## Afterwards

When both checks are fixed on staging and the owner's own test finds nothing more: the production release plan (wave 2, the fix packages, visitor numbers, software updates; migrations 0030–0039; the server updates; `peydoo-server-versions` on production), for the owner's approval.
