# Research 12: which cities open first, and when a country opens

26 Oct 2026. Web research and official statistics only. No code was changed.

This builds on `research5-countries.md` (country totals), `research6-expansion.md` (gates, modes, competitors) and `research9-turkey.md` §1.1–1.5 (Turkey). Figures already sourced there are not sourced again.

**Markers:**
- **[1 source]**: a fact I found in only one source.
- **[estimate]**: my own number.
- Most census figures below were pulled directly from the statistics offices' own tables and APIs today: StatCan, US Census summary files, Nomis, ABS, CBS, SCB, SSB, StatBank DK, Statistik Austria and the German state offices. Each official count is one source, but it is the primary one.

---

## 1. The owner's rule, and how I turned it into numbers

**The rule:**
1. Berlin is open from the start.
2. Every other big city has a waitlist from day one.
3. A city opens when it reaches a business target. The target is not strict. The aim is that the first two screens of the city page on a phone look full.
4. When a few big cities of a country are open, the whole country opens.

### 1.1 Business target (to open a city)

The target scales with the city's Iranian population:

| City size (Iranian community, metro) | Business target | Examples |
|---|---|---|
| **Big** (about 20k or more) | **25–30** | Hamburg, Vienna, London, Toronto, Vancouver, LA, Bay Area, Sydney, Melbourne, Stockholm, Istanbul |
| **Medium** (about 7–20k) | **15–20** | Cologne–Bonn, Düsseldorf, Frankfurt, Göteborg, Manchester, Montreal, DC, NY, Paris, Amsterdam |
| **Small** (about 2–7k) | **10** | Munich, Hannover, Stuttgart, Malmö, Leeds, Glasgow, Calgary, Brisbane, Rotterdam, Milan |

**Every target is far below the plausible number of Iranian-owned consumer businesses in that city** (see the "plausible" column in each country table). The lowest ratio is in the Italian student cities (§10).

**Use the business target as the number of founding places.** The first N verified businesses in a city get the founding offer: the existing `peydoo-launch-6m` coupon and the «بنیان‌گذار» badge (`docs/setup.md`, round 5). The waitlist then shows one honest counter: «۱۸ از ۳۰ کسب‌وکار».

### 1.2 Listing target ("the first two screens look full")

- A phone list shows about 6 cards per screen, so two screens are **12 cards**.
- **Count only live listings posted in the last 30 days.** The owner wants *recent* listings on top. An old listing still fills a slot, but makes the page look stale.
- Business posts count. Founding businesses with Pro can post up to 25 each (`docs/setup.md`).
- **The 12 cards should cover at least 3 categories.** Twelve listings from one restaurant look like an ad page, not a marketplace [estimate].

| City size | Listing target | Why more than 12 |
|---|---|---|
| Small | **12–15** | Two full screens on the plain city page |
| Medium | **20** | The city page plus one popular category (rooms or services) shows at least one screen |
| Big | **30** | A visitor in a big city usually filters by category straight away. With 30 listings, the 2–3 main categories each still fill a screen |

### 1.3 Non-strict: when a city may open early

A city may open as soon as **either** of these is true:
- the **listing target is met** and the businesses are at **at least about 75%** of their target; **or**
- the **business target is met** and there are **at least 12 recent listings**.

The owner can override either way. Example: Hamburg at 23 of 30 businesses with 34 live listings opens.

**Count the metro, not the city limits.** The Iranian communities often live in suburbs:
- **Toronto:** York Region (Richmond Hill) has more Iran-born people than the City of Toronto.
- **London:** Barnet alone holds 10% of the Iran-born in England and Wales.
- **Vancouver:** about a third of the CMA's Iran-born live on the North Shore.
- **Stockholm:** Solna, Järfälla and Sollentuna each hold 2–3% of Sweden's Iran-born.

So a business or listing should count toward a city's waitlist if it lies within about **30–40 km** of the centre [estimate]. Cities already have coordinates in the seed (`seed/locations/*.ts`). This is a suggestion for later; no code was changed.

### 1.4 When the whole country opens

**Proposed rule:** a country opens when its open cities cover **50–60%** of its Iranian population. **Exception:** in a spread-out country, it opens after its **top 4–5 metros**, even if they cover less.

The 50–60% rule works in 8 of the 11 countries. It doesn't work in three:

| Country | How many cities reach 50%? | Proposal |
|---|---|---|
| Austria | 1 (Vienna 59%) | Vienna opens the country |
| Canada | 2 (Toronto + Vancouver 70%) | Toronto + Vancouver |
| Australia | 2 (Sydney + Melbourne 66%) | Sydney + Melbourne |
| Sweden | 2 (Stockholm + Göteborg 58%) | Stockholm + Göteborg |
| UK | 3 (London + Manchester + Birmingham 57%) | Those three |
| US | 3 (LA + Bay Area + DC 50%) | Those three, NY optional |
| France | 1 (Paris ≈55–65% [estimate]) | Paris |
| Turkey | 1–2 (Istanbul ≈50–60% [estimate]) | Istanbul + Ankara |
| **Germany** | **About 11 metros.** The top 5 hold only about a third | **Exception:** Berlin, Hamburg, Cologne–Bonn, Düsseldorf, Frankfurt (≈33%) |
| **Netherlands** | **About 6.** No city holds more than 14% | **Exception:** Amsterdam, Rotterdam, The Hague, Utrecht (≈45% by metro) |
| **Italy** | **About 6.** A student population spread across university cities | **Exception:** Milan, Turin, Rome (≈44% by province) |

