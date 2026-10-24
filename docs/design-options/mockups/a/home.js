// A: city page: search + city in the header, the category grid, then the newest listings as rows
const feed = ['wg', 'car', 'translate', 'rug', 'phone', 'setar', 'room', 'german', 'desk'].map((k) => L[k]);
const grid = CATS.slice(0, 7).map((c) => [c.short, c.icon]).concat([['همه دسته‌ها', 'grid']]);
mount(`${header()}
<main class="mx-auto w-full max-w-6xl px-4 pb-24 lg:grid lg:grid-cols-[15rem_1fr] lg:gap-8 lg:px-6 lg:pt-6">
  <aside class="hidden lg:block text-sm">
    <h2 class="mb-2 font-bold text-neutral-500">دسته‌ها</h2>
    ${CATS.slice(0, 12).map((c) => `<a class="flex items-center gap-2.5 py-2 text-neutral-800">${I(c.icon, 'size-5 text-neutral-500')}${c.fa}</a>`).join('')}
    <hr class="my-3 border-neutral-200"><a class="flex items-center gap-2.5 py-2 font-bold text-brand-800">${I('calendar', 'size-5')}رویدادهای برلین</a>
  </aside>
  <div class="min-w-0">
    <div class="grid grid-cols-4 gap-x-2 gap-y-4 py-4 lg:hidden">${grid.map(([t, ic]) => `<a class="flex flex-col items-center gap-1.5 text-center text-xs font-medium text-neutral-800"><span class="flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">${I(ic, 'size-7', 1.75)}</span>${t}</a>`).join('')}</div>
    <a class="mb-1 flex items-center gap-3 rounded-lg bg-neutral-50 px-3 py-2.5 text-sm lg:hidden"><span class="flex size-9 items-center justify-center rounded-lg bg-white text-brand-700">${I('calendar', 'size-5')}</span><span class="flex-1"><b>جشن شب یلدا</b>، شنبه ۲۰ دسامبر</span><span class="text-brand-800 font-medium">رویدادها</span></a>
    <h1 class="pt-4 pb-1 text-sm font-bold text-neutral-500 lg:pt-0 lg:pb-4 lg:text-xl lg:text-neutral-900">تازه‌ترین آگهی‌های برلین</h1>
    <div class="lg:grid lg:grid-cols-2 lg:gap-4">${feed.map((l, i) => row(l, { first: i === 0 })).join('')}</div>
  </div>
</main>${bottomNav(0)}`);
