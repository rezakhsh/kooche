// Design A «ویترین»: a photo cover, one scrolling page with section links that stay on top, a contact
// bar fixed at the bottom on phones and a sticky contact card beside the page on computers.
// States: contact (contact sheet), gallery (photo viewer), rec (write a recommendation),
// plain (a business without photos: a sworn translator; the cover falls back to a pattern),
// menu (scrolled to the menu), fullmenu (the whole menu open).
const plain = STATE === 'plain';
if (plain) {
  Object.assign(B, {
    name: 'دارالترجمهٔ رسمی مهر', type: 'ترجمهٔ رسمی', tagline: 'مترجم رسمی قسم‌خوردهٔ فارسی و آلمانی، تحویل حضوری و پستی',
    about: 'ترجمهٔ رسمی شناسنامه، مدرک تحصیلی، گواهینامه و سند ازدواج، با مهر مترجم قسم‌خورده (beeidigte Übersetzerin) که همهٔ اداره‌های آلمان قبول می‌کنند. کمک در فرم‌های Jobcenter و Ausländerbehörde هم داریم.',
    place: 'شارلوتنبورگ، برلین', address: 'Beispielweg 5, 10623 Berlin', followers: '۹۱', openNow: 'باز است، تا ۱۸:۰۰', recLine: '۱۱ نفر از ۱۱ نفر پیشنهاد می‌کنند', recPct: '۱۰۰٪',
    facts: [['stamp', 'مترجم قسم‌خورده'], ['truck', 'ارسال پستی'], ['devices', 'سفارش آنلاین'], ['card', 'پرداخت با کارت']],
    hours: [['دوشنبه', '۰۹:۰۰–۱۸:۰۰'], ['سه‌شنبه', '۰۹:۰۰–۱۸:۰۰'], ['چهارشنبه', '۰۹:۰۰–۱۸:۰۰'], ['پنجشنبه', '۰۹:۰۰–۱۸:۰۰'], ['جمعه', '۰۹:۰۰–۱۵:۰۰'], ['شنبه', '۱۰:۰۰–۱۴:۰۰', true], ['یکشنبه', null]],
    menu: [{ cat: 'خدمات', items: [['ترجمهٔ رسمی شناسنامه', 'فارسی به آلمانی، با مهر، تحویل ۳ روزه', 'از ۳۵ €', null, true], ['ترجمهٔ مدرک تحصیلی و ریزنمرات', 'هر صفحه', 'از ۴۵ €', null], ['ترجمهٔ گواهینامهٔ رانندگی', 'برای تعویض در Bürgeramt', '۴۵ €', null], ['کمک در فرم‌های اداری', 'Jobcenter، Ausländerbehörde، Elterngeld', '۳۰ € هر ساعت', null]] }],
    menuCount: '۹', photos: [], events: [],
    listings: [{ title: 'ترجمهٔ رسمی مدارک فارسی به آلمانی، مترجم قسم‌خورده', price: 'از ۳۵ €', unit: '', img: null, tile: 'ترجمه', ago: 'امروز' }, { title: 'کمک در فرم‌های Jobcenter و Ausländerbehörde', price: '۳۰ €', unit: 'هر ساعت', img: null, tile: 'اداری', ago: 'دیروز' }, { title: 'ترجمهٔ گواهینامهٔ رانندگی برای تعویض', price: '۴۵ €', unit: '', img: null, tile: 'ترجمه', ago: '۳ روز پیش' }],
    recs: [{ name: 'نیما ر.', when: 'اکتبر ۲۰۲۶', yes: true, tags: ['سر وقت', 'جواب سریع'], text: 'شناسنامه و مدرک لیسانس را دادم، سه روزه آماده شد و Anerkennung بدون مشکل قبول کرد.', reply: 'ممنون از اعتمادتان، موفق باشید.' }, { name: 'لیلا ح.', when: 'سپتامبر ۲۰۲۶', yes: true, tags: ['قیمت منصفانه'], text: 'برای فرم Elterngeld خیلی صبور بودند و همه چیز را فارسی توضیح دادند.', reply: '' }],
  });
  B.listings.forEach((l) => (l.tileIcon = 'doc'));
}
// Instagram-style numbers (owner, Nov 7, 2026: followers visible): followers, listings, and events or reviews
const STATS = [[B.followers, 'دنبال‌کننده'], [fa(B.listings.length), 'آگهی'], B.events.length ? [fa(B.events.length), 'رویداد'] : [fa(11), 'نظر']];
const LOGO_PLAIN = `<span class="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-white text-3xl font-black text-brand-800 shadow-md ring-4 ring-white lg:size-28 lg:text-4xl">م</span>`;
const PATTERN = `<svg class="absolute inset-0 size-full" aria-hidden="true"><defs><linearGradient id="g" x1="1" x2="0"><stop offset="0" stop-color="#095a62"/><stop offset="1" stop-color="#0b6e77"/></linearGradient><pattern id="p" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M22 5l5 12 12 5-12 5-5 12-5-12-12-5 12-5z" fill="none" stroke="#fff" stroke-opacity=".13" stroke-width="1.4"/><circle cx="22" cy="22" r="3" fill="#e9a21a" fill-opacity=".35"/></pattern></defs><rect width="100%" height="100%" fill="url(#g)"/><rect width="100%" height="100%" fill="url(#p)"/></svg>`;

