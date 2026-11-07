# Business accounts: fixes and proposals (Nov 7, 2026)

The owner tested business accounts on staging (phone, dark mode) on Nov 7, 2026 and found four errors and asked six questions. This file records what was found, what was fixed, and the proposals that wait for the owner's yes, with the practice they are based on. Mockups (made on the real staging pages, phone 390 and computer 1440, light and dark): `/root/peydoo-media/wave2/business-fixes/mockups/`.

## Errors

| # | What the owner saw | Cause | Fix |
|---|---|---|---|
| 1 | Logo: «بارگذاری نشد…» on a phone photo | The logo picker sent the phone's original file. A photo over 15 MB (50–200 MP camera modes) or of another type is refused before upload. Reproduced with a 38 MB photo. A page opened before a deploy also fails this way (its server action no longer exists after the new build; the owner's try came minutes after the 10:31 UTC staging deploy). | The logo goes through the listing photos' shrinker first (2560 px WebP/JPEG). A page older than the build now says «پیدو همین حالا به‌روز شد…» with a reload button. |
| 2 | Error page on `/b/taskpilot/manage` | A server error at about 10:28 UTC, while this server was building a staging deploy's image (10:28:18–10:28:59). The owner's document had uploaded (10:27:38) but «درخواست تأیید» never completed. Not reproducible afterwards: every value the page and the submit compute for taskpilot works, and the same steps with a test business work. The exact error is in Sentry, which our tokens can't read. | The error page now reloads by itself when the cause is a page older than the build. The exact cause needs the Sentry issue or the Telegram «🐞 staging» alert from 11:28 Berlin time. |
| 3 | Verification document upload | For the owner, the upload worked; the submit was #2. A document photo over 10 MB was refused. | A JPEG document photo is shrunk to a JPEG within 10 MB first (PDF and PNG go as they are). |
| 4 | «پارسیان» finds nothing | Search covers listings only; business names are never searched. None of the business's listings has the word. | Proposal B below. |

## Proposals (for the owner's yes)

### A. Starting a business, easy to find

Today: «ساخت حساب کسب‌وکار» is on `/business` (reached only from links), a card on the home page, the starter and founding pages, the Pro page, and «آگهی شخصی یا کسب‌وکار؟» on the posting page. «حساب من» shows the business only when there is one.

Practice:
- Instagram: «Switch to professional account» sits in the account settings, and is suggested when a person posts like a business.
- Divar: «دیوار من» has a business row; agencies are pointed to a business account when they post property.
- Kleinanzeigen: the account page offers PRO; the posting form asks «Privat / Gewerblich».
- Facebook: «Create Page» in the profile menu.
- Google: «Own this business?» on the business's own listing.

Proposed:
1. «حساب من», for a person without a business: a card «کسب‌وکار دارید؟ صفحهٔ کسب‌وکار بسازید» under «فعالیت من», with the founding offer where it applies. With a business: the business row as today, plus «افزودن کسب‌وکار دیگر» while under the limit of 3.
2. Posting an offer in services, lessons or jobs, without a business: a box above the form, «این آگهی برای کار و درآمدتان است؟», with «ساخت صفحهٔ کسب‌وکار» and «ادامه به‌عنوان شخص». Once closed, it stays closed for that person.

### B. Businesses in search

Practice: Google Maps, Instagram and Facebook show matching pages or accounts above posts in the same search box. Kleinanzeigen and Divar search ads only, but they have no public business pages to find.

Proposed: in the header's suggestions, matching businesses come first (logo, name, neighbourhood, «صفحهٔ کسب‌وکار»), up to 3, then the usual rows. On the results page, a small «کسب‌وکارها» strip above the listings. Only active businesses of the place; test businesses follow the same rule as test listings. Names are matched with the shared Persian normalization. Meilisearch gets a small `businesses` index fed by the outbox (create, edit, suspend, delete).

### C. Cover picture

Today: `organizations.cover_key` exists, but nothing sets or shows it; the page shows a coloured band.

Proposed: «عکس کاور» above the logo on the edit page (a landscape photo, at least 1200 px wide, optional), handled like the logo. The worker makes a 1600×500 WebP, and the page shows it in place of the band. Practice: Facebook Pages, Google Business, LinkedIn and Instagram all use a wide header image with a round or square logo.

### D. Page address (slug)

Today: the address is chosen once, at creation, and can't be changed (`updateBusiness` keeps it; links keep working). This is what the owner wants.

Recommendation: keep it. If a business renames itself later, staff can change the address once, with a permanent 301 from the old one. Search engines move the ranking to a 301 target within weeks, so the effect is small. Facebook and Instagram allow changes but warn that old links break, which we avoid with the redirect.

## Answers

### Follow («دنبال کردن این کسب‌وکار»)

A follower gets the business's **new events only**, by Telegram or email:
- following the «یادآوری‌ها» switch;
- at most 2 a day;
- never in quiet hours (22–8).

Nothing is sent for new listings or changes, and there is no in-app notice. A person can follow up to 500 businesses. Members of the business get nothing from their own business.

### Private vs business

| | Private | Business, free | Pro (€24 a month) | Pro Plus (€59 a month) |
|---|---|---|---|---|
| Live listings | 100 new in 30 days (cars 2, homes 2 live) | 3 | 25 | 100 |
| Own page `/b/…` | seller page | yes | yes | yes |
| Phone, website, Instagram, Telegram, hours | — | yes | yes | yes |
| Events, job offers | private events | yes | yes | yes |
| Licensed services (legal, health, tax…) | — | after verification | after verification | after verification |
| Bumps a month | — | 0 | 3 | 15 |
| Featured places | — | 0 | 0 | 2 |
| Staff seats | — | 0 | 1 | 5 |
| Views and chats per listing | — | yes | yes | yes |
| «تأییدشده» badge | — | after a document | after a document | after a document |
| Founding businesses | — | — | 6 months free, «بنیان‌گذار» badge for a year | — |

A business needs a verified non-Iranian phone number. Its listings go live only after the legal details (Impressum) are complete. A person may own up to 3 businesses.

### The owner's two businesses

Both were made by the owner's own account, which is not a test account:
- `taskpilot`, made Oct 23. It holds the founding offer and a 6-month Pro trial (since Oct 26).
- `parsian-translations`, made Oct 27, on the free plan.

Both look like the owner's samples, and having two is allowed (the limit is 3). Because the account isn't marked as a test account, both show to the public like real businesses. They need marking or removing before go-live, like the other samples.
