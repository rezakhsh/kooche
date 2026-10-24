// First visit: say what the site is in one line, let people search at once, and ask for the city
// (Berlin first), not only the country. Honest counts; three short trust lines with links.
const cities = [['برلین', 648, true], ['هامبورگ', 96], ['کلن', 71], ['فرانکفورت', 64], ['مونیخ', 58], ['وین', 42, false, 'اتریش']];
mount(`${header()}
<main class="pb-24">
  <section class="bg-gradient-to-b from-brand-50 to-white px-4 pt-7 pb-6 lg:pt-14 lg:pb-10">
    <div class="mx-auto max-w-3xl">
      <h1 class="text-[28px] font-black leading-[1.45] lg:text-5xl lg:leading-[1.3]">هر چی بخوای، تو پیدو پیداست</h1>
      <p class="mt-2 text-base leading-8 text-neutral-700 lg:text-lg">خانه، کار، خدمات و خرید و فروش بین ایرانی‌های اروپا. ثبت آگهی رایگان است.</p>
      <div class="mt-5 flex h-14 items-center gap-2 rounded-2xl border border-neutral-300 bg-white px-4 text-base text-neutral-500 shadow-sm">${I('search', 'size-5 text-brand-700')}دنبال چی هستید؟ مثلاً «اتاق» یا «مترجم»</div>
    </div>
  </section>
  <section class="mx-auto max-w-3xl px-4">
    <h2 class="text-lg font-extrabold">کجا زندگی می‌کنید؟</h2>
    <p class="text-sm text-neutral-600">آگهی‌های شهر خودتان را اول می‌بینید. بعداً از بالای صفحه عوضش کنید.</p>
    <div class="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-3">${cities.map(([c, n, main, country]) => `<a class="flex items-center gap-3 rounded-2xl border ${main ? 'border-brand-300 bg-brand-50' : 'border-neutral-200'} p-3.5"><span class="flex h-5 w-7 shrink-0 flex-col overflow-hidden rounded-sm ring-1 ring-neutral-200">${country ? '<i class="flex-1 bg-red-600"></i><i class="flex-1 bg-white"></i><i class="flex-1 bg-red-600"></i>' : '<i class="flex-1 bg-black"></i><i class="flex-1 bg-red-600"></i><i class="flex-1 bg-yellow-400"></i>'}</span><span class="min-w-0"><b class="block text-[15px]">${c}</b><span class="text-xs text-neutral-600">${fa(n)} آگهی</span></span></a>`).join('')}</div>
    <a class="mt-3 flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-bold text-brand-800">${I('locate', 'size-4')}شهرم را پیدا کن</a>
    <h2 class="mt-7 text-lg font-extrabold">بیشتر چه می‌خواهند</h2>
    <div class="mt-3 grid grid-cols-4 gap-2 lg:grid-cols-8">${CATS.slice(0, 8).map((c) => `<a class="flex flex-col items-center gap-1.5 rounded-2xl p-2 text-center text-xs font-medium"><span class="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">${I(c.icon, 'size-6', 1.75)}</span>${c.short}</a>`).join('')}</div>
    <ul class="mt-7 grid gap-2 lg:grid-cols-3">${[['shield', 'شمارهٔ همهٔ آگهی‌دهنده‌ها تأیید شده', 'نکات ایمنی'], ['chat', 'بدون دادن شماره، در پیدو گفتگو کنید', 'چطور کار می‌کند'], ['plus', 'آگهی رایگان در چند دقیقه', 'ثبت آگهی']].map(([ic, t, l]) => `<li class="flex items-center gap-3 rounded-2xl bg-neutral-50 p-3.5"><span class="flex size-10 items-center justify-center rounded-xl bg-white text-brand-700">${I(ic, 'size-5')}</span><span class="flex-1 text-sm font-medium">${t}</span><a class="text-xs font-bold text-brand-800">${l}</a></li>`).join('')}</ul>
  </section>
</main>${bottomNav(0)}`);