const sections = [['intro', 'دربارهٔ ما'], ['menu', plain ? 'خدمات و قیمت‌ها' : 'منو'], ...(B.photos.length ? [['photos', 'عکس‌ها']] : []), ...(B.events.length ? [['events', 'رویدادها']] : []), ['listings', 'آگهی‌ها'], ['recs', 'نظرها'], ['about', 'ساعت و نشانی']];

const cover = `<div class="relative h-48 overflow-hidden lg:mt-6 lg:h-72 lg:rounded-3xl">
  ${plain ? PATTERN : `<img src="${img('zereshk')}" alt="" class="size-full object-cover object-[50%_60%]"><div class="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent to-50%"></div>`}
  <div class="absolute top-3 end-3 flex gap-2">${['share', 'heart'].map((ic) => `<span class="flex size-10 items-center justify-center rounded-full bg-white/95 text-neutral-800 shadow-sm">${I(ic, 'size-5')}</span>`).join('')}</div>
  ${plain ? '' : `<span class="absolute bottom-3 end-3 flex h-9 items-center gap-1.5 rounded-full bg-black/60 px-3 text-sm font-bold text-white">${I('image', 'size-4')}${B.photoCount} عکس</span>`}
</div>`;

const roundBtn = (ic, label, tone = '') => `<a class="flex flex-col items-center gap-1.5 text-xs font-medium"><span class="flex size-12 items-center justify-center rounded-full ${tone || 'border border-neutral-300 bg-white text-neutral-800'}">${I(ic, 'size-5')}</span>${label}</a>`;

const identity = `<div class="relative px-4 lg:px-0">
  <div class="-mt-10 flex items-end gap-3 lg:-mt-14">${plain ? LOGO_PLAIN : logoBox('size-20 rounded-2xl lg:size-28')}
    <div class="hidden min-w-0 flex-1 pb-1 lg:block"></div></div>
  <h1 class="mt-3 flex flex-wrap items-center gap-1.5 text-2xl font-extrabold lg:text-3xl">${B.name}${verifiedMark('size-6 lg:size-7')}${founding()}</h1>
  <p class="mt-1 text-[15px] text-neutral-700">${B.tagline}</p>
  <p class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">${openDot()}<span class="text-neutral-600">${B.place}</span><span class="flex items-center gap-1 font-bold text-green-800">${I('thumbUp', 'size-4')}${B.recPct} پیشنهاد</span></p>
  <p class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-neutral-600"><span class="flex items-center gap-1">${I('langs', 'size-4')}${B.langs}</span><span class="flex items-center gap-1">${I('bolt', 'size-4')}${B.replyShort}</span></p>
  <div class="mt-4 grid max-w-md grid-cols-3 rounded-2xl border border-neutral-200 bg-white py-2.5 text-center">${STATS.map(([n, l], i) => `<a class="${i ? 'border-s border-neutral-200' : ''}"><b class="block text-lg font-black leading-6">${n}</b><span class="text-xs text-neutral-600">${l}</span></a>`).join('')}</div>
  <div class="mt-4 grid grid-cols-4 gap-2 lg:hidden">${roundBtn('plus', 'دنبال کردن', 'bg-brand-50 text-brand-800 border border-brand-200')}${roundBtn('route', 'مسیر')}${roundBtn(plain ? 'globe' : 'instagram', plain ? 'وب‌سایت' : 'اینستاگرام')}${roundBtn('share', 'فرستادن')}</div>
</div>`;

