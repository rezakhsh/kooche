// First visit from a country that is not open yet (here Austria, on the waitlist while Germany
// opens): say so honestly, collect the city and an email (double opt-in), show the opening gate
// with real confirmed counts, what pioneers get, and let them prepare opening-day listings.
const cities = ['وین', 'گراتس', 'لینتس', 'زالتسبورگ', 'اینسبروک', 'شهر دیگر'];
const bar = (label, n, goal, tone) => `<p class="mt-3 flex justify-between text-xs text-saffron-800"><span>${label}: <b>${fa(n)}</b> از ${fa(goal)}</span><span>${fa(Math.round((n / goal) * 100))}٪</span></p><span class="mt-1 block h-2 overflow-hidden rounded-full bg-white"><i class="block h-full rounded-full ${tone}" style="width:${(n / goal) * 100}%"></i></span>`;
const perks = [
  ['star', 'نشان «پیشگام وین، ۲۰۲۶»', 'روی صفحهٔ شما، با تاریخ؛ جدا از نشان «تأییدشده»'],
  ['clock', '۴۸ ساعت زودتر از همه', 'پیش از باز شدن عمومی وارد می‌شوید'],
  ['doc', 'تا ۳ آگهی روز افتتاح', 'از حالا آماده کنید؛ روز اول با ۳ نردبان رایگان منتشر می‌شوند'],
  ['people', 'با ۳ دوست، ۳ نردبان دیگر', 'با پیوند خودتان در تلگرام یا واتس‌اپ دعوت کنید'],
  ['store', 'کسب‌وکارها: ۶ ماه پرو رایگان', `${fa(20)} جای بنیان‌گذار در وین؛ پرو ۲۴ € در ماه است`],
];
mount(`${header({ place: 'اتریش', search: 'جستجو در پیدو…' })}
<main>
  <section class="bg-gradient-to-b from-brand-50 to-white px-4 pt-7 pb-4 lg:pt-14">
    <div class="mx-auto max-w-2xl">
      <p class="flex items-center gap-2 text-sm font-bold text-brand-800">${flag('at', 'h-4 w-6')}به نظر می‌رسد در اتریش هستید</p>
      <h1 class="mt-3 text-[26px] font-black leading-[1.5] lg:text-4xl">پیدو به‌زودی در اتریش</h1>
      <p class="mt-2 text-base leading-8 text-neutral-700">پیدو بازار فارسی‌زبان خانه، کار، خدمات و رویدادها برای ایرانیان خارج از کشور است. هر شهر وقتی باز می‌شود که از روز اول آگهی واقعی داشته باشد.</p>
    </div>
  </section>
  <section class="mx-auto max-w-2xl px-4 lg:grid lg:max-w-5xl lg:grid-cols-2 lg:items-start lg:gap-6">
    <div class="rounded-3xl border border-neutral-200 p-4 lg:p-6">
      <h2 class="text-lg font-extrabold">پیشگام شهرتان شوید</h2>
      <p class="mt-3 mb-1.5 text-sm font-bold">شهر</p>
      <div class="flex flex-wrap gap-2">${cities.map((c, i) => `<span class="flex h-10 items-center rounded-full border px-4 text-sm ${i === 0 ? 'border-2 border-brand-600 bg-brand-50 font-bold text-brand-800' : 'border-neutral-300'}">${c}</span>`).join('')}</div>
      <p class="mt-4 mb-1.5 text-sm font-bold">ایمیل</p>
      <span class="flex h-12 items-center rounded-xl border border-neutral-300 px-4 text-base text-neutral-500" dir="ltr">you@example.com</span>
      <p class="mt-4 mb-1.5 text-sm font-bold">شما</p>
      <div class="grid grid-cols-3 gap-1 rounded-xl bg-neutral-100 p-1 text-center text-sm">${['دنبال چیزی هستم', 'آگهی شخصی می‌دهم', 'کسب‌وکار دارم'].map((t, i) => `<span class="flex min-h-11 items-center justify-center rounded-lg px-1 leading-5 ${i === 1 ? 'bg-white font-bold shadow-sm' : 'text-neutral-700'}">${t}</span>`).join('')}</div>
      <a class="mt-4 flex h-12 items-center justify-center rounded-xl bg-brand-700 font-bold text-white">خبرم کن</a>
      <p class="mt-2 text-xs leading-6 text-neutral-600">اول یک ایمیل تأیید می‌فرستیم. فقط برای خبر باز شدن و آماده کردن آگهی‌هایتان؛ هر وقت بخواهید با یک کلیک لغو می‌شود. <a class="underline">شرایط پیشگام‌ها</a>، <a class="underline">حریم خصوصی</a></p>
    </div>
    <div>
      <div class="mt-4 rounded-2xl bg-saffron-50 p-4 lg:mt-0"><p class="text-sm font-bold text-saffron-800">وین وقتی باز می‌شود که این سه پر شود</p>
        ${bar('نفر', 168, 300, 'bg-saffron-500')}${bar('کسب‌وکار تأییدشده', 5, 15, 'bg-brand-600')}${bar('آگهی آماده برای روز اول', 21, 60, 'bg-brand-600')}
        <p class="mt-3 text-xs leading-6 text-saffron-800">فقط ثبت‌نام‌های تأییدشده شمرده می‌شوند. وقتی هر سه به ۷۵٪ برسد، تاریخ افتتاح را اعلام می‌کنیم؛ یا زودتر، اگر برلین آماده شود.</p>
        <a class="mt-3 flex h-11 items-center justify-center gap-2 rounded-xl border border-saffron-300 bg-white text-sm font-bold text-neutral-900">${I('send', 'size-4 text-brand-700')}دعوت دوستان در تلگرام</a></div>
      <h2 class="mt-6 text-lg font-extrabold">پیشگام‌ها چه می‌گیرند</h2>
      <ul class="mt-3 space-y-2">${perks.map(([ic, t, s]) => `<li class="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3"><span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">${I(ic, 'size-5')}</span><span><b class="block text-sm">${t}</b><span class="text-xs leading-6 text-neutral-600">${s}</span></span></li>`).join('')}</ul>
    </div>
  </section>
  <section class="mx-auto max-w-2xl px-4 lg:max-w-5xl">
    <h2 class="mt-7 text-lg font-extrabold">تا آن موقع</h2>
    <ul class="mt-3 grid gap-2 lg:grid-cols-2">${[['calendar', 'رویدادهای آنلاین', 'کلاس‌ها، شب‌های شعر و کارگاه‌هایی که از همه‌جا می‌شود رفت'], ['globe', 'پیدو در آلمان', 'اگر برای کار یا مهاجرت به آلمان می‌روید']].map(([ic, t, s]) => `<li class="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3.5"><span class="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">${I(ic, 'size-5')}</span><span class="flex-1"><b class="block text-sm">${t}</b><span class="text-xs text-neutral-600">${s}</span></span>${I('chevronEnd', 'size-4 text-neutral-400')}</li>`).join('')}</ul>
  </section>
</main>${footer()}${bottomNav(0)}`);
