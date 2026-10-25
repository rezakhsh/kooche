// Example events in Berlin for the events mockups (made up, like the listings). Dates are real
// calendar dates around "today" = Sunday 25 October 2026, written in the Gregorian calendar with
// Persian month names; the Jalali date only appears where it means something (Yalda, Nowruz).
const G = (y, m, d) => new Date(Date.UTC(y, m - 1, d, 12));
const gFmt = (date, opts) => new Intl.DateTimeFormat('fa-IR-u-ca-gregory-nu-arabext', { timeZone: 'UTC', ...opts }).format(date);
const weekday = (d) => gFmt(d, { weekday: 'long' });
const dayMonth = (d) => gFmt(d, { day: 'numeric', month: 'long' });
const fullDate = (d) => `${weekday(d)}، ${gFmt(d, { day: 'numeric', month: 'long', year: 'numeric' })}`;
const jalali = (d) => new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: 'UTC', day: 'numeric', month: 'long' }).format(d);

/** A typographic poster, as organisers post them on Instagram (4:5) */
function poster(e, cls = '') {
  return `<div class="relative flex aspect-[4/5] flex-col justify-between overflow-hidden ${cls}" style="background:${e.bg}">
    ${e.img ? `<img src="${e.img}" class="absolute inset-0 size-full object-cover opacity-60" alt="">` : ''}
    <div class="relative p-[7%] text-[0.7em] font-bold tracking-normal" style="color:${e.fg}">${e.kicker}</div>
    <div class="relative p-[7%]" style="color:${e.fg}"><p class="text-[1.7em] font-black leading-[1.25]">${e.big}</p><p class="mt-[4%] text-[0.75em] font-bold opacity-90">${e.small}</p></div>
  </div>`;
}

const EV = [
  { id: 'nava', title: 'کنسرت موسیقی ایرانی: گروه نوا', type: 'کنسرت', date: G(2026, 11, 8), time: '۲۰:۰۰', end: '۲۳:۰۰', venue: 'Heimathafen Neukölln', area: 'نویکلن', price: 'از ۳۵ €', organizer: 'نوا پروداکشن', verified: true, tour: [['هامبورگ', G(2026, 11, 7)], ['کلن', G(2026, 11, 9)]], going: 86,
    bg: 'linear-gradient(160deg,#06373b,#0b6e77 55%,#e9a21a)', fg: '#fff', kicker: 'NAVA ENSEMBLE · TOUR 2026', big: 'گروه نوا<br>شبی با آواز ایرانی', small: 'برلین، هامبورگ، کلن' },
  { id: 'yalda', title: 'جشن شب یلدا با موسیقی زنده و شام', type: 'مهمانی', date: G(2026, 12, 19), time: '۱۹:۰۰', end: '۰۱:۰۰', venue: 'Kulturhaus Kreuzberg', area: 'کرویتسبرگ', price: 'از ۲۵ €', organizer: 'انجمن فرهنگی پارس', verified: true, featured: true, season: 'یلدا', going: 140,
    bg: '#5b1a1f', fg: '#fff6e6', img: '../img/yalda.jpg', kicker: 'شب یلدا ۱۴۰۵', big: 'بلندترین شب سال<br>کنار هم', small: 'موسیقی زنده، شام، فال حافظ' },
  { id: 'poetry', title: 'شب شعر: خوانش شعرهای شاملو', type: 'فرهنگی و ادبی', date: G(2026, 10, 29), time: '۱۹:۰۰', venue: 'کافه کتاب ورق', area: 'شونه‌برگ', price: 'رایگان', organizer: 'حلقهٔ کتاب برلین', going: 23,
    bg: '#f4efe4', fg: '#16211f', kicker: 'حلقهٔ کتاب برلین', big: 'شاملو<br>بخوانیم', small: 'پنجشنبه‌شب، ورود آزاد' },
  { id: 'newcomers', title: 'دورهمی تازه‌واردها: Anmeldung، بیمه و حساب بانکی', type: 'دورهمی', date: G(2026, 11, 1), time: '۱۶:۰۰', venue: 'Nachbarschaftshaus', area: 'ودینگ', price: 'رایگان', organizer: 'گروه همیاری تازه‌واردها', going: 41,
    bg: '#e6f2f1', fg: '#06373b', kicker: 'دورهمی ماهانه', big: 'تازه به برلین<br>آمده‌اید؟', small: 'پرسش و پاسخ، چای و آشنایی' },
  { id: 'party', title: 'پارتی ایرانی با DJ شاهین', type: 'مهمانی', date: G(2026, 10, 31), time: '۲۳:۰۰', venue: 'Club Ost', area: 'فریدریش‌هاین', price: 'از ۱۵ €', organizer: 'Persian Nights Berlin', going: 210,
    bg: 'linear-gradient(200deg,#1b1035,#5a1d6b 60%,#e9a21a)', fg: '#fff', kicker: 'PERSIAN NIGHTS', big: 'DJ شاهین<br>تا صبح', small: 'شنبه ۳۱ اکتبر، ۲۳:۰۰' },
  { id: 'cv', title: 'کارگاه آنلاین: رزومهٔ آلمانی که دیده شود', type: 'کارگاه و کلاس', date: G(2026, 11, 4), time: '۱۹:۰۰', venue: 'آنلاین (Zoom)', area: 'آنلاین', price: '۱۰ €', organizer: 'کاریابی پل', online: true, going: 57,
    bg: '#0b6e77', fg: '#fff', kicker: 'کارگاه آنلاین', big: 'رزومهٔ آلمانی<br>Lebenslauf', small: 'چهارشنبه، ساعت ۱۹ به وقت برلین' },
];
const E = Object.fromEntries(EV.map((e) => [e.id, e]));

