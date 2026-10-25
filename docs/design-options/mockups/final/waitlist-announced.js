// Austria after the date is announced (Vienna passed 75% of its goals), seen by a signed-in pioneer:
// the date with what happens when, their opening-day listings and where each one is in review,
// and the goals that are still filling. The date is a calendar date, never a countdown.
const bar = (label, n, goal, tone) => `<p class="mt-3 flex justify-between text-xs text-saffron-800"><span>${label}: <b>${fa(n)}</b> از ${fa(goal)}</span><span>${fa(Math.round((n / goal) * 100))}٪</span></p><span class="mt-1 block h-2 overflow-hidden rounded-full bg-white"><i class="block h-full rounded-full ${tone}" style="width:${Math.min(100, (n / goal) * 100)}%"></i></span>`;
const when = [[true, 'وین به ۷۵٪ رسید، تاریخ اعلام شد', '۲۸ ژانویه'], ['now', 'بررسی آگهی‌های روز افتتاح', '۶ تا ۱۷ مارس'], [false, 'ورود پیشگام‌ها، آگهی‌هایشان منتشر می‌شود', 'پنجشنبه ۱۸ مارس'], [false, 'افتتاح برای همه', 'شنبه ۲۰ مارس']];
const drafts = [['room5.webp', 'اتاق ۱۴ متری در WG، نزدیک Westbahnhof', 'تأیید شد، ۱۸ مارس منتشر می‌شود', 'text-green-800'], ['rug1.webp', 'فرش دستباف کاشان ۲×۳', 'در صف بررسی', 'text-saffron-800']];
mount(`${header({ place: 'وین', search: 'جستجو در پیدو…' })}
<main>
  <section class="bg-gradient-to-b from-brand-50 to-white px-4 pt-7 pb-4 lg:pt-12">
    <div class="mx-auto max-w-2xl">
      <p class="flex items-center gap-2 text-sm font-bold text-brand-800">${flag('at', 'h-4 w-6')}اتریش</p>
      <h1 class="mt-3 text-[26px] font-black leading-[1.5] lg:text-4xl">وین شنبه ۲۰ مارس ۲۰۲۷ باز می‌شود</h1>
      <p class="mt-1 text-sm text-neutral-600">۲۹ اسفند ۱۴۰۵، شب عید</p>
      <p class="mt-2 text-base leading-8 text-neutral-700">شما پیشگام وین هستید: دو روز زودتر وارد می‌شوید و آگهی‌هایتان از همان لحظه دیده می‌شود.</p>
    </div>
  </section>
  <section class="mx-auto max-w-2xl px-4 lg:grid lg:max-w-5xl lg:grid-cols-2 lg:items-start lg:gap-6">
    <div>
      <ol class="rounded-3xl border border-neutral-200 p-4">${when.map(([s, t, d], i) => `<li class="flex gap-3 ${i ? 'mt-3' : ''}"><span class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${s === true ? 'bg-brand-700 text-white' : s === 'now' ? 'border-2 border-saffron-500 bg-saffron-50' : 'border-2 border-neutral-300'}">${s === true ? I('check', 'size-3.5', 3) : s === 'now' ? '<i class="size-2 rounded-full bg-saffron-500"></i>' : ''}</span><span class="flex-1"><b class="block text-sm">${t}</b><span class="text-xs text-neutral-600">${d}</span></span></li>`).join('')}</ol>
      <h2 class="mt-6 text-lg font-extrabold">آگهی‌های روز افتتاح شما</h2>
      <ul class="mt-3 space-y-2">${drafts.map(([img, t, s, c]) => `<li class="flex items-center gap-3 rounded-2xl border border-neutral-200 p-2.5"><img src="../img/${img}" class="aspect-[4/3] w-20 rounded-xl object-cover" alt=""><span class="min-w-0 flex-1"><b class="block truncate text-sm">${t}</b><span class="text-xs font-bold ${c}">${s}</span></span>${I('chevronEnd', 'size-4 text-neutral-400')}</li>`).join('')}</ul>
      <a class="mt-3 flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-300 font-bold text-brand-800">${I('plus', 'size-5')}آگهی سوم (تا ۱۱ مارس)</a>
      <p class="mt-2 text-xs leading-6 text-neutral-600">هر آگهی پیش از افتتاح بررسی می‌شود. ۷۲ ساعت قبل از ۱۸ مارس از شما می‌پرسیم که هنوز معتبر است یا نه.</p>
    </div>
    <div>
      <div class="mt-6 rounded-2xl bg-saffron-50 p-4 lg:mt-0"><p class="text-sm font-bold text-saffron-800">هدف‌های وین</p>
        ${bar('نفر', 251, 300, 'bg-saffron-500')}${bar('کسب‌وکار تأییدشده', 13, 15, 'bg-brand-600')}${bar('آگهی آماده برای روز اول', 52, 60, 'bg-brand-600')}
        <p class="mt-3 text-xs leading-6 text-saffron-800">تاریخ قطعی است. هر دوستی که تا ۱۸ مارس با پیوند شما بپیوندد، پیشگام می‌شود.</p>
        <a class="mt-3 flex h-11 items-center justify-center gap-2 rounded-xl border border-saffron-300 bg-white text-sm font-bold text-neutral-900">${I('send', 'size-4 text-brand-700')}دعوت دوستان در تلگرام</a></div>
      <div class="mt-4 flex items-center gap-3 rounded-2xl border border-neutral-200 p-3.5"><span class="flex size-10 items-center justify-center rounded-xl bg-saffron-100 text-saffron-800">${I('calendar', 'size-5')}</span><span class="flex-1"><b class="block text-sm">جشن افتتاح و نوروز در وین</b><span class="text-xs text-neutral-600">شنبه ۲۰ مارس، رایگان برای پیشگام‌ها</span></span>${I('chevronEnd', 'size-4 text-neutral-400')}</div>
    </div>
  </section>
</main>${footer()}${bottomNav(0)}`);
