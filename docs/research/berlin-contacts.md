# Berlin contacts: who to talk to before Peydoo opens in Berlin

Research of Nov 6, 2026, for the owner's personal outreach (decided Oct 30, 2026). Research only: nobody was contacted.

> **For personal contact only: a visit, a phone call, or a personal message.**
> - No advertising emails or mass messages. Advertising by email needs prior consent, towards businesses too (UWG § 7 (2) no. 2). An email is fine only as a follow-up the person asked for.
> - A phone call to a business needs at least presumed consent (UWG § 7 (2) no. 1). Keep it short, personal and about their business, and stop if they say no.
> - The list holds only public business and organisation data, under GDPR art. 6 (1) (f) (legitimate interest). Every row names its source. Delete a row when someone asks.

## The files

- `/root/peydoo-media/berlin-contacts/berlin-contacts.xlsx`: a "Read me" sheet, then one sheet per group: Businesses, Services, Events, Community, Media & partners. Each sheet has a frozen header and filters.
- `berlin-contacts.csv`: all rows with a "Group" column. There is also one CSV per group (`berlin-contacts-<group>.csv`), saved as UTF-8 with BOM so Excel shows the Persian correctly.
- The spreadsheet is kept out of git. It is a working list the owner will edit.

Columns: name, category, district, business address, website, public phone, public email, Instagram, Telegram, languages, source, second source, verified ("2 sources" or "single source"), date checked, note, how to approach, possible partner.

## Counts

**321 contacts** in total. 199 are checked against two independent sources and 122 rest on one.

| Group | Rows | What is in it |
|---|---|---|
| Businesses | 99 | 46 restaurants, 16 hairdressers and beauty, 9 carpet shops and other retail, 8 groceries, 6 travel agencies, 5 cafés, 3 car workshops, 2 bakeries and sweets, 2 estate agents, 1 caterer, 1 mover |
| Services | 109 | 52 doctors (GPs, gynaecologists, eye, orthopaedics, urology, dermatology, ENT, paediatrics, psychotherapy), 20 dentists, 13 lawyers, 5 pharmacies, 5 translators and interpreters, 4 physiotherapists, 4 language and course providers, 3 music and dance schools, 2 driving schools, 1 wage-tax help association |
| Events | 33 | 20 organisers and promoters (club nights, concerts, festivals, Nowruz, Chaharshanbe Suri, literature, theatre, comedy), 13 venues that host Persian events |
| Community | 34 | Iranian and Afghan associations, counselling with Farsi or Dari, Persian Christian and Bahá'í communities, a parents' network, the FU Iranian studies institute |
| Media & partners | 46 | 26 Telegram channels and groups, 8 directories and classifieds sites, 4 Instagram pages, 2 radio programmes, a magazine, 2 news sites, local TV, a podcast and a YouTube channel |

- **Potsdam:** 8 rows. Businesses cluster in Charlottenburg (45 rows), then Neukölln, Wilmersdorf, Kreuzberg and Schöneberg.
- **Possible partners:** 29 rows have "Possible partner = yes".
- **Do not contact:** 8 rows are warnings only, not contacts (see Cautions).

## How it was done

