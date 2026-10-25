// An event page. Phone: the poster whole (4:5) on a blurred copy of itself, then date, place and
// price as three clear rows with their actions (calendar, route, tickets), the tour's other cities,
// details, the organiser, a ticket-safety note, similar events; tickets always at the bottom.
// Computer: poster on one side, everything else beside it with a sticky ticket box.
const e = E.nava;
const rows = [
  ['calendar', fullDate(e.date), `<span class="me-1 rounded-full bg-saffron-100 px-2 whitespace-nowrap text-saffron-800">۱۴ روز دیگر</span>ساعت ${e.time} تا ${e.end}، به وقت برلین`, 'تقویم'],
  ['pin', `<bdi>${e.venue}</bdi>`, '<bdi dir="ltr">Karl-Marx-Straße 141, 12043 Berlin</bdi>', 'مسیر'],
  ['ticket', `بلیت ${e.price}`, 'فروش در سایت برگزارکننده', ''],
];
const ticketBox = `<div class="rounded-2xl border border-neutral-200 p-4"><p class="text-sm text-neutral-600">بلیت</p><p class="text-2xl font-black">${e.price}</p>
  <a class="mt-3 flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-700 font-bold text-white">خرید بلیت${I('share', 'size-4')}</a>
  <div class="mt-2 grid grid-cols-2 gap-2"><a class="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-neutral-300 text-sm font-bold">${I('heart', 'size-4')}علاقه‌مندم</a><a class="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-neutral-300 text-sm font-bold">${I('send', 'size-4')}اشتراک</a></div>
  <p class="mt-3 text-xs text-neutral-600">${fa(e.going)} نفر علاقه‌مندند</p></div>`;