const nav = `<nav class="no-scrollbar sticky top-[57px] z-20 mt-5 flex gap-1 overflow-x-auto border-b border-neutral-200 bg-white/95 px-3 backdrop-blur lg:top-[65px] lg:px-0">${sections.map(([id, l], i) => `<a class="shrink-0 px-2.5 py-3 text-sm ${(STATE === 'menu' ? id === 'menu' : i === 0) ? 'border-b-2 border-brand-700 font-bold text-brand-800' : 'text-neutral-600'}">${l}</a>`).join('')}</nav>`;

const menuRows = (items) => `<ul class="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white px-3">${items.map(([n, d, p, k, pop]) => `<li class="flex items-center gap-3 py-3">
  ${k ? `<img src="${img(k)}" alt="" class="size-16 shrink-0 rounded-xl object-cover">` : ''}
  <div class="min-w-0 flex-1"><p class="flex flex-wrap items-center gap-1.5 font-bold">${n}${pop ? '<span class="rounded-full bg-saffron-50 px-2 text-xs leading-5 text-saffron-800">پرطرفدار</span>' : ''}</p><p class="text-sm leading-6 text-neutral-600">${d}</p></div>
  <p class="shrink-0 font-extrabold text-brand-800">${p}</p></li>`).join('')}</ul>`;
const popular = B.menu.flatMap((c) => c.items).slice(0, plain ? 4 : 5);

const infoBlock = `<div class="space-y-4">
  <div class="rounded-2xl border border-neutral-200 bg-white p-4"><div class="mb-2 flex items-center justify-between"><h3 class="font-extrabold">ساعت کار</h3>${openDot('text-sm')}</div>${hoursTable()}</div>
  <div class="rounded-2xl border border-neutral-200 bg-white p-4"><h3 class="mb-3 font-extrabold">نشانی</h3>${miniMap()}<p class="mt-3 flex items-center gap-2 text-sm"><bdi dir="ltr">${B.address}</bdi></p>
    <a class="mt-3 flex h-11 items-center justify-center gap-1.5 rounded-xl border border-neutral-300 text-sm font-bold">${I('route', 'size-4')}مسیر با نقشه</a></div>
  <div class="rounded-2xl border border-neutral-200 bg-white p-4"><h3 class="mb-3 font-extrabold">راه‌های تماس</h3>${linkPills()}</div></div>`;

const main = `<div class="min-w-0 space-y-9 px-4 pt-6 lg:px-0">
  ${section('intro', 'معرفی', `<p class="line-clamp-3 leading-8 text-neutral-800 lg:line-clamp-none">${B.about}</p><a class="mt-1 inline-flex min-h-9 items-center text-sm font-bold text-brand-800 lg:hidden">بیشتر</a>
    <ul class="mt-3 flex flex-wrap gap-2">${B.facts.map(([ic, t]) => `<li class="flex h-9 items-center gap-1.5 rounded-full bg-neutral-100 px-3 text-sm">${I(ic, 'size-4 text-brand-700')}${t}</li>`).join('')}</ul>
    <p class="mt-4 flex items-start gap-2 rounded-xl bg-brand-50 p-3 text-sm leading-6 text-brand-800">${I('verified', 'size-5 mt-0.5')}<span>${VERIFIED_WHAT}. ${B.since}.</span></p>`)}
  ${section('menu', plain ? 'خدمات و قیمت‌ها' : 'پرطرفدارهای منو', menuRows(popular), plain ? `همهٔ خدمات (${B.menuCount})` : `همهٔ منو (${B.menuCount})`)}
  ${B.photos.length ? section('photos', 'عکس‌ها', `<div class="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:grid lg:grid-cols-4 lg:px-0">${B.photos.slice(0, 4).map(([k, c], i) => `<a class="relative aspect-[4/5] w-36 shrink-0 overflow-hidden rounded-2xl lg:w-auto"><img src="${img(k)}" alt="${c}" class="size-full object-cover">${i === 3 ? `<span class="absolute inset-0 flex items-center justify-center bg-black/45 text-lg font-bold text-white">+${fa(8)}</span>` : ''}</a>`).join('')}</div>`, `همه (${B.photoCount})`) : ''}
  ${B.events.length ? section('events', 'رویدادهای پیش رو', `<div class="grid gap-3 lg:grid-cols-2">${B.events.map((e) => bpEvent(e)).join('')}</div>`) : ''}
  ${section('listings', `آگهی‌ها <span class="text-base font-bold text-neutral-500">(${fa(B.listings.length)})</span>`, `<div class="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 lg:mx-0 lg:grid lg:grid-cols-3 lg:px-0">${B.listings.slice(0, 3).map((l) => bpCard(l, 'w-44 shrink-0 lg:w-auto')).join('')}</div>`, 'همه')}
  ${recsBlock()}
  <section id="about" class="space-y-4 lg:hidden"><h2 class="text-lg font-extrabold">ساعت کار و نشانی</h2>${infoBlock}</section>
  ${legalFold()}
</div>`;

