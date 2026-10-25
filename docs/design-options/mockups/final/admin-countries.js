// Admin › countries and cities (late January 2027 in this example): what needs a decision first
// (a city ready for its date, the capacity check that pauses new openings only), then each
// country's mode and own health, its cities' three goals (the lowest one is the progress), and the
// category switches of the selected country.
// Announcing, opening and pausing are the owner's clicks, never automatic.
const MODE = { open: ['باز', 'bg-green-50 text-green-800'], starter: ['رویداد، کسب‌وکار، کار', 'bg-brand-50 text-brand-800'], wait: ['فهرست انتظار', 'bg-neutral-100 text-neutral-700'], guide: ['راهنما', 'bg-saffron-50 text-saffron-800'], hidden: ['پنهان', 'bg-neutral-100 text-neutral-600'] };
const pct = (a) => Math.min(...a.map(([n, g]) => Math.round((n / g) * 100)));
const countries = [
  ['de', 'آلمان', 'open', [['برلین', 'باز؛ سالم: ۱۱۲ آگهی فعال، ۵۴٪ با گفتگو، ۳۴ آگهی‌دهندهٔ هفتگی', null], ['هامبورگ', 'فهرست انتظار', [[402, 500], [14, 20], [61, 100]]]]],
  ['at', 'اتریش', 'starter', [['وین', 'آمادهٔ اعلام تاریخ', [[251, 300], [13, 15], [47, 60]]]]],
  ['nl', 'هلند', 'starter', [['آمستردام و راندستاد', 'فهرست انتظار', [[214, 500], [9, 20], [18, 100]]]]],
  ['ca', 'کانادا', 'starter', [['تورنتو', 'فهرست انتظار، هدف: اوایل مه', [[488, 1000], [19, 30], [37, 150]]]]],
  ['au', 'استرالیا', 'starter', [['سیدنی', 'فهرست انتظار، هدف: جولای', [[212, 500], [8, 20], [9, 100]]]]],
  ['us', 'آمریکا', 'wait', [['لس‌آنجلس', 'شروع: ۲ فوریه، چک‌لیست ۵ از ۶', [[341, 1000], [9, 30], [0, 150]]]]],
  ['tr', 'ترکیه', 'guide', [['استانبول', 'رویداد و کسب‌وکار: نظر وکیل لازم', null]]],
];
const bars = (g) => `<div class="mt-1.5 grid grid-cols-3 gap-2">${g.map(([n, goal], i) => `<span><span class="flex justify-between text-xs text-neutral-600"><span>${['نفر', 'کسب‌وکار', 'آگهی آماده'][i]}</span><b>${fa(n)}/${fa(goal)}</b></span><span class="mt-0.5 block h-1.5 overflow-hidden rounded-full bg-neutral-100"><i class="block h-full rounded-full ${n / goal >= 0.75 ? 'bg-brand-600' : 'bg-saffron-500'}" style="width:${Math.min(100, (n / goal) * 100)}%"></i></span></span>`).join('')}</div>`;
const cats = [['خانه و اتاق', 'wait'], ['خودرو', 'wait'], ['خرید و فروش', 'wait'], ['کار', 'on'], ['خدمات', 'on'], ['رویدادها', 'on'], ['کسب‌وکارها', 'on'], ['آنلاین از همه‌جا', 'on']];
const body = `
  <div class="flex flex-wrap items-center justify-between gap-2"><h1 class="text-2xl font-extrabold">کشورها و شهرها</h1><span class="text-sm text-neutral-600">پیشرفت هر شهر = کمترین درصد از سه هدف</span></div>
  <section class="mt-4 grid gap-2 lg:grid-cols-2">
    <div class="flex items-center gap-3 rounded-2xl border border-brand-300 bg-brand-50 p-3.5"><span class="flex size-10 items-center justify-center rounded-xl bg-white text-brand-700">${I('calendar', 'size-5')}</span><span class="min-w-0 flex-1"><b class="block text-sm">وین به ۷۸٪ رسید</b><span class="text-xs text-neutral-700">پیشنهاد: شنبه ۲۰ مارس (شب عید)، پیشگام‌ها ۱۸ مارس</span></span><a class="flex h-10 items-center rounded-xl bg-brand-700 px-3 text-sm font-bold text-white">اعلام تاریخ</a></div>
    <div class="flex items-center gap-3 rounded-2xl border border-saffron-100 bg-saffron-50 p-3.5"><span class="flex size-10 items-center justify-center rounded-xl bg-white text-saffron-800">${I('alert', 'size-5')}</span><span class="min-w-0 flex-1"><b class="block text-sm">ظرفیت: آمریکا ۲ فوریه شروع می‌شود</b><span class="text-xs text-neutral-700">صف بررسی در اروپا ۶ ساعت، در آمریکا ۹ ساعت؛ ناظر تورنتو ۸ ساعت در هفته</span></span>${I('chevronEnd', 'size-4 text-neutral-500')}</div>
  </section>
  <div class="mt-4 lg:grid lg:grid-cols-[1fr_19rem] lg:gap-4">
    <ul class="space-y-2">${countries.map(([f, n, m, cities], ci) => `<li class="rounded-2xl border ${ci === 1 ? 'border-brand-300 ring-2 ring-brand-100' : 'border-neutral-200'} bg-white p-3.5">
      <div class="flex items-center gap-2.5">${flag(f, 'h-4 w-6')}<b class="text-[15px]">${n}</b><span class="rounded-full px-2.5 text-xs font-bold leading-6 ${MODE[m][1]}">${MODE[m][0]}</span>${I('chevronEnd', 'ms-auto size-4 text-neutral-400')}</div>
      ${cities.map(([c, s, g]) => `<div class="mt-3 border-t border-neutral-200 pt-2.5"><p class="flex items-center justify-between text-sm"><b>${c}</b><span class="text-xs ${s.startsWith('آمادهٔ') ? 'font-bold text-brand-800' : 'text-neutral-600'}">${g ? `${fa(pct(g))}٪، ` : ''}${s}</span></p>${g ? bars(g) : ''}</div>`).join('')}</li>`).join('')}
      <li class="flex items-center gap-2.5 rounded-2xl border border-dashed border-neutral-300 p-3.5 text-sm text-neutral-600">${I('globe', 'size-4')}بریتانیا (فوریه)، ایتالیا و سوئد (آوریل)، فرانسه (مه): فهرست انتظار؛ کشورهای دیگر: فرم «کشور من»</li></ul>
    <aside class="mt-4 lg:mt-0"><div class="rounded-2xl border border-neutral-200 bg-white p-4 lg:sticky lg:top-20"><h2 class="flex items-center gap-2 font-extrabold">${flag('at', 'h-3.5 w-5')}اتریش: دسته‌ها</h2><p class="text-xs text-neutral-600">در حالت «رویداد، کسب‌وکار، کار»</p>
      <ul class="mt-3 divide-y divide-neutral-200">${cats.map(([t, s]) => `<li class="flex min-h-11 items-center justify-between text-sm"><span>${t}</span><span class="flex items-center gap-2 text-xs ${s === 'on' ? 'font-bold text-green-800' : 'text-neutral-600'}">${s === 'on' ? 'باز' : 'تا افتتاح وین'}<span class="relative h-6 w-10 rounded-full ${s === 'on' ? 'bg-brand-600' : 'bg-neutral-300'}"><i class="absolute top-0.5 size-5 rounded-full bg-white shadow ${s === 'on' ? 'start-0.5' : 'end-0.5'}"></i></span></span></li>`).join('')}</ul>
      <p class="mt-3 text-xs leading-6 text-neutral-600">بررسی آگهی‌ها در ساعت محلی: کمتر از ۱۲ ساعت در ۴ هفتهٔ اخیر ${I('check', 'inline size-3.5 text-green-800')}</p></div></aside>
  </div>`;
mount(adminShell('countries', body, { counts: { queue: '۳' } }));