const organizer = `<section class="rounded-2xl border border-neutral-200 p-4"><div class="flex items-center gap-3"><span class="flex size-12 items-center justify-center rounded-xl bg-brand-950 text-lg font-black text-white">ن</span><div class="min-w-0 flex-1"><p class="flex items-center gap-1 font-bold">${e.organizer}${I('verified', 'size-4 text-brand-700')}</p><p class="text-xs text-neutral-600">برگزارکنندهٔ تأییدشده، ${fa(12)} رویداد در پیدو</p></div><a class="flex h-10 items-center rounded-lg border border-brand-200 bg-brand-50 px-3 text-sm font-bold text-brand-800">دنبال کردن</a></div></section>`;
const safety = `<p class="flex gap-2 rounded-xl bg-saffron-50 p-3 text-sm leading-7 text-saffron-800">${I('alert', 'size-5 mt-1')}<span>بلیت را فقط از لینک رسمی برگزارکننده بخرید. هرگز با PayPal «دوستان و خانواده» یا کارت‌به‌کارت پول ندهید؛ بلیت دست‌دوم و «عکس بلیت» بیشترین کلاهبرداری را دارد.</span></p>`;
mount(`<div class="hidden lg:block">${header()}</div>
<main class="mx-auto w-full max-w-6xl pb-28 lg:grid lg:grid-cols-[22rem_1fr] lg:gap-10 lg:px-6 lg:pt-8">
  <div class="relative lg:sticky lg:top-20 lg:self-start">
    <div class="relative overflow-hidden bg-[#06373b] lg:rounded-3xl"><div class="absolute inset-0 scale-110 opacity-50 blur-2xl">${poster(e)}</div>
      <div class="relative mx-auto w-[72%] py-14 text-[15px] lg:w-full lg:py-0 lg:text-[19px]">${poster(e, 'rounded-xl shadow-2xl lg:rounded-none')}</div></div>
    <div class="mt-4 hidden lg:block">${ticketBox}</div>
    <div class="absolute inset-x-0 top-0 flex items-center gap-2 p-3 lg:hidden"><a class="flex size-11 items-center justify-center rounded-full bg-white/95 shadow" aria-label="بازگشت">${I('back', 'size-5')}</a><a class="ms-auto flex size-11 items-center justify-center rounded-full bg-white/95 shadow" aria-label="اشتراک">${I('share', 'size-5')}</a><a class="flex size-11 items-center justify-center rounded-full bg-white/95 shadow" aria-label="ذخیره">${I('heart', 'size-5')}</a></div>
  </div>
  <div class="min-w-0 space-y-5 px-4 pt-4 lg:px-0 lg:pt-0">
    <div><p class="text-sm font-bold text-brand-800">${e.type}، برلین</p><h1 class="mt-1 text-2xl font-black leading-[1.5] lg:text-3xl">${e.title}</h1></div>
    <ul class="divide-y divide-neutral-200 rounded-2xl border border-neutral-200">${rows.map(([ic, a, b, act]) => `<li class="flex items-center gap-3 p-3.5"><span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">${I(ic, 'size-5')}</span><span class="min-w-0 flex-1"><b class="block text-[15px]">${a}</b><span class="block truncate text-xs text-neutral-600">${b}</span></span>${act ? `<a class="shrink-0 text-sm font-bold text-brand-800">${act}</a>` : ''}</li>`).join('')}</ul>
    <section><h2 class="mb-2 text-lg font-extrabold">این تور در شهرهای دیگر</h2><div class="flex gap-2">${e.tour.map(([c, d]) => `<a class="flex-1 rounded-2xl border border-neutral-200 p-3"><b class="block">${c}</b><span class="text-xs text-neutral-600">${weekday(d)}، ${dayMonth(d)}</span></a>`).join('')}</div></section>
    <section><h2 class="mb-2 text-lg font-extrabold">اجراکنندگان</h2><div class="flex gap-2">${[['ر', 'رها صادقی', 'آواز'], ['ک', 'کیان', 'تار'], ['م', 'مهرداد', 'تنبک']].map(([i, n, r]) => `<span class="flex items-center gap-2 rounded-full border border-neutral-200 py-1 ps-1 pe-3"><span class="flex size-8 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-800">${i}</span><span class="text-sm"><b>${n}</b> <span class="text-xs text-neutral-600">${r}</span></span></span>`).join('')}</div></section>
    <section><h2 class="mb-2 text-lg font-extrabold">دربارهٔ رویداد</h2><p class="text-base leading-8 text-neutral-800">گروه نوا با تار، کمانچه، تنبک و آواز، شبی با تصنیف‌های قدیمی و قطعه‌های تازه. همراه با اجرای مهمان از برلین.</p>
      <dl class="mt-3 grid grid-cols-2 gap-2 text-sm">${[['زبان', 'فارسی'], ['سن', 'همهٔ سنین'], ['صندلی', 'نشسته، شماره‌دار'], ['دسترسی', 'بدون پله'], ['بازپرداخت', 'تا ۷ روز پیش از کنسرت'], ['بلیت دم در', 'اگر تمام نشود']].map(([k, v]) => `<div class="rounded-xl bg-neutral-50 p-3"><dt class="text-xs text-neutral-600">${k}</dt><dd class="font-bold">${v}</dd></div>`).join('')}</dl></section>
    <div class="lg:hidden">${organizer}</div>
    ${safety}
    <div class="hidden lg:block">${organizer}</div>
    <section><h2 class="mb-2 text-lg font-extrabold">رویدادهای مشابه</h2><div class="divide-y divide-neutral-200">${[E.yalda, E.poetry].map(eventRow).join('')}</div></section>
    <p class="flex justify-between border-t border-neutral-200 pt-4 text-sm text-neutral-600"><span>کد رویداد: ${faDigits(731500264)}</span><a class="flex items-center gap-1">${I('flag', 'size-4')}گزارش</a></p>
  </div>
</main>
<div class="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-neutral-200 bg-white px-4 pt-3 pb-4 lg:hidden"><p class="flex-1"><span class="block text-xs text-neutral-600">${dayMonth(e.date)}، ${e.time}</span><b class="text-lg">${e.price}</b></p><a class="flex size-12 items-center justify-center rounded-xl border border-neutral-300" aria-label="علاقه‌مندم">${I('heart', 'size-5')}</a><a class="flex h-12 items-center gap-2 rounded-xl bg-brand-700 px-5 font-bold text-white">خرید بلیت${I('share', 'size-4')}</a></div>
${'<div class="hidden lg:block">' + footer() + '</div>'}`);