/** Date badge: day and month on top of the poster */
const dateBadge = (d) => `<span class="absolute start-2 top-2 rounded-xl bg-white/95 px-2 py-1 text-center leading-tight shadow-sm"><b class="block text-base">${gFmt(d, { day: 'numeric' })}</b><span class="block text-xs text-neutral-700">${gFmt(d, { month: 'short' })}</span></span>`;

/** A row for day-grouped lists: small poster, time, title, place, price */
function eventRow(e) {
  return `<a class="flex gap-3 py-3">
    <div class="relative w-24 shrink-0 overflow-hidden rounded-xl text-[9px] lg:w-28">${poster(e)}</div>
    <div class="min-w-0 flex-1">
      <p class="text-xs font-bold text-brand-800">${weekday(e.date)}، ${dayMonth(e.date)}، ساعت ${e.time}${e.season ? `<span class="ms-1 rounded-full bg-saffron-100 px-1.5 text-saffron-800">${e.season}</span>` : ''}</p>
      <p class="mt-0.5 line-clamp-2 text-[15px] font-bold leading-6">${e.title}</p>
      <p class="mt-0.5 flex items-center gap-1 truncate text-xs text-neutral-600">${I(e.online ? 'globe' : 'pin', 'size-3.5')}${e.area === 'آنلاین' ? 'آنلاین' : `<bdi>${e.venue}</bdi>، ${e.area}`}</p>
      <p class="mt-1 flex flex-wrap items-center gap-1.5 text-xs"><b class="${e.price === 'رایگان' ? 'text-green-800' : 'text-neutral-900'}">${e.price}</b>${e.tour ? `<span class="rounded-full bg-brand-50 px-2 font-bold leading-5 text-brand-800">تور ${fa(e.tour.length + 1)} شهر</span>` : ''}<span class="text-neutral-600">${fa(e.going)} نفر علاقه‌مند</span></p>
    </div>
    <span class="flex size-10 shrink-0 items-center justify-center self-start rounded-full text-neutral-600" aria-label="ذخیره">${I('heart', 'size-5')}</span>
  </a>`;
}
