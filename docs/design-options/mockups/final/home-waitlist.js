// First visit from a country that is not open yet (here Canada): say so honestly, collect the
// city and an email for the waitlist (a gate for opening, docs/strategy.md), let people invite
// friends, and show what already works from anywhere (online events, the open countries).
const cities = ['تورنتو', 'ونکوور', 'مونترال', 'کلگری', 'اتاوا', 'شهر دیگر'];
mount(`${header({ place: 'کانادا', search: 'جستجو در پیدو…' })}
<main>
  <section class="bg-gradient-to-b from-brand-50 to-white px-4 pt-7 pb-4 lg:pt-14">
    <div class="mx-auto max-w-2xl">
      <p class="flex items-center gap-2 text-sm font-bold text-brand-800">${flag('ca', 'h-4 w-6')}به نظر می‌رسد در کانادا هستید</p>
      <h1 class="mt-3 text-[26px] font-black leading-[1.5] lg:text-4xl">پیدو به‌زودی در کانادا</h1>
      <p class="mt-2 text-base leading-8 text-neutral-700">پیدو بازار فارسی‌زبان خانه، کار، خدمات و رویدادها برای ایرانیان خارج از کشور است. شهر به شهر باز می‌کنیم تا از روز اول آگهی واقعی داشته باشد.</p>
    </div>
  </section>
  <section class="mx-auto max-w-2xl px-4">
    <div class="rounded-3xl border border-neutral-200 p-4 lg:p-6">
      <h2 class="text-lg font-extrabold">وقتی شهرتان باز شد خبرتان می‌کنیم</h2>
      <p class="mt-3 mb-1.5 text-sm font-bold">شهر</p>
      <div class="flex flex-wrap gap-2">${cities.map((c, i) => `<span class="flex h-10 items-center rounded-full border px-4 text-sm ${i === 0 ? 'border-2 border-brand-600 bg-brand-50 font-bold text-brand-800' : 'border-neutral-300'}">${c}</span>`).join('')}</div>
      <p class="mt-4 mb-1.5 text-sm font-bold">ایمیل</p>
      <span class="flex h-12 items-center rounded-xl border border-neutral-300 px-4 text-base text-neutral-500" dir="ltr">you@example.com</span>
      <label class="mt-3 flex items-start gap-2 text-sm leading-6"><span class="mt-1 flex size-5 shrink-0 items-center justify-center rounded bg-brand-700 text-white">${I('check', 'size-3.5', 3)}</span>می‌خواهم از نخستین آگهی‌دهنده‌ها باشم (کسب‌وکار یا شخص)</label>
      <a class="mt-4 flex h-12 items-center justify-center rounded-xl bg-brand-700 font-bold text-white">خبرم کن</a>
      <p class="mt-2 text-xs leading-6 text-neutral-600">اول یک ایمیل تأیید می‌فرستیم. فقط برای همین خبر؛ هر وقت بخواهید با یک کلیک لغو می‌شود. <a class="underline">حریم خصوصی</a></p>
    </div>
    <div class="mt-4 rounded-2xl bg-saffron-50 p-4"><p class="text-sm font-bold text-saffron-800">در تورنتو ${fa(312)} نفر منتظرند. با ${fa(500)} نفر باز می‌کنیم.</p><span class="mt-2 block h-2 overflow-hidden rounded-full bg-white"><i class="block h-full w-[62%] rounded-full bg-saffron-500"></i></span>
      <a class="mt-3 flex h-11 items-center justify-center gap-2 rounded-xl border border-saffron-300 bg-white text-sm font-bold text-neutral-900">${I('send', 'size-4 text-brand-700')}دعوت دوستان در تلگرام</a></div>
    <h2 class="mt-7 text-lg font-extrabold">تا آن موقع</h2>
    <ul class="mt-3 grid gap-2">${[['calendar', 'رویدادهای آنلاین', 'کلاس‌ها، شب‌های شعر و کارگاه‌هایی که از همه‌جا می‌شود رفت'], ['globe', 'پیدو در آلمان و اتریش', 'اگر برای کار یا مهاجرت به آنجا می‌روید']].map(([ic, t, s]) => `<li class="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3.5"><span class="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">${I(ic, 'size-5')}</span><span class="flex-1"><b class="block text-sm">${t}</b><span class="text-xs text-neutral-600">${s}</span></span>${I('chevronEnd', 'size-4 text-neutral-400')}</li>`).join('')}</ul>
  </section>
</main>${footer()}${bottomNav(0)}`);
