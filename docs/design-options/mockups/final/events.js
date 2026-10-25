// Events in a city: the season first when there is one (here Yalda), a strip of days with dots
// where something happens, type chips, then events grouped by day. Posters come from Instagram, so
// they are 4:5. "خبرم کن" saves the search for new events. Online events from anywhere are included.
const days = Array.from({ length: 14 }, (_, i) => G(2026, 10, 25 + i));
const has = new Set([29, 31, 32, 35]);
const groups = [['این هفته', [E.poetry, E.party, E.newcomers]], ['هفتهٔ بعد', [E.cv, E.nava]]];
mount(`${header({ search: 'جستجو در رویدادهای برلین…' })}
<main class="mx-auto w-full max-w-6xl pb-4 lg:px-6 lg:pt-6">
  <div class="flex items-center gap-2 px-4 pt-4 lg:px-0 lg:pt-0"><div class="min-w-0 flex-1"><h1 class="text-2xl font-extrabold lg:text-3xl">رویدادهای برلین</h1><p class="text-sm text-neutral-600">کنسرت، مهمانی، شب شعر، دورهمی و کارگاه، به فارسی</p></div>
    <a class="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-brand-700 px-3.5 text-sm font-bold text-white">${I('plus', 'size-4')}ثبت رویداد</a></div>
  <a class="mx-4 mt-4 flex items-center gap-3 overflow-hidden rounded-2xl bg-[#5b1a1f] p-3 text-[#fff6e6] lg:mx-0"><img src="../img/yalda.jpg" class="size-14 rounded-xl object-cover" alt=""><span class="min-w-0 flex-1"><b class="block">فصل یلدا</b><span class="text-xs opacity-90">شب یلدا: دوشنبه ۲۱ دسامبر (۳۰ آذر)، ${fa(6)} جشن در برلین</span></span>${I('chevronEnd', 'size-5')}</a>
  <div class="no-scrollbar mt-4 flex gap-2 overflow-x-auto px-4 lg:px-0">${days.map((d, i) => { const n = d.getUTCDate() + (d.getUTCMonth() === 10 ? 31 : 0); return `<a class="flex w-14 shrink-0 flex-col items-center rounded-2xl border py-2 ${i === 0 ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200'}"><span class="text-xs ${i === 0 ? '' : 'text-neutral-600'}">${i === 0 ? 'امروز' : i === 1 ? 'فردا' : weekday(d)}</span><b class="text-lg leading-7">${gFmt(d, { day: 'numeric' })}</b><span class="text-xs ${i === 0 ? '' : 'text-neutral-600'}">${gFmt(d, { month: 'short' })}</span><i class="mt-1 size-1.5 rounded-full ${has.has(n) ? (i === 0 ? 'bg-white' : 'bg-saffron-500') : 'bg-transparent'}"></i></a>`; }).join('')}</div>
  <div class="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-4 lg:px-0">${chip('فیلترها', { icon: 'sliders', tone: 'brand' })}${chip('همه', { on: true })}${['کنسرت', 'مهمانی', 'فرهنگی و ادبی', 'دورهمی', 'کارگاه و کلاس', 'یادبود و همبستگی', 'کودکان'].map((t) => chip(t)).join('')}${chip('رایگان', { tone: 'brand' })}${chip('آنلاین', { icon: 'globe' })}</div>
  <section class="mt-5 px-4 lg:px-0"><div class="flex items-baseline justify-between"><h2 class="text-lg font-extrabold">ویژه</h2><span class="text-xs text-neutral-600">آگهی ویژه</span></div>
    <a class="mt-2 flex gap-3 rounded-2xl border border-saffron-100 bg-saffron-50 p-3"><div class="relative w-32 shrink-0 overflow-hidden rounded-xl text-[11px] lg:w-40">${poster(E.yalda)}${dateBadge(E.yalda.date)}</div>
      <div class="min-w-0 flex-1"><p class="text-xs font-bold text-saffron-800">${fullDate(E.yalda.date)}، ${E.yalda.time}</p><p class="mt-1 text-base font-extrabold leading-7">${E.yalda.title}</p><p class="mt-1 text-xs text-neutral-700"><bdi>${E.yalda.venue}</bdi>، ${E.yalda.area}</p><p class="mt-2 text-sm font-bold">${E.yalda.price}</p><p class="mt-1 flex items-center gap-1 text-xs text-neutral-700">${I('verified', 'size-3.5 text-brand-700')}${E.yalda.organizer}</p></div></a></section>
  <div class="px-4 lg:grid lg:grid-cols-2 lg:gap-x-8 lg:px-0">${groups.map(([t, list]) => `<section class="mt-6"><h2 class="sticky top-[61px] z-10 bg-white py-1 text-base font-extrabold">${t}</h2><div class="divide-y divide-neutral-200">${list.map(eventRow).join('')}</div></section>`).join('')}</div>
  <div class="mx-4 mt-6 flex items-center gap-3 rounded-2xl bg-brand-50 p-4 lg:mx-0"><span class="text-brand-700">${I('bell', 'size-6')}</span><span class="flex-1 text-sm"><b class="block">رویداد تازه که آمد خبرتان کنیم؟</b>در تلگرام یا ایمیل، هفته‌ای یک بار</span><a class="flex h-10 items-center rounded-lg bg-brand-700 px-3 text-sm font-bold text-white">خبرم کن</a></div>
</main>${footer()}${bottomNav(0)}`);

