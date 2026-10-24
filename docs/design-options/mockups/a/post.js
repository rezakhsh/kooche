// A: posting start: as on Divar, a category list with a search box, plus the open draft on top
mount(`
<header class="sticky top-0 z-30 border-b border-neutral-200 bg-white lg:hidden"><div class="flex items-center gap-2 px-2 py-2"><a class="flex size-11 items-center justify-center">${I('back', 'size-6')}</a><h1 class="text-base font-bold">ثبت آگهی</h1></div></header>
<div class="hidden lg:block">${header()}</div>
<main class="mx-auto w-full max-w-xl px-4 pb-28 lg:pt-10">
  <h1 class="hidden pb-2 text-2xl font-bold lg:block">ثبت آگهی</h1>
  <a class="mt-4 flex items-center gap-3 rounded-lg border border-neutral-200 p-3"><img src="../img/room3.webp" class="size-14 rounded object-cover" alt=""><span class="flex-1"><span class="block text-xs font-bold text-saffron-700">پیش‌نویس</span><b class="text-[15px]">میز تحریر چوبی و صندلی</b></span><span class="text-sm font-bold text-brand-800">ادامه</span></a>
  <h2 class="mt-6 text-base font-bold">دستهٔ آگهی را انتخاب کنید</h2>
  <div class="mt-3 flex h-12 items-center gap-2 rounded-lg bg-neutral-100 px-3 text-[15px] text-neutral-500">${I('search', 'size-5')}جستجو در دسته‌ها، مثلاً «اتاق» یا «دوچرخه»</div>
  <ul class="mt-2 divide-y divide-neutral-200">
    ${CATS.slice(0, 11).map((c) => `<li class="flex items-center gap-3 py-3.5"><span class="text-neutral-600">${I(c.icon, 'size-6', 1.75)}</span><span class="text-base">${c.fa}</span>${I('chevronEnd', 'ms-auto size-5 text-neutral-400')}</li>`).join('')}
  </ul>
</main>${bottomNav(2)}`);
