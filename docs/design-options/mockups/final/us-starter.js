// The US in starter mode (from Chaharshanbe Suri, March 2027): events, verified businesses, jobs
// and online services from day one; rentals, items and cars open per city at its gate (LA needs a
// moderator in the Americas first). Prices in dollars, dates in the venue's time zone.
const cities = ['لس‌آنجلس', 'سن‌فرانسیسکو', 'واشنگتن', 'نیویورک', 'هیوستون'];
const events = [['سه‌شنبه', '۱۶ مارس', 'چهارشنبه‌سوری کنار ساحل', 'Santa Monica، رایگان'], ['شنبه', '۲۰ مارس', 'سفرهٔ هفت‌سین و شب شعر خانوادگی', 'Westwood، از ۲۰ $'], ['یکشنبه', '۲۸ مارس', 'کنسرت موسیقی سنتی', 'Irvine، از ۴۵ $']];
const biz = [['دندان', 'دندانپزشکی، Westwood', 'فارسی‌زبان، بیمهٔ Delta'], ['املاک', 'مشاور املاک', 'خرید و اجاره، Los Angeles'], ['وکیل', 'وکیل مهاجرت', 'فارسی‌زبان، مشاورهٔ آنلاین']];
const jobs = [['فروشنده در فروشگاه فرش', 'Beverly Hills، تمام‌وقت'], ['منشی مطب، فارسی و انگلیسی', 'Encino، پاره‌وقت']];
const gate = [[301, 1000], [7, 30], [0, 150]];
mount(`${header({ place: 'لس‌آنجلس', search: 'جستجو در لس‌آنجلس…' })}
<main class="mx-auto w-full max-w-5xl px-4 pb-24">
  <section class="pt-6 lg:pt-10">
    <p class="flex items-center gap-2 text-sm font-bold text-brand-800">${flag('us', 'h-4 w-6')}آمریکا</p>
    <h1 class="mt-2 text-[26px] font-black leading-[1.5] lg:text-4xl">پیدو در لس‌آنجلس</h1>
    <p class="mt-1 text-[15px] leading-8 text-neutral-700">رویدادها، کسب‌وکارهای فارسی‌زبان، کار و خدمات. اجاره و خرید و فروش هم به‌زودی.</p>
    <div class="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">${cities.map((c, i) => chip(c, { on: i === 0 })).join('')}</div>
  </section>
  <div class="lg:grid lg:grid-cols-[1fr_20rem] lg:gap-8">
    <div>
      <h2 class="mt-6 flex items-center justify-between text-lg font-extrabold">نوروز در لس‌آنجلس<a class="text-sm font-bold text-brand-800">همه</a></h2>
      <ul class="mt-3 space-y-2">${events.map(([d, n, t, s]) => `<li class="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3"><span class="flex w-14 shrink-0 flex-col items-center rounded-xl bg-saffron-50 py-1.5 text-saffron-800"><span class="text-xs">${d}</span><b class="text-sm">${n}</b></span><span class="min-w-0 flex-1"><b class="block text-sm leading-6">${t}</b><span class="text-xs text-neutral-600">${s}</span></span>${I('chevronEnd', 'size-4 text-neutral-400')}</li>`).join('')}</ul>
      <h2 class="mt-7 flex items-center justify-between text-lg font-extrabold">کسب‌وکارهای تأییدشده<a class="text-sm font-bold text-brand-800">همه</a></h2>
      <ul class="mt-3 grid gap-2 lg:grid-cols-3">${biz.map(([tile, t, s]) => `<li class="rounded-2xl border border-neutral-200 p-3"><div class="flex items-center gap-3"><span class="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-xs font-black text-brand-800">${tile}</span><span class="min-w-0 flex-1"><b class="block truncate text-sm">${t}</b><span class="text-xs text-neutral-600">${s}</span></span></div><p class="mt-2 flex items-center gap-1 text-xs font-bold text-brand-800">${I('verified', 'size-3.5')}تأییدشده</p></li>`).join('')}</ul>
      <h2 class="mt-7 text-lg font-extrabold">کار</h2>
      <ul class="mt-3 divide-y divide-neutral-200 rounded-2xl border border-neutral-200">${jobs.map(([t, s]) => `<li class="flex min-h-16 items-center gap-3 px-4"><span class="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">${I('briefcase', 'size-5')}</span><span class="flex-1"><b class="block text-sm">${t}</b><span class="text-xs text-neutral-600">${s}</span></span>${I('chevronEnd', 'size-4 text-neutral-400')}</li>`).join('')}</ul>
    </div>
    <aside>
      <div class="mt-6 rounded-2xl bg-saffron-50 p-4"><h2 class="font-extrabold">اجاره، خودرو و خرید و فروش</h2>
        <p class="mt-1 text-sm leading-7 text-neutral-700">در لس‌آنجلس وقتی باز می‌شود که این سه پر شود. آگهی‌تان را از حالا آماده کنید.</p>
        ${gate.map(([n, g], i) => `<p class="mt-2 flex justify-between text-xs text-saffron-800"><span>${['نفر', 'کسب‌وکار', 'آگهی آماده'][i]}: <b>${fa(n)}</b> از ${fa(g)}</span></p><span class="mt-1 block h-2 overflow-hidden rounded-full bg-white"><i class="block h-full rounded-full bg-saffron-500" style="width:${(n / g) * 100}%"></i></span>`).join('')}
        <a class="mt-3 flex h-11 items-center justify-center rounded-xl bg-brand-700 text-sm font-bold text-white">پیشگام لس‌آنجلس شوید</a></div>
      <div class="mt-3 rounded-2xl border border-brand-200 bg-brand-50 p-4"><h2 class="font-extrabold">کسب‌وکار دارید؟</h2>
        <p class="mt-1 text-sm leading-7 text-neutral-700">۵۰ کسب‌وکار اول لس‌آنجلس ۶ ماه پرو رایگان می‌گیرند؛ بدون کارت بانکی.</p>
        <a class="mt-3 flex h-11 items-center justify-center rounded-xl border border-brand-300 bg-white text-sm font-bold text-brand-800">ثبت کسب‌وکار</a></div>
    </aside>
  </div>
</main>${footer()}${bottomNav(0)}`);
