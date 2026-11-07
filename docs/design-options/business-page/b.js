// Design B «کارت پروفایل»: no big cover; a profile card like Instagram, Airbnb's host card and
// Doctolib: logo with a ring, numbers, trust lines, buttons, round "highlights" (photo albums the
// business picks), then tabs. On computers the card stays on the side and the tabs fill the rest.
// States: about (the «دربارهٔ ما» tab), recs (the «نظرها» tab), story (a highlight open), contact.
const tab = { about: 'about', recs: 'recs' }[STATE] || 'all';
const HIGHLIGHTS = [['zereshk', 'منو'], ['kabab', 'کباب‌ها'], ['zereshk2', 'کترینگ'], ['samovar', 'یلدا'], ['gondi', 'آشپزخانه']];

const stat = (n, l) => `<div class="text-center"><p class="text-lg font-black leading-6">${n}</p><p class="text-xs text-neutral-600">${l}</p></div>`;
const card = `<section class="relative overflow-hidden border-neutral-200 bg-white px-4 pt-5 pb-4 lg:rounded-3xl lg:border lg:p-6 lg:shadow-sm"><div class="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-brand-50 lg:hidden"></div><div class="relative">
  <div class="flex items-center gap-4">
    <span class="rounded-[1.6rem] bg-gradient-to-tr from-saffron-500 via-saffron-400 to-brand-600 p-[3px]"><span class="block rounded-[1.45rem] bg-white p-[3px]">${logoBox('size-[5.25rem] rounded-[1.3rem] shadow-none ring-0')}</span></span>
    <div class="grid flex-1 grid-cols-3 gap-1">${stat(fa(B.listings.length), 'آگهی')}${stat(fa(B.events.length), 'رویداد')}${stat(B.followers, 'دنبال‌کننده')}</div>
  </div>
  <h1 class="mt-4 flex flex-wrap items-center gap-1.5 text-2xl font-extrabold">${B.name}${verifiedMark()}${founding()}</h1>
  <p class="text-sm font-medium text-brand-800">${B.type}، ${B.place}</p>
  <p class="mt-2 text-[15px] leading-7 text-neutral-800">${B.tagline}</p>
  <ul class="mt-3 space-y-2 text-sm">
    <li class="flex items-center gap-2">${I('clock', 'size-4 text-neutral-500')}${openDot()}</li>
    <li class="flex items-center gap-2">${I('thumbUp', 'size-4 text-neutral-500')}<span><b class="text-green-800">${B.recPct}</b> پیشنهاد می‌کنند <span class="text-neutral-600">(${fa(26)} نظر)</span></span></li>
    <li class="flex items-center gap-2">${I('langs', 'size-4 text-neutral-500')}${B.langs}</li>
    <li class="flex items-center gap-2">${I('bolt', 'size-4 text-neutral-500')}${B.reply}</li>
    <li class="flex items-center gap-2">${I('verified', 'size-4 text-brand-700')}<span class="text-neutral-700">مدارک ثبت کسب‌وکار دیده شده، نوامبر ۲۰۲۶</span></li>
  </ul>
  <div class="mt-4 grid grid-cols-[1fr_1fr_auto] gap-2">
    <a class="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-brand-700 text-sm font-bold text-white">${I('chat', 'size-4')}پیام</a>
    <a class="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 text-sm font-bold text-brand-800">${I('plus', 'size-4')}دنبال کردن</a>
    <a class="flex size-11 items-center justify-center rounded-xl border border-neutral-300 bg-white" aria-label="تماس">${I('phone', 'size-5')}</a></div>
  <div class="mt-3 flex gap-2 text-sm">${LINKS.map(([ic, l]) => `<a class="flex size-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-800" aria-label="${l}">${I(ic, 'size-[18px]')}</a>`).join('')}<a class="flex h-10 items-center gap-1 rounded-full bg-neutral-100 px-3 text-neutral-800">${I('route', 'size-4')}مسیر</a></div>
</div></section>`;

const highlights = `<div class="no-scrollbar flex gap-4 overflow-x-auto px-4 pt-4 pb-1 lg:px-0">${HIGHLIGHTS.map(([k, l], i) => `<a class="flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 text-xs font-medium"><span class="rounded-full p-[2.5px] ${i < 3 ? 'bg-gradient-to-tr from-saffron-500 to-brand-600' : 'bg-neutral-300'}"><span class="block rounded-full bg-white p-[2.5px]"><img src="${img(k)}" alt="" class="size-16 rounded-full object-cover"></span></span>${l}</a>`).join('')}</div>`;

const TABS = [['all', 'همه'], ['listings', `آگهی‌ها ${fa(B.listings.length)}`], ['events', `رویدادها ${fa(B.events.length)}`], ['recs', `نظرها ${fa(26)}`], ['about', 'دربارهٔ ما']];
const tabs = `<nav class="no-scrollbar sticky top-[57px] z-20 mt-4 flex overflow-x-auto border-b border-neutral-200 bg-white px-2 lg:top-[65px] lg:mt-0 lg:px-0">${TABS.map(([k, l]) => `<a class="shrink-0 px-3 py-3 text-sm ${k === tab ? 'border-b-2 border-brand-700 font-bold text-brand-800' : 'text-neutral-600'}">${l}</a>`).join('')}</nav>`;

