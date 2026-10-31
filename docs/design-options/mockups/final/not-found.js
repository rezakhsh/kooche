// Page not found (design check group 1, idea I1, Oct 31, 2026): a dead end becomes a starting point.
// Someone arriving from an old link (usually an ended listing) can search, open a category, see the
// city's newest listings and this week's events, or post, in one tap. Ended listing: its category
// is offered first.
mount(`${header()}
<main class="mx-auto w-full max-w-6xl px-4 pt-6 pb-28 lg:px-6 lg:pt-10">
  <section class="rounded-3xl border border-neutral-200 bg-gradient-to-b from-brand-50 to-white p-5 lg:flex lg:items-center lg:gap-10 lg:p-8">
    <div class="min-w-0 flex-1">
      <span class="flex size-14 items-center justify-center rounded-2xl bg-white text-brand-700 shadow-sm">${I('search', 'size-7', 1.75)}</span>
      <h1 class="mt-4 text-2xl font-black lg:text-3xl">این صفحه پیدا نشد</h1>
      <p class="mt-1.5 text-[15px] leading-7 text-neutral-700">شاید آگهی تمام شده یا نشانی اشتباه است. از همین‌جا ادامه دهید:</p>
    </div>
    <form class="mt-4 flex gap-2 lg:mt-0 lg:w-[26rem]">
      <div class="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 text-[15px] text-neutral-500">${I('search', 'size-5')}جستجو در برلین…</div>
      <a class="flex h-12 items-center rounded-xl bg-brand-700 px-4 font-bold text-white">جستجو</a>
    </form>
  </section>

  <a class="mt-4 flex items-center gap-3 rounded-2xl border border-saffron-100 bg-saffron-50 p-3.5">
    <span class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-saffron-700">${I('building', 'size-5')}</span>
    <span class="min-w-0 flex-1"><b class="block text-[15px]">دنبال اجاره آپارتمان بودید؟</b><span class="text-sm text-neutral-700">${fa(58)} آگهی فعال در برلین</span></span>
    ${I('chevronEnd', 'size-5 text-neutral-500')}
  </a>

  <h2 class="mt-7 text-lg font-extrabold">دسته‌ها</h2>
  <div class="mt-3 grid grid-cols-4 gap-2 lg:grid-cols-8">${CATS.slice(0, 7)
    .map((c) => `<a class="flex flex-col items-center gap-1.5 rounded-2xl p-2 text-center text-xs font-medium"><span class="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">${I(c.icon, 'size-6', 1.75)}</span>${c.short}</a>`)
    .join('')}<a class="flex flex-col items-center gap-1.5 rounded-2xl p-2 text-center text-xs font-medium"><span class="flex size-12 items-center justify-center rounded-2xl bg-saffron-100 text-saffron-800">${I('calendar', 'size-6', 1.75)}</span>رویدادها</a></div>

  <div class="mt-7 flex items-baseline justify-between"><h2 class="text-lg font-extrabold">تازه در برلین</h2><a class="text-sm font-bold text-brand-700">همه ←</a></div>
  <div class="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">${[L.wg, L.translate, L.phone, L.setar].map(gridCard).join('')}</div>

  <div class="mt-7 grid gap-3 lg:grid-cols-3">
    <a class="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3.5">
      <span class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-saffron-100 text-saffron-800">${I('calendar', 'size-5')}</span>
      <span class="min-w-0 flex-1"><b class="block text-[15px]">رویدادهای این هفته</b><span class="text-sm text-neutral-600">${fa(3)} رویداد در برلین</span></span>${I('chevronEnd', 'size-5 text-neutral-500')}</a>
    <a class="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3.5">
      <span class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">${I('plus', 'size-5')}</span>
      <span class="min-w-0 flex-1"><b class="block text-[15px]">آگهی رایگان بگذارید</b><span class="text-sm text-neutral-600">در چند دقیقه</span></span>${I('chevronEnd', 'size-5 text-neutral-500')}</a>
    <a class="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3.5">
      <span class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">${I('chat', 'size-5')}</span>
      <span class="min-w-0 flex-1"><b class="block text-[15px]">راهنما و پرسش‌ها</b><span class="text-sm text-neutral-600">یا با ما تماس بگیرید</span></span>${I('chevronEnd', 'size-5 text-neutral-500')}</a>
  </div>
</main>
${footer()}
${bottomNav(0)}`);