const aside = `<aside class="hidden lg:block"><div class="sticky top-[130px] space-y-4 pt-6">
  <div class="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
    <div class="flex items-center justify-between">${openDot()}<span class="text-sm text-neutral-600">امروز ${B.hours.find((h) => h[2])[1]}</span></div>
    <a class="mt-4 flex h-12 items-center justify-center gap-1.5 rounded-xl bg-brand-700 font-bold text-white">${I('chat', 'size-5')}پیام</a>
    <div class="mt-2 grid grid-cols-2 gap-2"><a class="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-neutral-300 text-sm font-bold">${I('phone', 'size-4')}تماس</a><a class="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-neutral-300 text-sm font-bold">${I('route', 'size-4')}مسیر</a></div>
    <p class="mt-3 flex items-center gap-1.5 text-xs text-neutral-600">${I('bolt', 'size-4')}${B.reply}</p>
    <a class="mt-4 flex h-11 items-center justify-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 text-sm font-bold text-brand-800">${I('plus', 'size-4')}دنبال کردن <span class="font-normal">(${B.followers})</span></a>
  </div>
  <div class="rounded-3xl border border-neutral-200 bg-white p-5"><h3 class="mb-2 font-extrabold">ساعت کار</h3>${hoursTable()}</div>
  <div class="rounded-3xl border border-neutral-200 bg-white p-5"><h3 class="mb-3 font-extrabold">نشانی و تماس</h3>${miniMap()}<p class="mt-3 text-sm"><bdi dir="ltr">${B.address}</bdi></p><div class="mt-3">${linkPills()}</div></div>
</div></aside>`;

const contactBar = `<div class="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white px-4 pt-2.5 pb-3 lg:hidden"><div class="flex gap-2">
  <a class="flex h-12 flex-1 flex-col items-center justify-center rounded-xl bg-brand-700 text-white"><span class="flex items-center gap-1.5 font-bold leading-5">${I('chat', 'size-4')}پیام</span><span class="text-xs leading-4 opacity-90">${B.replyShort}</span></a>
  <a class="flex h-12 w-24 items-center justify-center gap-1.5 rounded-xl border border-neutral-300 font-bold">${I('phone', 'size-4')}تماس</a>
  <a class="flex size-12 items-center justify-center rounded-xl border border-neutral-300" aria-label="راه‌های دیگر">${I('more', 'size-5')}</a></div></div>`;

mount(`${header()}
<main class="mx-auto w-full max-w-6xl pb-28 lg:px-6 lg:pb-12">${cover}
  <div class="lg:grid lg:grid-cols-[1fr_22rem] lg:gap-10"><div class="min-w-0">${identity}${nav}${main}</div>${aside}</div>
</main>${footer()}${contactBar}
${STATE === 'fullmenu' ? sheet(`منوی ${B.name}`, `<div class="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4">${B.menu.map((c, i) => chip(c.cat, { on: i === 0 })).join('')}</div>${B.menu.map((c) => `<h3 class="mt-3 text-sm font-extrabold text-neutral-600">${c.cat}</h3>${menuRows(c.items)}`).join('')}<p class="mt-3 text-xs text-neutral-600">قیمت‌ها با مالیات. برای سفارش یا رزرو پیام بدهید.</p>`) : ''}${STATE === 'contact' ? contactSheet() : ''}${STATE === 'gallery' ? viewer(1) : ''}${STATE === 'rec' ? recSheet() : ''}`);
