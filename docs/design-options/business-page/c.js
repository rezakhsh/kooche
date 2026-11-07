// Design C «کاتالوگ»: photos first (a swipe gallery on phones, a 1+4 mosaic on computers, like Airbnb
// and Yelp), then the facts as rows like Google Maps' panel, then the menu or price list by group
// (Treatwell, Wolt), the gallery, events, listings and reviews. A booking/order bar on phones.
// States: hours (the open-now row unfolded), gallery (photo viewer), rec (write a recommendation).
const hoursOpen = STATE === 'hours';

const phoneGallery = `<div class="relative aspect-[4/3] overflow-hidden lg:hidden"><img src="${img('zereshk')}" alt="" class="size-full object-cover">
  <div class="absolute top-3 end-3 flex gap-2">${['share', 'heart'].map((ic) => `<span class="flex size-10 items-center justify-center rounded-full bg-white/95 text-neutral-800 shadow-sm">${I(ic, 'size-5')}</span>`).join('')}</div>
  <span class="absolute bottom-3 end-3 rounded-full bg-black/60 px-2.5 text-xs font-bold leading-7 text-white">۱ / ${B.photoCount}</span>
  <div class="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">${[1, 0, 0, 0, 0].map((x) => `<i class="size-1.5 rounded-full ${x ? 'bg-white' : 'bg-white/55'}"></i>`).join('')}</div></div>`;

const mosaic = `<div class="relative mt-6 hidden h-[25rem] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-3xl lg:grid">
  ${B.photos.slice(0, 5).map(([k], i) => `<img src="${img(k)}" alt="" class="size-full object-cover ${i === 0 ? 'col-span-2 row-span-2' : ''}">`).join('')}
  <a class="absolute bottom-4 end-4 flex h-10 items-center gap-1.5 rounded-xl border border-neutral-900 bg-white px-3 text-sm font-bold">${I('grid', 'size-4')}همهٔ ${B.photoCount} عکس</a></div>`;

const title = `<div class="px-4 pt-4 lg:px-0 lg:pt-6"><div class="flex items-start gap-3">
  ${logoBox('size-14 rounded-xl ring-0 lg:size-16')}
  <div class="min-w-0 flex-1"><p class="text-sm text-neutral-600">${B.type}، ${B.place}</p>
    <h1 class="flex flex-wrap items-center gap-1.5 text-2xl font-extrabold lg:text-3xl">${B.name}${verifiedMark()}${founding()}</h1></div>
  <div class="hidden gap-2 lg:flex">${[['share', 'فرستادن'], ['heart', 'نشان کردن']].map(([ic, l]) => `<a class="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold underline-offset-2 hover:underline">${I(ic, 'size-4')}${l}</a>`).join('')}</div></div>
  <p class="mt-2 flex flex-wrap items-center gap-x-2 text-sm"><span class="flex items-center gap-1 font-bold text-green-800">${I('thumbUp', 'size-4')}${B.recPct} پیشنهاد</span><span class="text-neutral-600">(${fa(26)} نظر)</span><span class="text-neutral-400">|</span><span class="text-neutral-700">${B.followers} دنبال‌کننده</span></p>
  <p class="mt-2 leading-7 text-neutral-800">${B.tagline}</p></div>`;

const row = (ic, main, sub = '', end = '') => `<li class="flex min-h-14 items-center gap-3 py-2">${I(ic, 'size-5 text-brand-700')}<div class="min-w-0 flex-1 text-sm">${main}${sub ? `<p class="text-xs text-neutral-600">${sub}</p>` : ''}</div>${end}</li>`;
const facts = (cls = '') => `<ul class="divide-y divide-neutral-200 ${cls}">
  ${row('clock', openDot(), hoursOpen ? '' : 'امروز ۱۲:۰۰–۲۲:۰۰', `<span class="flex items-center gap-1 text-sm font-bold text-brand-800">ساعت‌ها${I('chevronDown', `size-4 ${hoursOpen ? 'rotate-180' : ''}`)}</span>`)}
  ${hoursOpen ? `<li class="pb-2">${hoursTable()}<p class="mt-1 text-xs text-neutral-600">۲۴ و ۲۵ دسامبر بسته‌ایم.</p></li>` : ''}
  ${row('pin', `<bdi dir="ltr">${B.address}</bdi>`, '۴ دقیقه پیاده تا ایستگاه <bdi dir="ltr">U7 Eisenacher Straße</bdi>', `<span class="text-sm font-bold text-brand-800">مسیر</span>`)}
  ${row('phone', `<bdi dir="ltr">${B.phone}</bdi>`, '', `<span class="text-sm font-bold text-brand-800">تماس</span>`)}
  ${row('langs', B.langs)}
  ${row('bolt', B.reply)}
  ${row('instagram', `<bdi dir="ltr">@${B.insta}</bdi>`, '', `<span class="flex gap-2 text-neutral-600">${I('send', 'size-5')}${I('whatsapp', 'size-5')}${I('globe', 'size-5')}</span>`)}
  ${row('verified', 'مدارک ثبت کسب‌وکار دیده شده', 'تأیید پیدو، نوامبر ۲۰۲۶')}
</ul>`;

