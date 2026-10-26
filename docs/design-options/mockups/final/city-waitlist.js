// Round 12, the owner's strategy: Berlin is open; every other big city has a waitlist from day one.
// The city opens when enough businesses have joined (Hamburg: 20). Only businesses count; people
// can sign up without limit and are shown for information only.
// People get a small reward for joining early; businesses get the founding offer. Until the city
// opens, its people use Berlin, online services and online events.
const biz = 12, goal = 20, reward = 100, joined = 38;
const benefits = [['store', 'صفحهٔ کسب‌وکار، روز اول در صفحهٔ اول هامبورگ'], ['star', 'نشان «کسب‌وکار بنیان‌گذار» در سال اول'], ['sparkle', '۶ ماه پرو رایگان، بدون کارت بانکی']];
mount(`${header({ place: 'هامبورگ', search: 'جستجو در پیدو…' })}
<main class="pb-24">
  <section class="bg-gradient-to-b from-brand-50 to-white px-4 pt-6 pb-4 lg:pt-12">
    <div class="mx-auto max-w-2xl">
      <p class="flex items-center gap-2 text-sm font-bold text-brand-800">${flag('de', 'h-4 w-6')}هامبورگ، آلمان</p>
      <h1 class="mt-2 text-[26px] font-black leading-[1.5] lg:text-4xl">پیدو به‌زودی در هامبورگ</h1>
      <p class="mt-1 text-base leading-8 text-neutral-700">هامبورگ وقتی باز می‌شود که ${fa(goal)} کسب‌وکار ایرانی بپیوندند.</p>
      <div class="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
        <p class="flex items-baseline justify-between"><b class="text-lg">${fa(biz)} از ${fa(goal)} کسب‌وکار</b><span class="text-sm text-neutral-600">${fa(goal - biz)} کسب‌وکار دیگر</span></p>
        <span class="mt-2 block h-3 overflow-hidden rounded-full bg-neutral-100"><i class="block h-full rounded-full bg-brand-600" style="width:${(biz / goal) * 100}%"></i></span>
        <p class="mt-3 flex items-center gap-2 text-sm text-neutral-700">${I('people', 'size-4 text-brand-700')}${fa(348)} نفر از هامبورگ منتظرند</p>
      </div>
    </div>
  </section>
  <section class="mx-auto mt-2 max-w-2xl px-4 lg:grid lg:max-w-5xl lg:grid-cols-2 lg:items-start lg:gap-6">
    <div class="rounded-3xl border border-neutral-200 p-4 lg:p-6">
      <div class="flex items-center gap-3 rounded-2xl bg-saffron-50 p-3"><span class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-saffron-800">${I('sparkle', 'size-6')}</span>
        <span><b class="block text-sm">${fa(reward)} نفر اول هامبورگ: یک نردبان رایگان</b><span class="text-xs text-saffron-800">${fa(reward - joined)} جا مانده؛ روز باز شدن، اولین آگهی‌تان بالای فهرست می‌رود</span></span></div>
      <h2 class="mt-4 text-lg font-extrabold">خبرم کن</h2>
      <p class="mt-3 mb-1.5 text-sm font-bold">ایمیل</p>
      <span class="flex h-12 items-center rounded-xl border border-neutral-300 px-4 text-base text-neutral-500" dir="ltr">you@example.com</span>
      <p class="mt-4 mb-1.5 text-sm font-bold">شما</p>
      <div class="grid grid-cols-3 gap-1 rounded-xl bg-neutral-100 p-1 text-center text-sm">${['دنبال چیزی هستم', 'آگهی شخصی می‌دهم', 'کسب‌وکار دارم'].map((t, i) => `<span class="flex min-h-11 items-center justify-center rounded-lg px-1 leading-5 ${i === 1 ? 'bg-white font-bold shadow-sm' : 'text-neutral-700'}">${t}</span>`).join('')}</div>
      <a class="mt-4 flex h-12 items-center justify-center rounded-xl bg-brand-700 font-bold text-white">خبرم کن و نردبانم را نگه دار</a>
      <p class="mt-2 text-xs leading-6 text-neutral-600">یک ایمیل تأیید می‌فرستیم. فقط برای خبر باز شدن هامبورگ؛ با یک کلیک لغو می‌شود.</p>
    </div>
    <div>
      <div class="mt-4 rounded-3xl border-2 border-brand-200 bg-brand-50 p-4 lg:mt-0 lg:p-5">
        <p class="flex items-center gap-2 text-xs font-bold text-brand-800">${I('store', 'size-4')}کسب‌وکار دارید؟</p>
        <h2 class="mt-1 text-lg font-extrabold">از ${fa(goal)} کسب‌وکار بنیان‌گذار هامبورگ باشید</h2>
        <ul class="mt-3 space-y-2">${benefits.map(([ic, t]) => `<li class="flex items-center gap-2.5 text-sm">${I(ic, 'size-5 shrink-0 text-brand-700')}${t}</li>`).join('')}</ul>
        <a class="mt-4 flex h-12 items-center justify-center rounded-xl bg-brand-700 font-bold text-white">ثبت رایگان کسب‌وکار</a>
        <a class="mt-2 flex h-10 items-center justify-center text-sm font-bold text-brand-800">همهٔ مزایا و فرق آگهی شخصی و کسب‌وکار</a>
      </div>
      <div class="mt-4 rounded-2xl border border-neutral-200 p-4">
        <p class="flex items-center justify-between text-sm"><b>آلمان</b><span class="text-neutral-600">${fa(1)} از ${fa(4)} شهر باز</span></p>
        <p class="mt-1 text-xs leading-6 text-neutral-600">وقتی هامبورگ، فرانکفورت و کلن هم باز شوند، کل آلمان با همهٔ شهرها باز می‌شود.</p>
        <div class="mt-2 grid grid-cols-4 gap-1.5 text-center text-xs">${[['برلین', 'باز', 1], ['هامبورگ', '۱۲/۲۰', 0.6], ['فرانکفورت', '۸/۲۰', 0.4], ['کلن', '۵/۱۵', 0.33]].map(([c, s, p]) => `<span class="rounded-xl ${p === 1 ? 'bg-brand-700 text-white' : 'bg-neutral-100 text-neutral-700'} px-1 py-2"><b class="block">${c}</b>${s}</span>`).join('')}</div>
      </div>
    </div>
  </section>
  <section class="mx-auto max-w-2xl px-4 lg:max-w-5xl">
    <h2 class="mt-7 text-lg font-extrabold">تا آن موقع</h2>
    <ul class="mt-3 grid gap-2 lg:grid-cols-3">${[['pin', 'پیدو در برلین', '۶۴۸ آگهی، رویدادها و کسب‌وکارها'], ['calendar', 'رویدادهای آنلاین', 'کلاس‌ها و شب‌های شعر از همه‌جا'], ['wrench', 'خدمات آنلاین', 'ترجمه، مشاوره و طراحی، برای همهٔ آلمان']].map(([ic, t, s]) => `<li class="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3.5"><span class="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">${I(ic, 'size-5')}</span><span class="flex-1"><b class="block text-sm">${t}</b><span class="text-xs text-neutral-600">${s}</span></span>${I('chevronEnd', 'size-4 text-neutral-400')}</li>`).join('')}</ul>
  </section>
</main>${footer()}${bottomNav(0)}`);
