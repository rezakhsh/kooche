// First visit from Germany (Cloudflare's country header says DE): one line on what Peydoo is,
// search at once, the cities of the detected country with honest counts, a quiet way to another
// country, categories, three trust lines, and the footer with the legal links.
const cities = [['برلین', 648, true], ['هامبورگ', 96], ['کلن', 71], ['فرانکفورت', 64], ['مونیخ', 58], ['دوسلدورف', 37]];
mount(`${header({ place: 'آلمان', search: 'جستجو در آلمان…' })}
<main>
  <section class="bg-gradient-to-b from-brand-50 to-white px-4 pt-7 pb-6 lg:pt-14 lg:pb-10">
    <div class="mx-auto max-w-3xl">
      <h1 class="text-[28px] font-black leading-[1.45] lg:text-5xl lg:leading-[1.3]">هر چی بخوای، تو پیدو پیداست</h1>
      <p class="mt-2 text-base leading-8 text-neutral-700 lg:text-lg">خانه، کار، خدمات، رویدادها و خرید و فروش بین ایرانی‌های خارج از کشور، به فارسی. ثبت آگهی رایگان است.</p>
      <div class="mt-5 flex h-14 items-center gap-2 rounded-2xl border border-neutral-300 bg-white px-4 text-base text-neutral-500 shadow-sm">${I('search', 'size-5 text-brand-700')}دنبال چی هستید؟ مثلاً «اتاق» یا «مترجم»</div>
    </div>
  </section>
  <section class="mx-auto max-w-3xl px-4">
    <div class="flex items-end justify-between gap-3"><div><h2 class="text-lg font-extrabold">شهرتان را انتخاب کنید</h2><p class="flex items-center gap-1.5 text-sm text-neutral-600">${flag('de', 'h-3.5 w-5')}به نظر می‌رسد در آلمان هستید</p></div><a class="flex h-10 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-bold text-brand-800">${I('globe', 'size-4')}کشور دیگر</a></div>
    <div class="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-3">${cities.map(([c, n, main]) => `<a class="flex items-center justify-between rounded-2xl border ${main ? 'border-brand-300 bg-brand-50' : 'border-neutral-200'} p-3.5"><b class="text-[15px]">${c}</b><span class="text-xs text-neutral-600">${fa(n)} آگهی</span></a>`).join('')}</div>
    <div class="mt-2 grid grid-cols-2 gap-2.5"><a class="flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-bold text-brand-800">${I('locate', 'size-4')}نزدیک‌ترین شهر</a><a class="flex h-11 items-center justify-center rounded-xl text-sm font-bold text-neutral-700">همه آلمان</a></div>
    <h2 class="mt-7 text-lg font-extrabold">بیشتر چه می‌خواهند</h2>
    <div class="mt-3 grid grid-cols-4 gap-2 lg:grid-cols-8">${CATS.slice(0, 7).map((c) => `<a class="flex flex-col items-center gap-1.5 rounded-2xl p-2 text-center text-xs font-medium"><span class="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">${I(c.icon, 'size-6', 1.75)}</span>${c.short}</a>`).join('')}<a class="flex flex-col items-center gap-1.5 rounded-2xl p-2 text-center text-xs font-medium"><span class="flex size-12 items-center justify-center rounded-2xl bg-saffron-100 text-saffron-800">${I('calendar', 'size-6', 1.75)}</span>رویدادها</a></div>
    <ul class="mt-7 grid gap-2 lg:grid-cols-3">${[['shield', 'شمارهٔ همهٔ آگهی‌دهنده‌ها تأیید شده', 'معاملهٔ امن'], ['chat', 'بدون دادن شماره، در پیدو گفتگو کنید', 'چطور کار می‌کند'], ['plus', 'آگهی رایگان در چند دقیقه', 'ثبت آگهی']].map(([ic, t, l]) => `<li class="flex items-center gap-3 rounded-2xl bg-neutral-50 p-3.5"><span class="flex size-10 items-center justify-center rounded-xl bg-white text-brand-700">${I(ic, 'size-5')}</span><span class="flex-1 text-sm font-medium">${t}</span><a class="text-xs font-bold text-brand-800">${l}</a></li>`).join('')}</ul>
    <a class="mt-3 flex items-center gap-3 rounded-2xl border border-saffron-100 p-3.5"><span class="flex size-10 items-center justify-center rounded-xl bg-saffron-100 text-saffron-800">${I('store', 'size-5')}</span><span class="flex-1 text-sm leading-6"><b>کسب‌وکار دارید؟</b> ۵۰ کسب‌وکار اول برلین ۶ ماه پرو رایگان می‌گیرند. <span class="text-saffron-800">${fa(31)} جا مانده</span></span>${I('chevronEnd', 'size-4 text-neutral-400')}</a>
  </section>
</main>${footer()}${bottomNav(0)}`);