const menu = `<section id="menu" class="px-4 pt-6 lg:px-0"><div class="flex items-center justify-between"><h2 class="text-xl font-extrabold">منو</h2><span class="text-sm text-neutral-600">${B.menuCount} غذا، قیمت‌ها با مالیات</span></div>
  <div class="no-scrollbar sticky top-[57px] z-10 -mx-4 mt-3 flex gap-2 overflow-x-auto bg-white px-4 py-2 lg:top-[65px] lg:mx-0 lg:px-0">${['پرطرفدارها', ...B.menu.map((c) => c.cat)].map((c, i) => chip(c, { on: i === 0 })).join('')}</div>
  ${B.menu.map((c) => `<h3 class="mt-4 mb-1 text-sm font-extrabold text-neutral-600">${c.cat}</h3><ul class="divide-y divide-neutral-200">${c.items.map(([n, d, p, k, pop]) => `<li class="flex items-center gap-3 py-3">
    <div class="min-w-0 flex-1"><p class="flex items-center gap-1.5 font-bold">${n}${pop ? '<span class="rounded-full bg-saffron-50 px-2 text-xs leading-5 text-saffron-800">پرطرفدار</span>' : ''}</p><p class="text-sm leading-6 text-neutral-600">${d}</p><p class="mt-0.5 font-extrabold text-brand-800">${p}</p></div>
    ${k ? `<img src="${img(k)}" alt="" class="size-20 shrink-0 rounded-xl object-cover">` : ''}</li>`).join('')}</ul>`).join('')}
</section>`;

const gallery = `<section class="px-4 pt-8 lg:hidden"><h2 class="mb-3 text-xl font-extrabold">عکس‌ها</h2><div class="grid h-64 grid-cols-3 grid-rows-2 gap-1.5 overflow-hidden rounded-2xl">${B.photos.slice(1, 4).map(([k], i) => `<img src="${img(k)}" alt="" class="size-full object-cover ${i === 0 ? 'col-span-2 row-span-2' : ''}">`).join('')}</div>
  <a class="mt-3 flex h-11 items-center justify-center rounded-xl border border-neutral-300 text-sm font-bold">همهٔ ${B.photoCount} عکس</a></section>`;

const rest = `<div class="space-y-8 px-4 pt-8 lg:px-0">
  ${section('events', 'رویدادها', `<div class="grid gap-3 lg:grid-cols-2">${B.events.map((e) => bpEvent(e)).join('')}</div>`)}
  ${section('listings', 'آگهی‌ها', `<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">${B.listings.map((l) => bpCard(l)).join('')}</div>`)}
  ${recsBlock()}
  ${section('about', 'دربارهٔ ما', `<p class="leading-8 text-neutral-800">${B.about}</p><ul class="mt-3 flex flex-wrap gap-2">${B.facts.map(([ic, t]) => `<li class="flex h-9 items-center gap-1.5 rounded-full bg-neutral-100 px-3 text-sm">${I(ic, 'size-4 text-brand-700')}${t}</li>`).join('')}</ul><p class="mt-3 text-sm text-neutral-600">${B.since}</p>`)}
  ${legalFold()}</div>`;

const side = `<aside class="hidden lg:block"><div class="sticky top-[89px] space-y-4 pt-6"><div class="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
  <a class="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-brand-700 font-bold text-white">${I('chat', 'size-5')}پیام برای رزرو یا سفارش</a>
  <div class="mt-2 grid grid-cols-2 gap-2"><a class="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-neutral-300 text-sm font-bold">${I('phone', 'size-4')}تماس</a><a class="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 text-sm font-bold text-brand-800">${I('plus', 'size-4')}دنبال کردن</a></div>
  ${facts('mt-3')}<div class="mt-3">${miniMap()}</div></div></div></aside>`;

const bar = `<div class="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white px-4 pt-2.5 pb-3 lg:hidden"><div class="flex gap-2">
  <a class="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-700 font-bold text-white">${I('chat', 'size-5')}پیام برای رزرو یا سفارش</a>
  <a class="flex size-12 items-center justify-center rounded-xl border border-neutral-300" aria-label="تماس">${I('phone', 'size-5')}</a></div></div>`;

mount(`${header()}
<main class="mx-auto w-full max-w-6xl pb-28 lg:px-6 lg:pb-12">${phoneGallery}${mosaic}
  <div class="lg:grid lg:grid-cols-[1fr_22rem] lg:gap-10"><div class="min-w-0">${title}
    <div class="mx-4 mt-4 rounded-2xl border border-neutral-200 bg-white px-4 lg:hidden">${facts()}</div>
    <div class="mt-4 grid grid-cols-3 gap-2 px-4 lg:hidden">${[['phone', 'تماس'], ['route', 'مسیر'], ['plus', 'دنبال کردن']].map(([ic, l], i) => `<a class="flex h-11 items-center justify-center gap-1.5 rounded-xl border text-sm font-bold ${i === 2 ? 'border-brand-200 bg-brand-50 text-brand-800' : 'border-neutral-300'}">${I(ic, 'size-4')}${l}</a>`).join('')}</div>
    ${menu}${gallery}${rest}</div>${side}</div>
</main>${footer()}${bar}
${STATE === 'gallery' ? viewer(2) : ''}${STATE === 'rec' ? recSheet() : ''}`);