**Why the exception is sensible:**
- In Germany the other two-thirds live in hundreds of towns, and none of them will ever reach 10 businesses alone.
- Opening the country is the only way those people get a local page.
- Country-wide categories carry them in the meantime: cars, online services, jobs and events.

---

## 2. Germany

**Measure:** Iranian **citizens**, the only measure every city publishes (31 Dec 2024 unless noted). The national total is 162,000 ([IW Köln 2026](https://www.iwkoeln.de/fileadmin/user_upload/Studien/Kurzberichte/PDF/2026/IW-Kurzbericht_2026-Iranische-Zuwanderer-in-D.pdf)).

The real communities are **1.8–2.9 times larger**, because many Iranians hold German passports. Where a city publishes "migration background" (MB), it is shown too.

| City | Iranian population (source, year) | % of country (citizens) | Plausible Iranian consumer businesses [estimate] | Business target | Listing target | Opens the country? |
|---|---|---|---|---|---|---|
| **Berlin** | 13,554 citizens; **24,778 MB** ([Statistik Berlin-Brandenburg](https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BBHeft_derivate_00033863/SB_A01-05-00_2024h01_BE.pdf), 30 Jun 2024) | 8.4% | 600–1,000 | **Open at launch.** Day-one seed: 30 | 30 | **Yes (1 of 5)** |
| **Hamburg** | 12,248 citizens ([Statistikamt Nord](https://www.statistik-nord.de/fileadmin/Dokumente/A_I_4_j_25_HH.pdf), 2024; 12,271 in 2025); **31,506 MB**, the largest in Germany ([Statistikamt Nord A I 10](https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/HHHeft_derivate_00008406/A_I_10_j_2024_HH.pdf), 2024) | 7.6% | 800–1,250 | **30** | **30** | **Yes (2 of 5)** |
| **Cologne–Bonn** (one launch) | Cologne 6,085 + Bonn 1,115 citizens ([IT.NRW](https://www.it.nrw/system/files/media/document/file/105_25.pdf), 2024); region with Rhein-Erft, Rhein-Sieg, Leverkusen ≈11,245. Cologne MB 15,791 ([Köln Jahrbuch](https://www.stadt-koeln.de/mediaasset/content/pdf15/statistik-jahrbuch/statistisches_jahrbuch_koeln_2023_kapitel_1.pdf), 2023) | 4.4% (region 6.9%) | 460–790 | **25** | **30** | **Yes (3 of 5)** |
| **Düsseldorf** | 5,110 citizens; with Neuss and Mettmann 8,080 (IT.NRW, 2024); MB 10–14k [estimate] | 3.2% (metro 5.0%) | 250–550 | **20** | **20** | **Yes (4 of 5)** |
| **Frankfurt** (Rhine-Main) | 4,355 citizens; with Offenbach, Wiesbaden, Darmstadt 7,475 ([Hessen A I 7](https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/HEHeft_derivate_00014651/AI7_%20j24_a.pdf), 2024); MB 9–12k [estimate] | 2.7% (metro ≥4.6%) | 225–480 | **20** | **20** | **Yes (5 of 5)** |
| Hannover | 3,655 citizens (Lower Saxony office via [Braunschweig yearbook](https://www.braunschweig.de/politik_verwaltung/statistik/jahrbuch/jahrbuch/02_23_export.pdf), 2024) [1 source] | 2.3% | 175–400 | 15 | 15 | No, opens with the country |
| Munich | 3,510 citizens ([LH München](https://stadt.muenchen.de/dam/jcr:89a2dcdb-76bb-427d-8930-61a956092c08/jt260115.pdf), 31 Dec 2025) | 2.2% | 175–400 | 15 | 15 | No |
| Essen (Ruhr) | 3,005 citizens; the Ruhr (≈15 districts) ≈11,300 (IT.NRW, 2024) | 1.9% (Ruhr 7.0%) | 150–320 | 10 | 15 | No |
| Stuttgart | **Not found.** 1,500–2,500 citizens [estimate]. Baden-Württemberg 13,150 ([BW report](https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00032120/3124_23001.pdf), 2023) | ≈1–1.5% | 90–240 | 10 | 12 | No |
| Nuremberg | 1,629 citizens; MB 3,095 ([Nürnberg](https://www.nuernberg.de/imperia/md/integration/dokumente/statistischer_jahresbericht_2024.pdf), 2024) | 1.0% | 40–90 | 10 | 12 | No |
| Aachen (Städteregion) | 1,910 citizens (IT.NRW, 2024) | 1.2% | 40–90 | 10 | 12 | No |

**Country opens after:** Berlin, Hamburg, Cologne–Bonn, Düsseldorf and Frankfurt. That covers ≈33% of Iranian citizens by metro, or 26% by city limits.
- Cologne–Bonn and Düsseldorf are 40 km apart. Launch them as one "Rhineland" wave, which `docs/strategy.md` already plans.
- **A strict 50% would need about 11 metros**: the five above plus the Ruhr, Munich, Hannover, Stuttgart, Nuremberg and Aachen. That would delay "all of Germany" by a year or more for little gain [estimate].
- Businesses needed before Germany opens: 30 + 25 + 20 + 20 = **95**, plus Berlin's seed.

**Business evidence (thin):**
- **Hamburg carpet trade:** about 200 Iranian carpet firms in the Speicherstadt a few years before 2018, and 57 in Aug 2018 ([Rudaw](https://www.rudaw.net/english/business/17082018)) [1 source].
- **Doctors:** 1,994 doctors with Iranian citizenship in Germany, but only 302 in their own practice ([Bundesärztekammer](https://www.bundesaerztekammer.de/fileadmin/user_upload/BAEK/Ueber_uns/Statistik/AErztestatistik_2024.pdf), 2024). Naturalised Iranian doctors are not counted.
- **No Persian directory with city counts exists.** Gelbe Seiten finds only a handful of "persisches Restaurant" entries per city. That means mainstream directories undercount these businesses; it does not measure them.
- The "plausible" column uses **25–40 listable Iranian-owned businesses per 1,000 community members** (MB) [estimate]. As a check: about 256k Iran-born × 60% working × 10–12% self-employed gives roughly 15–18k self-employed nationwide.

---

## 3. Austria

**Measure:** born in Iran, 1 Jan 2026. The national total is **33,783**. City figures for Graz, Linz and Salzburg are citizens only ([Statistik Austria](https://www.statistik.at/statistiken/bevoelkerung-und-soziales/bevoelkerung/bevoelkerungsstand/bevoelkerung-nach-staatsangehoerigkeit/-geburtsland)).

| City | Iranian population (source, year) | % of country | Plausible businesses [estimate] | Business target | Listing target | Opens the country? |
|---|---|---|---|---|---|---|
| **Vienna** | **19,957** Iran-born; 11,312 citizens (Statistik Austria, 2026) | **59.1%** | 700–1,150 | **25** | **30** | **Yes, alone** |
| Graz | 1,183 citizens ([Graz](https://www.graz.at/cms/dokumente/10022937_7771507/c46dca16/Bev%C3%B6lkerung%20nach%20Staatsangeh%C3%B6rigkeit%20und%20Wohnsitz_01.01.2026.pdf), 2026); ≈2,100 Iran-born [estimate] | 6.2% of citizens | 30–60 | — | — | No, opens with the country |
| Linz | 1,112 citizens ([Linz](https://www.linz.at/zahlen/040_bevoelkerung/070_Auslaender/auslg.pdf), 2026); ≈2,000 Iran-born [estimate] | 5.9% of citizens | 30–60 | — | — | No |
| Salzburg | 453 citizens ([Stadt Salzburg](https://www.stadt-salzburg.at/fileadmin/landingpages/statistik/einwohner/2023_bevoelkerung_nach_staatsangehoerigkeit.pdf), 2023) [1 source] | 2.4% of citizens | 10–25 | — | — | No |
| Innsbruck | Not found. Tyrol has 1,445 Iran-born | — | — | — | — | No |

**Country opens after:** Vienna. It covers 59% of the country. No other Austrian city needs its own waitlist: Graz and Linz are each about a tenth of Vienna.

---

## 4. Canada

**Measure:** born in Iran, StatCan 2021 Census by CMA. The total is **213,160**, including students and workers on temporary permits ([98-10-0302](https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=9810030201)).

**Correction to earlier rounds:** "≈281k by ethnic origin" adds up StatCan's separate "Iranian" (200,465) and "Persian" (80,340) answers, so people who ticked both are counted twice ([98-10-0356](https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=9810035601)). Toronto's "89–125k" comes from the same split.

| City (CMA) | Iranian population (source, year) | % of country | Plausible businesses [estimate] | Business target | Listing target | Opens the country? |
|---|---|---|---|---|---|---|
| **Toronto** (incl. Richmond Hill, York Region) | **97,340** Iran-born; 113,970 speak Persian (StatCan, 2021). ≈135–140k Persian speakers in 2026 [estimate] | **45.7%** | 2,000–4,700 | **30** | **30** | **Yes (1 of 2)** |
| **Vancouver** (incl. North Shore, Coquitlam) | **50,660** Iran-born (StatCan, 2021) | **23.8%** | 1,000–2,400 | **30** | **30** | **Yes (2 of 2)** |
| Montreal | 23,905 Iran-born (StatCan, 2021) | 11.2% | 500–1,200 | 20 | 20 | No. **Waitlist until the French texts exist** (Quebec's Bill 96, research 6) |
| Ottawa–Gatineau | 7,755 (StatCan, 2021) | 3.6% | 150–385 | 15 | 15 | No |
| Calgary | 6,480 (StatCan, 2021) | 3.0% | 150–385 | 15 | 15 | No |
| Edmonton | 3,560 (StatCan, 2021) | 1.7% | 50–130 | 10 | 12 | No |
| Kitchener–Waterloo / Hamilton | 2,795 / 2,630 (StatCan, 2021) | 1.3% / 1.2% | 40–100 each | 10 | 12 | No |

**Country opens after:** Toronto + Vancouver, which cover 69.5%. Toronto alone is 45.7%. **Quebec stays on its waitlist** until the French versions are done, even after Canada opens.

**Newcomers keep arriving:** new permanent residents from Iran numbered 7,250 in Jan–Aug 2026, and the pace is rising (1,745 in August) ([IRCC open data](https://www.ircc.canada.ca/opendata-donneesouvertes/data/ODP-PR-Citz.csv)).

**Business evidence:**
- "Persian restaurant" places in Canada: 202 in total, of which Ontario 101 and BC 53 ([Rentech](https://rentechdigital.com/smartscraper/business-report-details/list-of-persian-restaurants-in-canada), Apr 2026) [1 source].
- Toronto: "200+ Iranian restaurants and stores" [1 source, a consultancy blog].
- The "plausible" column is 1.5–3.5% of the community [estimate].

---

## 5. United States

**Measure:** born in Iran, ACS 2020–24 5-year estimates by metro. The total is **409,645**. Iranian ancestry is 518,774 ([Census summary files](https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/), 2024).

Pew's 750k ([Pew 2026](https://www.pewresearch.org/short-reads/2026/03/05/7-facts-about-iranian-americans/)) is about 1.4 times ACS ancestry. Shares below use ACS Iran-born so they are consistent.

| City (metro) | Iranian population (source, year) | % of country | Plausible businesses [estimate] | Business target | Listing target | Opens the country? |
|---|---|---|---|---|---|---|
| **Los Angeles** (incl. Orange County: Irvine, Glendale) | **139,936** Iran-born; 126,167 ancestry (ACS 2020–24); Pew 230k | **34.2%** | 3,500–8,000 | **30** | **30** | **Yes (1 of 3)** |
| **Bay Area** (SF–Oakland + San Jose, one launch) | 42,133 Iran-born (CSA; SF 19,106 + SJ 17,494 MSAs); ancestry 52,971 (ACS 2020–24) | **10.3%** | 1,050–2,450 | **25** | **30** | **Yes (2 of 3)** |
| **Washington DC** | 23,340 Iran-born; 33,020 ancestry (ACS 2020–24) | **5.7%** | 700–1,600 | **20** | **20** | **Yes (3 of 3)** |
| New York | 19,741 Iran-born; 32,136 ancestry (ACS 2020–24) | 4.8% | 700–1,600, spread out | 20 | 20 | Optional 4th city |
| Houston | 12,449 (ACS 2020–24) | 3.0% | 375–875 | 15 | 15 | No |
| Dallas–Fort Worth | 12,214 (ACS 2020–24) | 3.0% | 350–850 | 15 | 15 | No |
| San Diego | 11,686 (ACS 2020–24) | 2.9% | 375–875 | 15 | 15 | No |
| Seattle | 9,453 (ACS 2020–24) | 2.3% | 300–650 | 15 | 15 | No |
| Chicago / Atlanta / Boston | 7,236 / 6,755 / 6,402 (ACS 2020–24) | 1.8 / 1.6 / 1.6% | 225–560 each | 10 | 12 | No |

**Country opens after:** LA + Bay Area + DC, which cover 50.2% of the Iran-born (47% by ancestry). Adding NY brings it to 55%.

**Preconditions from research 6 and 7 still apply:**
- **An Americas moderator** must be in place before LA opens person-to-person categories.
- **The US goods rule:** no "new from Iran" goods.

**Business evidence:**
- **LA's Ketab Iranian Yellow Pages:** about 2,500 listings in 2017 (research 6) [1 source].
- **[Iranian Business Center](https://iranianbusinesscenter.com/), US and Canada:** 759 listings in Oct 2026. LA 84, Atlanta 31, Houston 23, Irvine 17 [1 source].
- **"Persian restaurant" places in the US:** 651, with California 285 and Texas 54 ([Rentech](https://rentechdigital.com/smartscraper/business-report-details/list-of-persian-restaurants-in-united-states), Apr 2026) [1 source].
- **Ownership rate:** Iranian immigrants have one of the highest business-ownership rates, 21.5% ([SBA study via PAAIA](https://www.paaia.org/CMS/sba-report-iranians-with-one-of-highest-rates-of-immigrant-owned-businesses), 2000 data) [1 source].

---

## 6. Australia

**Measure:** born in Iran, ABS 2021 Census by Greater Capital City. The total is **70,899** ([ABS Data API](https://data.api.abs.gov.au/rest/data/ABS,C21_G09_SA2,1.0.0/3.4203._T..GCCSA+AUS.)).

The 95,690 in research 5 is the 2025 estimated resident population, which is not comparable with census counts. On that basis, Sydney is about 35k and Melbourne about 28k in 2025 [estimate].

| City | Iranian population (source, year) | % of country | Plausible businesses [estimate] | Business target | Listing target | Opens the country? |
|---|---|---|---|---|---|---|
| **Sydney** (Parramatta, The Hills, Ryde, Hornsby) | **26,044** Iran-born (ABS, 2021) | **36.7%** | 300–550 | **25** | **30** | **Yes (1 of 2)** |
| **Melbourne** (Manningham, Whittlesea, Casey) | **20,922** Iran-born (ABS, 2021) | **29.5%** | 230–450 | **25** | **30** | **Yes (2 of 2)** |
| Brisbane | 6,288 (ABS, 2021) | 8.9% | 50–110 | 10 | 12 | No |
| Perth | 6,224 (ABS, 2021) | 8.8% | 50–110 | 10 | 12 | No |
| Adelaide | 5,147 (ABS, 2021) | 7.3% | 50–110 | 10 | 12 | No |
| Canberra | 1,109 (ABS, 2021) | 1.6% | 10–25 | — | — | No |

**Country opens after:** Sydney + Melbourne, which cover 66.2%.

No Australian Persian directory with counts was found. The "plausible" column uses the UK ratio of 1 business per 60–120 Iran-born residents [estimate].

---

## 7. United Kingdom

**Measure:** born in Iran, Census 2021 for England and Wales, with a total of **109,168** ([Nomis TS012](https://www.nomisweb.co.uk/api/v01/dataset/NM_2032_1.data.csv)). Scotland adds 4,803 (Census 2022, [NRS](https://ukds-ckan.s3.eu-west-1.amazonaws.com/2022/NRS/UV204/census_2022_UV204_Country_of_birth_Local_authority_CA2019.csv)) and Northern Ireland 461, for a UK total of ≈114,400. "Iranian" ethnicity in England and Wales is 106,011.

| City | Iranian population (source, year) | % of country (E&W) | IraniLink listings today | Plausible businesses [estimate] | Business target | Listing target | Opens the country? |
|---|---|---|---|---|---|---|---|
| **London** (Barnet 11,227, Ealing 3,796, Westminster 2,458…) | **43,852** (ONS, 2021) | **40.2%** | 324 | 550–900 | **30** | **30** | **Yes (1 of 3)** |
| **Greater Manchester** | **10,351**; Manchester city 2,759 (ONS, 2021) | **9.5%** | 98 | 130–220 | **20** | **20** | **Yes (2 of 3)** |
| **Birmingham** (West Midlands) | 7,692; Birmingham city 4,624 (ONS, 2021) | **7.0%** | 39 | 70–130 | **15** | **15** | **Yes (3 of 3)** |
| Leeds (West Yorkshire) | 2,961; West Yorkshire 4,915 (ONS, 2021) | 2.7% (4.5%) | 27 | 40–80 | 10 | 12 | No |
| Glasgow | 2,647 (NRS, 2022) | 2.3% of UK | 24 | 30–60 | 10 | 12 | No |
| Newcastle (Tyne & Wear) | 1,806; Tyne & Wear 3,226 (ONS, 2021) | 1.7% (3.0%) | 18 | 30–60 | 10 | 12 | No |
| Liverpool | 1,927 (ONS, 2021) | 1.8% | 15 | 20–45 | 10 | 12 | No |
| Sheffield / Cardiff / Brighton / Nottingham | 1,837 / 1,273 / 1,176 / 1,114 (ONS, 2021) | 1.0–1.7% | 7 / 9 / 20 / 7 | 10–35 each | — | — | No |

**Country opens after:** London + Greater Manchester + Birmingham, which cover 56.7% of England and Wales.

**The census undercounts the dispersal cities.** It predates most of the 2022–25 small-boat arrivals, and many asylum seekers are housed in Glasgow, Liverpool, Birmingham, Manchester, Leeds, Newcastle and Stoke [estimate]. No Home Office table gives Iranians by local authority.

**Competitor:** IraniLink's directory has exactly 689 business pages ([sitemap](https://iranilink.co.uk/sitemap.xml), counted 26 Oct 2026) [1 source].
- **The city split:** London 47%, Manchester 14%.
- **The category mix:** 51% food and drink, and few professionals.
- **What it means for us:** London's 30 businesses are reachable, but the restaurants are already listed elsewhere for free. **Recruit professionals first** (lawyers, translators, dentists, immigration solicitors).

---

## 8. Netherlands

**Measure:** Iranian background (born in Iran or with an Iranian-born parent), CBS, 1 Jan 2026. The total is **65,721** ([CBS 85458NED](https://opendata.cbs.nl/ODataApi/odata/85458NED)).

| City | Iranian population (source, year) | % of country | Plausible businesses [estimate] | Business target | Listing target | Opens the country? |
|---|---|---|---|---|---|---|
| **Amsterdam** (incl. Amstelveen, Haarlemmermeer) | 5,839; Groot-Amsterdam 9,210 (CBS, 2026) | 8.9% (metro **14.0%**) | 70–140 | **15** | **20** | **Yes (1 of 4)** |
| **Rotterdam** | 4,102; Rijnmond 7,260 (CBS, 2026) | 6.2% (11.0%) | 50–110 | **10** | **15** | **Yes (2 of 4)** |
| **The Hague** (incl. Delft, Zoetermeer) | 3,458; agglomeration 6,907 (CBS, 2026) | 5.3% (10.5%) | 50–110 | **10** | **15** | **Yes (3 of 4)** |
| **Utrecht** | 2,201; Utrecht province 6,310 (CBS, 2026) | 3.3% (9.6%) | 25–60 | **10** | **12** | **Yes (4 of 4)** |
| Almere | 2,564 (CBS, 2026) | 3.9% | 15–35 | — | — | No. Count it toward Amsterdam |
| Eindhoven | 2,001; region 3,268 (CBS, 2026) | 3.0% (5.0%) | 25–60 | 10 | 12 | No |
| Groningen | 1,563 (CBS, 2026) | 2.4% | 10–30 | — | — | No |

**Country opens after:** Amsterdam, Rotterdam, The Hague and Utrecht. They cover ≈45% by metro and 24% by city limits. The three Randstad provinces together hold 60.3%.
- The Netherlands is one hour by train end to end.
- An alternative is to treat the **Randstad as one "city"** with 30 businesses / 30 listings, then open the country.

---

## 9. Sweden

**Measure:** born in Iran, SCB, 31 Dec 2025. The total is **87,292** ([SCB FolkmRegFlandKCKM](https://www.statistikdatabasen.scb.se/pxweb/sv/ssd/START__BE__BE0101__BE0101E/FolkmRegFlandKCKM/)).

**Surprise:** Göteborg *kommun* (13,332) has more Iran-born residents than Stockholm *kommun* (12,419). By metro, Stockholm is still clearly first.

| City | Iranian population (source, year) | % of country | Plausible businesses [estimate] | Business target | Listing target | Opens the country? |
|---|---|---|---|---|---|---|
| **Stockholm** (län: Solna, Järfälla, Sollentuna, Täby…) | 12,419 kommun; **32,852** län (SCB, 2025) | 14.2% (län **37.6%**) | 400–700 | **25** | **30** | **Yes (1 of 2)** |
| **Göteborg** (Storgöteborg: Mölndal, Partille…) | 13,332 kommun; **18,120** metro (SCB, 2025) | 15.3% (metro **20.8%**) | 250–400 | **20** | **20** | **Yes (2 of 2)** |
| Malmö (incl. Lund) | 4,504 kommun; 7,221 Stormalmö (SCB, 2025) | 5.2% (8.3%) | 100–170 | 10 | 15 | No |
| Uppsala | 4,051 (SCB, 2025) | 4.6% | 40–80 | 10 | 12 | No |
| Västerås / Linköping / Örebro | 2,337 / 1,511 / 1,259 (SCB, 2025) | 1.4–2.7% | 15–40 each | — | — | No |

**Country opens after:** Stockholm + Göteborg, which cover 58.4% by metro.

**Business evidence:** Iran-born men in Sweden were self-employed at 10.0% in 2007, against 4.1% for native men ([IFN WP 1544](https://www.ifn.se/media/z4airxqp/wp1544.pdf)). A competing Persian directory app, **Iroonia**, has existed since Aug 2025 ([mwm.ai](https://mwm.ai/apps/iroonia/6748890926)) [1 source].

---

## 10. Italy

**Measure:** Iranian **citizens**, ISTAT, 1 Jan 2025. The total is **23,626**, up 18.8% in a year ([ISTAT via tuttitalia](https://www.tuttitalia.it/statistiche/cittadini-stranieri/repubblica-islamica-dell-iran/)). Iran-born is 30,532 (Eurostat 2025).

| City | Iranian population (source, year) | % of country | Plausible businesses [estimate] | Business target | Listing target | Opens the country? |
|---|---|---|---|---|---|---|
| **Milan** | 2,985 comune; 3,830 province (ISTAT, 2025) | 12.6% (16.2%) | 30–70 | **10** | **20** | **Yes (1 of 3)** |
| **Turin** | 3,418 comune (1,119 in 2020); 3,782 province (ISTAT, 2025) | 14.5% (16.0%) | 15–35 | **8** | **20** | **Yes (2 of 3)** |
| **Rome** | 2,453 comune; 2,867 province (ISTAT, 2025) | 10.4% (12.1%) | 30–70 | **10** | **15** | **Yes (3 of 3)** |
| Padua | 1,032 (ISTAT, 2025) | 4.4% | 5–15 | — | — | No |
| Bologna | 907 (ISTAT, 2025) | 3.8% | 5–15 | — | — | No |
| Genoa / Pavia / Florence / Naples | 819 / 584 / 512 / 457 (ISTAT, 2025) | 1.9–3.5% | <10 each | — | — | No |

**Country opens after:** Milan, Turin and Rome. They cover 44% by province and 37.5% by comune.

**Italy is different:**
- Growth comes from students (Politecnico di Torino and Milano, Padua, Pavia).
- Their needs are **rooms, furniture and lessons, not businesses**. Turin's tourism office calls Sharazad "the only Persian restaurant" in the city.
- **So in Italy, let listings carry the opening:** a low business target (8–10) and a higher listing target (15–20).
- Turin's target of 8 is the tightest in this report: it is 25–50% of the plausible businesses there.

---

## 11. France

**Measure:** INSEE publishes only a national figure: **26,000** born in Iran (2023, research 5). **No official city or department figure exists.** The department tables group Iran under "autres pays d'Asie", and the detailed files are for researchers only.

| City | Iranian population (source, year) | % of country | Plausible businesses [estimate] | Business target | Listing target | Opens the country? |
|---|---|---|---|---|---|---|
| **Paris** (Île-de-France) | 14,000–17,000 [estimate]. 37% of all immigrants live in Île-de-France ([INSEE](https://www.insee.fr/fr/statistiques/6793282)), and the educated urban Iranian community clusters even more | ≈55–65% [estimate] | 150–350 | **20** | **20** | **Yes, alone** |
| Lyon (Auvergne-Rhône-Alpes) | 1,500–2,500 [estimate] | ≈6–10% | 15–40 | 10 | 12 | No |
| Toulouse, Nice, Marseille | 1,000–1,800 per region [estimate] | ≈4–7% each | <25 each | — | — | No |

**Country opens after:** Paris. The French texts for paid offers and the consumer mediator come first (research 5 §3).

Le Figaro (Mar 2026) puts all Iranians in France at about 40,000 [1 source]; that would include the second generation.

---

## 12. Turkey

**Measure:** residence-permit holders, **74,537** on 15 Oct 2026 (Göç İdaresi, research 9 §1.1). **No official data by province or district exists** (research 9 §1.5; nothing newer was found today).

The best proxy is new companies with an Iranian partner in Jan–Sep 2026: Istanbul 320 of 431 (74%), Ankara 36, İzmir 20, Antalya 10 (TOBB, research 9 §1.4). People are less concentrated than companies [estimate].

| City | Iranian population (source, year) | % of country | Plausible businesses [estimate] | Business target | Listing target | Opens the country? |
|---|---|---|---|---|---|---|
| **Istanbul** | 35,000–55,000 residents [estimate]. 8,693 of ≈12,000 Iranian-partner companies (TEPAV, 2025) [1 source] | ≈50–60% [estimate] | 600–1,500 (including permit consultants, property and travel agents) | **30** | **30** | **Yes (1 of 2)** |
| **Ankara** (mostly Çankaya) | 6,000–10,000 [estimate] | ≈8–12% | 60–150 | **15** | **15** | **Yes (2 of 2)** |
| İzmir | 3,000–6,000 [estimate] | ≈4–7% | 30–80 | 10 | 12 | No |
| Antalya | 3,000–6,000 [estimate] | ≈4–7% | 30–80 | 10 | 12 | No |
| Van | A visitor city: 580k Iranian visits in Jan–Aug 2026, and only 1,240 permits of all nationalities (research 9) | — | — | Events only | — | No |

**Country opens after:** Istanbul + Ankara, ≈60–70% [estimate].

**Research 9's limits still apply in Turkey:**
- **No property listings (rooms included) and no cars, ever** (EİDS).
- **Verified businesses first.**
- **Private listings only in the safe categories.**
- **KVKK must be in place before the first Turkish account.**
- **What counts toward Istanbul's 30 listings:** items, services from verified businesses, lessons, events and (later) jobs.
- **Higher-risk businesses:** permit consultants, property and travel agents, and exchange offices make up a large part of Istanbul's Iranian businesses. They need the Level 2 checks from research 11. Exchange offices stay banned.

---

## 13. Later: Belgium, Denmark, Norway, Switzerland, Spain

One city each opens the country, with small targets: **10–15 businesses and 12–15 listings**.

| Country | Total (source, year) | Main city (share) | Opens the country |
|---|---|---|---|
| Norway | 26,497 immigrants + Norwegian-born children ([SSB 09817](https://data.ssb.no/api/v0/en/table/09817), 2026) | **Oslo 6,958 (26.3%)**; with Bærum and Lillestrøm 36.6%. Bergen, Trondheim and Stavanger ≈1,100 each | Oslo (incl. Bærum), 15 / 15 |
| Denmark | 28,877 immigrants + descendants ([StatBank FOLK1C](https://www.statbank.dk/FOLK1C), Q3 2026) | Copenhagen municipality 4,726 (16.4%); **Capital Region 14,969 (51.8%)**; Aarhus 3,459 (12.0%) | Greater Copenhagen, 15 / 15 |
| Belgium | ≈17,500 Iran-born (Eurostat, 2022) | **No city figure published** (Statbel splits only Belgian/foreign). Brussels-Capital 40–55% [estimate] | Brussels, 10 / 15 |
| Switzerland | 7,540 Iranian citizens (BFS STAT-TAB px-x-0103010000_101, 2025) | Zurich canton 1,595 (21.2%), Bern 13.4%, Vaud 11.9%, Geneva 10.3% | Zurich + Geneva/Lausanne (≈43%), 10 / 12 each |
| Spain | 12,942 Iran-born aged 16+ ([INE 76271](https://www.ine.es/jaxiT3/Tabla.htm?t=76271), Census 2024); ≈14,000 all ages [estimate] | **No city figure published.** Madrid 30–38%, Barcelona 25–32% [estimate] | Madrid + Barcelona, 10 / 12 each |

---

## 14. The "people waitlist" reward

### What successful launches gave early sign-ups

| Platform | Early reward | Lesson |
|---|---|---|
| **Robinhood** | Queue position only. A referral moved you up, and access came in batches of about 100. Close to 1M sign-ups before or around launch ([Growth Playbook](https://thegrowthplaybook.substack.com/p/how-robinhood-turned-a-landing-page)) [secondary sources disagree on timing] | Access and status cost nothing and work |
| **Nextdoor** | A $25 gift card to a founder who brought 10 neighbours within 21 days ([NextCity](https://nextcity.org/urbanist-news/building-the-facebook-of-neighborhoods)) [1 source] | Reward the recruiter, and tie it to a city threshold |
| **Depop** | A listing contest for new sellers: 15 winners got **6 months of free boosting** ([List Perfectly](https://listperfectly.com/?p=11254)) [1 source] | A free boost of your own product is the standard reward, but capped |
| **Kleinanzeigen** | No early-user boosts found. Its promotions are **capped by count**: free DHL shipping for the first 110,000 purchases (Advent 2025), and 14,000 for an Apple Pay promotion ([mydealz](https://www.mydealz.de/magazin/dhl-versand-geschenkt-kleinanzeigen-startet-adventsaktion-50096)) | "First N" with a fixed cap is normal and legally clean |
| **Vinted** (Australia, Jun 2026) | No seller fees, plus free UK-to-Australia shipping as a launch promotion ([NationalWorld](https://www.nationalworld.com/news/beth-hackman-vinted-hack-clothes-australia-4-pounds-shipping-8958756)) [1 source]. No early-member perk found | Make the first action free, not just the sign-up |
| **OLX** | Listing stays free; only top placement is paid ([Business Today KE](https://businesstoday.co.ke/olx-introduces-top-listing-fees)) | Free listing plus paid boost is the classifieds model, so a free boost is a real gift |

**Pattern:** successful launches rewarded early users with **status, early access and a capped amount of their own paid feature**. None used cash prizes. A prize draw would also need clear terms under German law (§ 6 (1) Nr. 4 DDG, round 5).

### Recommendation

This refines round 5's "3 free bumps for pioneers":

| City size | First N confirmed sign-ups per city | Reward |
|---|---|---|
| Big | **200** | 1 free bump |
| Medium | **100** | 1 free bump |
| Small | **50** | 1 free bump |

N is 20% of round 6's people gate (1,000 / 500 / 250), so the reward stays scarce.

**Rules:**
- **Confirmed sign-ups only:** double opt-in and a verified phone or Telegram at the moment of use. Multiple accounts can't then collect several bumps.
- **Usable from day 3 to day 60 after the city opens**, on a live listing in that city.
  - If 200 people bump on opening day in a city with 30 listings, the bumps cancel each other out [estimate].
  - Spreading them out keeps the page fresh for two months.
- **Referral bonus:** +1 bump for every 3 confirmed friends, at most +3 (round 5), plus the «پیشگام [شهر]» badge for everyone on the list before opening.
- **Businesses don't get this reward.** Their reward is the founding place: the first N businesses = the business target.

**Cost to us:**
- **Zero cash.** A bump is our own product: it moves `ranked_at`, with no outside cost.
- **Face value:** €1.99 per bump (`docs/setup.md`), so a big city gives away at most 200 × €1.99 = **€398 in face value**, €199 for a medium city and €100 for a small one.
- **Lost sales are close to zero.** Few of these users would have bought a bump in a new, quiet city [estimate].
- **Tax:** a free bump has no price, so it is probably not a sale. Outside the EU (UK VAT from the first £) it then triggers nothing [assessment]. Confirm with the tax advisor.
- Bumped listings keep their mark, as for paid bumps (research 9, UWG Annex No. 11a).

---

## 15. Summary: all decision tables in one place

| Country | Cities that must open first (business / listing target) | Coverage | Country opens after |
|---|---|---|---|
| Germany | Berlin (open, seed 30/30), Hamburg 30/30, Cologne–Bonn 25/30, Düsseldorf 20/20, Frankfurt 20/20 | ≈33% (metro) | These 5. Exception to the 50% rule: Germany is decentralised |
| Austria | Vienna 25/30 | 59% | Vienna |
| Canada | Toronto 30/30, Vancouver 30/30 | 70% | These 2. Montreal waits for French texts |
| US | LA 30/30, Bay Area 25/30, DC 20/20 (NY 20/20 optional) | 50% (55% with NY) | These 3 |
| Australia | Sydney 25/30, Melbourne 25/30 | 66% | These 2 |
| UK | London 30/30, Manchester 20/20, Birmingham 15/15 | 57% | These 3 |
| Netherlands | Amsterdam 15/20, Rotterdam 10/15, The Hague 10/15, Utrecht 10/12 | ≈45% (metro) | These 4, or the Randstad as one 30/30 |
| Sweden | Stockholm 25/30, Göteborg 20/20 | 58% | These 2 |
| Italy | Milan 10/20, Turin 8/20, Rome 10/15 | ≈44% (province) | These 3. Listings matter more than businesses |
| France | Paris 20/20 | ≈55–65% [estimate] | Paris, after the French texts |
| Turkey | Istanbul 30/30, Ankara 15/15 | ≈60–70% [estimate] | These 2, within research 9's category limits |
| Later | Oslo 15/15, Copenhagen 15/15, Brussels 10/15, Zurich + Geneva 10/12, Madrid + Barcelona 10/12 | — | Main city (or two) |

**Totals:**
- **28 city waitlists** are needed to open the 11 countries, counting NY. Berlin opens at launch and isn't on a waitlist.
- Summing the targets gives about **575 founding businesses** and about **650 live listings**. Berlin's seed adds 30 / 30.
- The 5 later countries need 7 more waitlists and about 80 businesses.

---

## Weak evidence and gaps

- **Germany:** citizens only for most cities; migration background only for Berlin, Hamburg, Cologne and Nuremberg. Stuttgart, Bremen and Leipzig were not found. Different registers give different counts (Cologne 5,522 city register vs 6,085 AZR).
- **France, Spain, Belgium and Turkey:** **no official city data.** Every city share for them is an estimate.
- **US:** ACS undercounts against Pew (×1.4–1.8). LA's Pew figure includes Armenian and Assyrian Iranians.
- **UK:** the 2021 census misses most post-2022 asylum arrivals in the dispersal cities.
- **Business counts:**
  - Only IraniLink (UK, exact sitemap count) and a few directory totals are real counts.
  - Google Maps, Yelp, TripAdvisor and OpenStreetMap were blocked or unusable today.
  - Every "plausible businesses" figure is an estimate built from ownership-rate ratios.
- **Listing targets:** these follow the owner's "two screens" rule and my judgement. I found no published benchmark for "how full a city page must be".
- **Waitlist rewards:** Robinhood's figures come from growth blogs; Nextdoor, Depop and Vinted each from one source.