// events-filters.html: the same page with the filter sheet open. The chips stay for the quick
// choices; the sheet holds the rest: how far, which days, price, language, who it suits.
if (/filters/.test(location.pathname)) {
  const pills = (opts, on = []) => `<div class="flex flex-wrap gap-2">${opts.map((o, i) => `<span class="flex h-10 items-center rounded-full border px-3.5 text-sm ${on.includes(i) ? 'border-2 border-brand-600 bg-brand-50 font-bold text-brand-800' : 'border-neutral-300'}">${o}</span>`).join('')}</div>`;
  const seg = (opts, on) => `<div class="flex gap-1 rounded-xl bg-neutral-100 p-1">${opts.map((o, i) => `<span class="flex h-10 flex-1 items-center justify-center rounded-lg text-sm ${i === on ? 'bg-white font-bold shadow-sm' : 'text-neutral-700'}">${o}</span>`).join('')}</div>`;
  const h = (t) => `<p class="mt-5 mb-1.5 text-sm font-bold first:mt-0">${t}</p>`;
  document.getElementById('app').insertAdjacentHTML('beforeend', sheet('فیلتر رویدادها', `<div class="text-sm">
    ${h('کجا')}${seg(['فقط برلین', 'تا ۱۰۰ کیلومتر', 'کل آلمان'], 0)}<p class="mt-1 text-xs text-neutral-600">برای کنسرت‌ها «کل آلمان» هم ببینید؛ خیلی‌ها برایش سفر می‌کنند.</p>
    ${h('کی')}${pills(['امروز', 'فردا', 'این آخر هفته', 'این هفته', 'این ماه', 'انتخاب تاریخ…'], [2])}
    ${h('نوع')}${pills(['کنسرت', 'مهمانی', 'فرهنگی و ادبی', 'دورهمی', 'کارگاه و کلاس', 'یادبود و همبستگی', 'کودکان'], [0, 2])}
    ${h('قیمت')}${seg(['همه', 'رایگان', 'تا ۲۰ €'], 0)}
    ${h('زبان')}${pills(['فارسی', 'آلمانی', 'انگلیسی'], [0])}
    ${h('مناسب برای')}${pills(['خانواده و کودک', 'فقط ۱۸+', 'بدون پله'], [])}
    ${h('شکل برگزاری')}${seg(['همه', 'حضوری', 'آنلاین'], 0)}</div>`,
    `<div class="flex items-center gap-3"><a class="px-2 text-sm font-medium text-neutral-700">پاک کردن</a><a class="flex h-12 flex-1 items-center justify-center rounded-xl bg-brand-700 font-bold text-white">نمایش ${fa(4)} رویداد</a></div>`));
}
