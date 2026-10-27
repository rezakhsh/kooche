# Roadmap

The build waves from the launch plan (`docs/design-options/launch-plan.html`, version 6, "build"), with what the owner moved or kept for later. Details per wave: `docs/wave0-plan.md`, `docs/wave1-plan.md`; where work stands: `docs/progress.md`.

| Wave | Content | State |
| --- | --- | --- |
| 0 | Before Berlin opens: Berlin only, city waitlists, Telegram refusal, founding Pro, withdrawal button, Iran by account | Done on staging, except WhatsApp (postponed) |
| 1 | The «صیقل‌خورده» redesign (11 parts) | Building on staging (approved Oct 27, 2026) |
| 2 | Many countries: category × city switch, modes, private vs business, admin "view as country" and "sign in as user", starter pages, prices in $ and £ | Next |
| 3 | Turkey, business stage | |
| 4 | Safety at scale: AI screening, trust levels, night and safe modes, backup server, Radar rules | |
| 5 | Turkey, private listings | |

Production gets wave 0 and wave 1 together, only when the owner asks (`peydoo-promote`); the Cloudflare Iran rule is deleted then.

## Kept for later (owner, Oct 27, 2026)

- **WhatsApp phone check** (the user sends us a code; `docs/wave0-plan.md` item 3). Postponed; the Telegram bot stays the phone check.
- **Event tours:** «افزودن شهر و تاریخ دیگر», one linked page per city. Today a series is one place with more dates. After wave 1, when tours appear (about 1 day).
- **"Paste your Instagram or Telegram post"** fills the event form (title, date, city, venue, price) for checking. Wave 4, with the AI screening (about 1.5 days; a small AI cost per post).
- **"Where did you sell it?"** (on Peydoo, elsewhere, not sold) when a listing is marked sold. When there are enough listings for the numbers to mean something (about 0.5 day, one column).
- **Notification channels, quiet hours and bundling** (mockup final/notifications): a Telegram and an email switch per kind, «ساعت آرام» (nothing from 22 to 8, sent together in the morning) and «یک‌جا بفرست» (new results once a day in one message). Wave 1 shows the two switches there are today (new message, saved searches), with Telegram when the bot is linked, else email. Needs a per-channel setting and a delivery queue that holds and bundles (about 1.5 days).
