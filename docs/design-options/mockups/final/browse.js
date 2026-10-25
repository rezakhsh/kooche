// City page: one sticky search and one chip row, then results from y≈220. Sort and view on the
// result line. A small events strip when there are events this week.
const feed = ['wg', 'car', 'rug', 'translate', 'phone', 'setar', 'room', 'german', 'desk'].map((k) => L[k]);
mount(`${header()}
<main class="mx-auto w-full max-w-6xl pb-24 lg:grid lg:grid-cols-[16rem_1fr] lg:gap-8 lg:px-6 lg:pt-6">
  <aside class="hidden lg:block">
    <nav class="rounded-2xl border border-neutral-200 p-2">
      <h2 class="px-2 pt-1 pb-2 text-xs font-bold text-neutral-600">دسته‌بندی‌ها</h2>
      <a class="flex h-10 items-center gap-2.5 rounded-xl bg-brand-50 px-2 text-sm font-bold text-brand-700">${I('grid', 'size-[18px]')}همه آگهی‌ها<span class="ms-auto text-xs">${fa(648)}</span></a>
      ${CATS.slice(0, 11).map((c) => `<a class="flex h-10 items-center gap-2.5 rounded-xl px-2 text-sm text-neutral-800">${I(c.icon, 'size-[18px] text-neutral-500')}${c.fa}<span class="ms-auto text-xs text-neutral-600">${fa(c.n)}</span></a>`).join('')}
      <a class="mt-1 flex h-11 items-center gap-2.5 border-t border-neutral-200 px-2 pt-1 text-sm font-bold text-saffron-700">${I('calendar', 'size-[18px]')}رویدادهای برلین</a>
    </nav>
  </aside>
  <div class="min-w-0">
    <div class="sticky top-[61px] z-20 bg-white px-4 pt-3 pb-2 lg:static lg:px-0 lg:pt-0">
      <div class="flex h-12 items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 text-[15px] text-neutral-500 lg:hidden">${I('search', 'size-5')}جستجو در برلین…</div>
      <div class="no-scrollbar -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:mt-0 lg:px-0">
        ${chip('فیلترها', { icon: 'sliders', tone: 'brand' })}${chip('همه دسته‌ها', { icon: 'grid', down: true })}${CATS.slice(0, 5).map((c) => chip(c.short)).join('')}
      </div>
    </div>
    <div class="flex items-center gap-2 px-4 pt-2 pb-1 lg:px-0 lg:pt-4">
      <h1 class="text-base font-extrabold lg:text-2xl">آگهی‌های برلین</h1><span class="text-sm text-neutral-600">${fa(648)} آگهی</span>
      <a class="ms-auto flex h-10 items-center gap-1 rounded-lg px-2 text-sm font-medium text-neutral-800">${I('sort', 'size-4')}تازه‌ترین</a>
      <a class="flex size-10 items-center justify-center rounded-lg border border-neutral-200 text-neutral-700" aria-label="نمای فهرست">${I('list', 'size-[18px]')}</a>
    </div>
    <a class="mx-4 mt-2 flex items-center gap-3 rounded-2xl bg-saffron-50 p-3 lg:mx-0"><img src="${EVENT.img}" class="size-12 rounded-xl object-cover" alt=""><span class="min-w-0 flex-1"><span class="block text-xs font-bold text-saffron-800">این هفته در برلین</span><b class="block truncate text-sm">${EVENT.title}</b></span><span class="text-sm font-bold text-saffron-800">${fa(3)} رویداد</span></a>
    <div class="grid grid-cols-2 gap-3 px-4 pt-3 lg:grid-cols-3 lg:gap-4 lg:px-0">${feed.map(gridCard).join('')}</div>
  </div>
</main>${footer()}${bottomNav(0)}`);