Nine research agents searched the web in parallel, by category, in German, English and Persian. A second round filled the gaps of the first. They used web search and page fetches only, with no browser. Every row comes from a page that was actually seen, and its source is in the row. Where possible a second, independent source confirmed it (the business's own website, a review site, a press article or a second directory). Places shown as closed were dropped.

**Main sources:**
- Persian directories: kojast.de (235 Berlin entries, the richest), nazdikia.com (about 125 Berlin entries), parsian.eu.
- The businesses' own websites, Wolt, Zabihah, tip Berlin and Restaurant Guru.
- For services: Doctolib and the BDÜ list of sworn interpreters (Fachliste Recht 2025/26).
- For events: the Humboldt Forum and HKW programmes, ticket pages, and club and venue pages.
- For channels: Telegram's public channel pages (subscriber counts of Nov 6, 2026).
- For community groups: Berlin district integration pages, Lobbyregister, and the Berlin Senate's answers on Iranian state-linked groups.

**Blocked:** Tripadvisor, Yelp, Lieferando, Instagram (login wall), tgstat and telemetr (no Telegram growth or history), persianshome.com, rausgegangen and ra.co. So Instagram follower counts are mostly missing, and some counts come from search snippets.

## Top 20 to contact first

There are two aims: fill Berlin's 30 founding Pro places with active, visible businesses, and win the organisers and channels that bring people.

**Partners with reach (people come through them):**

1. **The "Hilfen" Telegram network, admin @BerlinAdmin.** About 35,000 Berlin subscribers behind one contact:
   - @iranian_berlin, a Q&A group with 16,464 members;
   - @Berlin_khane (housing, 8,476), @berlin_kar (jobs, 4,493), @berlin_online (classifieds, 3,880) and @berlin_khabar (news, 1,741).

   This is the partnership `docs/strategy.md` plans to start with: a free city feed and events digest with a referral link. Approach: a Telegram message.
2. **@Berliner118 and berlinerhilfe.com** (7,640 subscribers). The second Berlin classifieds network, and also a small competitor (a Divar-style website with little traffic). Approach: a Telegram message.
3. **Pangea-Haus, Trautenaustraße 5, Wilmersdorf.** One visit reaches several contacts:
   - the Iranische Gemeinde in Deutschland (IGD, which runs Chaharshanbe Suri there) and its integration guides;
   - VLP, the Persian teachers' association, and IRTV, a Persian programme on Berlin's local TV;
   - MIQ-Bildung (see 15).
4. **Tehran Contemporary Sounds** (@tehran.contemporary.sounds). Their 7th festival runs in Berlin now, Nov 10–15, 2026, with film nights at Moviemento on Nov 10. Meeting them there is the timely first contact.
5. **Persian Love Berlin** at ACUD Club. The most regular Persian club night. It ran a Yalda night on Dec 20, 2025, so a Yalda 2026 listing on Peydoo is a natural first event. Approach: an Instagram message through ACUD.
6. **Laschian**, a Persian artist and party collective. Big rooftop parties at Klunkerkranich: Nowruz, Halloween, and in May and July 2026. Good for Nowruz 2027.
7. **Mahname Mehr Berlin** (@mahname_mehr_berlin). A Persian monthly magazine that also presents concerts. Good for an advertorial and for event listings before Yalda.
8. **Volek Events** (@volek.events). A touring promoter (Shahin Najafi in Berlin, Feb 2025). The ref code `volek-events` was already used in a staging test; make the real one on production.

**Likely founding Pro businesses (active, visible, and they already sell to the community):**

9. **Noosh**, Kantstraße 143. A banquet hall that runs Nowruz and Iftar dinners: a natural Yalda dinner listing.
10. **Shayan**, Goltzstraße 23, Schöneberg. Running since 1997, with catering. **On holiday until Nov 12; visit from Nov 13.**
11. **Kourosh**, Strausberger Platz 1. Moved from Wilmersdorf; has a VIP area and does weddings and catering.
12. **Dr & Dr**, Reichenberger Str. 116, Kreuzberg. A Persian food lab (catering, cooking courses, private dinners), named "Berlin Host 2024". Good for events too.
13. **The Iranian supermarkets on and around Kantstraße**: IRAN SHOP (Kantstraße 124B), Tehran Supermarkt (Windscheidstraße 4), Khavarmiane (Niebuhrstraße 56) and Zafarani (Wilmersdorfer Str. 44). One walk covers all four. They are the best places for a QR poster, and each can be a founding business. Salon Hamid Nosrati (Kantstraße 69) is on the way.
14. **Persepolis**, Kurfürstenstraße 127–128. A long-running restaurant with its own Persian supermarket.
15. **MIQ-Bildung**, in Pangea-Haus. German courses and free career counselling in Persian. They already advertise in Persian almost every day on the Telegram channels, so they pay for this audience.
16. **Adineh Tour**, Steglitz. A travel agency for flights to Tehran, with a website in Farsi. Travel ads fit the listings.
17. **Zahnmedizin am Ku'damm**, Kurfürstendamm 183. Persian confirmed on its own website, 5.0 stars from 190 Google reviews, active on Instagram. Self-pay dentistry, so it can afford Pro.
18. **Anwaltskanzlei Mashaie**, Gneisenaustraße 51, Kreuzberg. A tenancy and civil law firm that has advised Mieterschutzbund Berlin since 2013. It fits Peydoo's housing wedge (for example, a "your rights as a WG tenant" page).
19. **Global Music Academy**, Wildenbruchstr. 80, Neukölln. Iranian teachers of santur, setar, tombak, daf and kamancheh. Also a source of performers for Yalda and Nowruz events.
20. **Mahsa Hair & Beauty**, Potsdam-Bornstedt. Serves in German, Persian and Dari, with online booking. The clearest Persian business in Potsdam, which is part of the Berlin area.

**Next in line:** Sarayam (upscale, Luisenplatz); Shiraz Street Food (Europaplatz, 4.9 stars from 346 reviews); Meet Me Halfway and PATOGH (cafés with a younger crowd); Butterfly Beauty (already advertises in Persian); Teppichdienst Abasi (carpets); Kanzlei Lingnau & Lingnau (immigration law, Persian on its site); Zahnzentrum Potsdam (5.0 stars from 121 reviews); YAAR e.V. and VAFO (the largest Afghan Dari-speaking groups); Bahar Choir (sells out Berlin concerts).

**Visits that cover many contacts at once:**
- Kantstraße and Windscheidstraße in Charlottenburg (supermarkets, Noosh, salons).
- Pangea-Haus.
- Am Wasserwerk in Lichtenberg (three Afghan restaurants side by side: Herat Darbar, Sham-e Herat, Kabul Imbiss).

## A ref link and QR code for each contact

Built in admin › «آمار بازدید», under the owner's links. Make the links on **production**, not staging.

1. Make one link per contact before the visit or message.
   - **Code:** small letters a–z, digits and "-", 3–32 characters, starting and ending with a letter or digit. Examples: `noosh`, `pangea-igd`, `tg-berlinadmin`, `kantstr-iranshop`.
   - **"Whom it is for":** the contact's name as in the spreadsheet (up to 80 characters).
2. Put the code in a new spreadsheet column so the two match.
3. **Shops and restaurants:** print the link's QR code from the same page (an A5 poster or a table card), with the owner's OK to put it up.
4. **Channels and organisers:** send the plain link in the personal message. A partner channel gets its own code, so its traffic is counted apart from the owner's own posts.
5. The page shows, per code, the visitors and the sign-ups, and what the new accounts did next (verified a phone, posted, messaged). Look at 7 and 30 days.
6. Archive a code once the contact is done; its numbers stay.

The code survives the home page's redirects (a returning visitor is sent on to their country, and Iran to the first open city), so a link to the home page is enough. No cookie is set, so no consent banner is needed.

## Cautions

- **Do not contact** (kept as warnings):
  - Iran-Haus / the embassy's cultural section, and the embassy's Instagram;
  - Islamisches Zentrum Berlin (banned in 2024), the Imam-Riza-Moschee and Al-Mustafa Institut;
  - Interkulturelles Zentrum für Dialog und Bildung (named in parliamentary questions on regime activity);
  - @berlin_pay, informal euro–toman exchange. It is a sanctions risk and clashes with the Stripe attestation; it is in the same network as @berlin_online, so keep it out of any partnership.
- **Iran access rule:** @helfenir (29,089), @deutschepedia (11.4K), @Germany_Iran (12.8K) and @visa.home.germany have large audiences inside Iran. Iran visitors can only read and message. Good for awareness, but not for Berlin sign-ups.
- **@berlin_online sometimes carries cigarette sales.** Look at it before co-branding.
- **Political groups:**
  - The Woman* Life Freedom Collective: event listings only, no co-branding.
  - IGD and the Verein Iranischer Flüchtlinge do human-rights advocacy (not parties).
- **Dreieinigkeits-Gemeinde Steglitz** (about 1,400 members, mostly converts from Iran and Afghanistan): many members are asylum cases. Talk to the pastor only, and don't promote at services.
- **Language checks:** "Persian per kojast.de" in a note means only that directory says Persian is spoken. Its profiles look partly auto-filled. Ask on the first call. Persian is confirmed on the practice's own website for about 20 doctors, dentists, pharmacies and lawyers; the notes say which.
- **Open status unclear:** 47 notes say so (for example Safran on Oranienstraße, Pezhman Friseur, Persien Erleben). Check before going.
- **Mobile numbers:** a few rows carry a mobile number. Each is the number the business publishes. Staff mobiles and private addresses were left out.

## What was surprising

- **The Telegram scene is two networks, not one:**
  - The @berlin_online "family" is a single admin who runs about 35,000 Berlin subscribers, plus Köln, Munich, Frankfurt and Hamburg channels.
  - The second network is @Berliner118 / berlinerhilfe.com.
  - @Iranian_DE ("اطلس ایرانیان آلمان") has shrunk to a 34-member group.
- **kojast.de is a live, current Persian business directory**, updated Oct 2026, with 235 Berlin entries. It is both a competitor to Peydoo's business pages and a ready list of who to invite. berlinerhilfe.com is a small Divar-style rival.
- **Gaps:**
  - No Persian-speaking Steuerberater was found in Berlin; the only find is a wage-tax help association.
  - No Iranian student association was found at any Berlin university.
  - No Persian stand-up organiser and no Persian movers or estate agents with a real business presence were found. Those trades seem to live only in Telegram ads.
- **Big Iranian pop concerts** (Ebi, Moein, Googoosh, Shadmehr) play the Uber Eats Music Hall, but the venue never names the promoter. Most promoters are based outside Berlin (Pars Entertainment, Volek, Disco Tehran).
- **The meet-up group @dorehamiberlin** links to khodamehri.com. It may be the owner's own group.

## Not done yet (worth a second pass)

- Instagram-only businesses (nails, lashes, make-up, photographers, wedding decor, DJs) need a logged-in look at Instagram, or the Telegram ad channels.
- More kojast.de doctors and dentists: about 35 dentists and 15 GPs were not taken, and the rows taken were limited to the best documented.
- Student groups: ask the FU Institut für Iranistik, or look at the TU and HU noticeboards.
- Afghan Dari concerts and Persian art galleries.