const allTab = `<div class="space-y-6 px-4 pt-4 lg:px-0">
  <div><p class="mb-2 flex items-center gap-1 text-xs font-bold text-saffron-700">${I('star', 'size-3.5')}سنجاق‌شده</p>${bpEvent(B.events[0])}</div>
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-3">${B.listings.map((l, i) => bpCard(l, i === 3 ? 'lg:hidden' : '')).join('')}</div>
  ${bpEvent(B.events[1])}
  <div><h2 class="mb-3 text-lg font-extrabold">عکس‌ها</h2><div class="grid grid-cols-3 gap-1 overflow-hidden rounded-2xl">${B.photos.map(([k]) => `<img src="${img(k)}" alt="" class="aspect-[4/5] w-full object-cover">`).join('')}</div></div>
</div>`;

const aboutTab = `<div class="space-y-4 px-4 pt-4 lg:px-0">
  <p class="leading-8 text-neutral-800">${B.about}</p>
  <ul class="grid grid-cols-2 gap-2 lg:grid-cols-3">${B.facts.map(([ic, t]) => `<li class="flex h-11 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm">${I(ic, 'size-4 text-brand-700')}${t}</li>`).join('')}</ul>
  <div class="grid gap-4 lg:grid-cols-2">
    <div class="rounded-2xl border border-neutral-200 bg-white p-4"><div class="mb-2 flex items-center justify-between"><h2 class="font-extrabold">ساعت کار</h2>${openDot('text-sm')}</div>${hoursTable()}</div>
    <div class="rounded-2xl border border-neutral-200 bg-white p-4"><h2 class="mb-3 font-extrabold">نشانی</h2>${miniMap()}<p class="mt-3 text-sm"><bdi dir="ltr">${B.address}</bdi></p><p class="mt-1 text-sm text-neutral-600">۴ دقیقه پیاده تا ایستگاه <bdi dir="ltr">U7 Eisenacher Straße</bdi></p></div>
  </div>
  <div class="rounded-2xl border border-neutral-200 bg-white p-4"><h2 class="mb-3 font-extrabold">منو، پرطرفدارها</h2><ul class="divide-y divide-neutral-200">${B.menu.flatMap((c) => c.items).slice(0, 4).map(([n, d, p]) => `<li class="flex items-center justify-between gap-3 py-2.5"><span><b class="block text-sm">${n}</b><span class="text-xs text-neutral-600">${d}</span></span><b class="shrink-0 text-brand-800">${p}</b></li>`).join('')}</ul></div>
  <p class="text-sm text-neutral-600">${B.since}</p>
  ${legalFold()}
</div>`;

const recsTab = `<div class="px-4 pt-4 lg:px-0">${recsBlock({ cards: 3, title: false })}<div class="mt-3">${proposal()}</div></div>`;

const body = { all: allTab, about: aboutTab, recs: recsTab }[tab];

const story = `<div class="fixed inset-0 z-50 bg-black lg:flex lg:items-center lg:justify-center lg:bg-black/90">
  <div class="relative h-full w-full overflow-hidden lg:h-[90vh] lg:w-auto lg:aspect-[9/16] lg:rounded-2xl">
    <img src="${img('zereshk')}" alt="" class="absolute inset-0 size-full object-cover">
    <div class="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent px-3 pt-3 pb-10 text-white">
      <div class="flex gap-1">${[1, 0, 0, 0].map((x, i) => `<span class="h-[3px] flex-1 overflow-hidden rounded-full bg-white/40"><i class="block h-full bg-white" style="width:${i === 0 ? 100 : i === 1 ? 45 : 0}%"></i></span>`).join('')}</div>
      <div class="mt-3 flex items-center gap-2">${logoBox('size-8 rounded-lg ring-0 shadow-none')}<b class="text-sm">${B.name}</b><span class="text-xs opacity-80">منو</span><span class="ms-auto flex size-10 items-center justify-center">${I('close', 'size-6')}</span></div></div>
    <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-4 pt-16 pb-6 text-white">
      <p class="text-lg font-extrabold">جوجه‌کباب با زرشک‌پلو</p><p class="text-sm opacity-90">سینهٔ مرغ زعفرانی، زرشک‌پلو، ۱۷٫۹۰ €</p>
      <a class="mt-4 flex h-12 items-center justify-center gap-1.5 rounded-xl bg-[#fff] font-bold text-[#111]">${I('chat', 'size-5')}پیام برای سفارش</a></div>
  </div></div>`;

mount(`${header()}
<main class="mx-auto w-full max-w-6xl pb-24 lg:grid lg:grid-cols-[23rem_1fr] lg:gap-8 lg:px-6 lg:pt-6 lg:pb-12">
  <div class="lg:sticky lg:top-[89px] lg:self-start">${card}<div class="lg:hidden">${highlights}</div></div>
  <div class="min-w-0"><div class="hidden lg:block">${highlights}</div>${tabs}${body}</div>
</main>${footer()}${bottomNav(0)}
${STATE === 'story' ? story : ''}${STATE === 'contact' ? contactSheet() : ''}`);
