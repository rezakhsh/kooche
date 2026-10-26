// Round 12, admin › countries and cities with the owner's rule: each waitlist city has one goal
// (businesses, editable); people waiting and listings prepared are shown for information only and
// never block an opening. The owner opens a city
// with one click when it's ready. A country opens everywhere when its chosen cities are open.
// The early-signup reward (one free bump for the first N people per city) is set here too.
const cities = [
  ['برلین', 'open', 41, 30, 1210, 648],
  ['هامبورگ', 'wait', 19, 20, 348, 27],
  ['فرانکفورت', 'wait', 8, 20, 211, 9],
  ['کلن و بن', 'wait', 5, 15, 164, 6],
  ['مونیخ', 'later', 3, 15, 120, 2],
];
const pill = { open: ['باز', 'bg-green-50 text-green-800'], wait: ['فهرست انتظار', 'bg-neutral-100 text-neutral-700'], later: ['بعد از باز شدن کشور', 'bg-neutral-50 text-neutral-500'] };
const row = ([c, st, b, g, ppl, ready]) => `<tr class="border-t border-neutral-200">
  <td class="p-3 font-bold">${c}</td><td class="p-3"><span class="rounded-full px-2 py-0.5 text-xs font-bold ${pill[st][1]}">${pill[st][0]}</span></td>
  <td class="p-3"><span class="flex items-center gap-2"><b>${fa(b)}</b><span class="text-neutral-500">از</span><span class="flex h-8 w-14 items-center justify-center rounded-lg border border-neutral-300 bg-white">${fa(g)}</span></span><span class="mt-1 block h-1.5 w-28 overflow-hidden rounded-full bg-neutral-100"><i class="block h-full rounded-full ${b >= g ? 'bg-green-600' : 'bg-brand-600'}" style="width:${Math.min(100, (b / g) * 100)}%"></i></span></td>
  <td class="p-3">${fa(ppl)}</td><td class="p-3">${fa(ready)}</td>
  <td class="p-3">${st === 'open' ? '<span class="text-xs text-neutral-600">از ۲۰ نوامبر</span>' : b >= g * 0.9 ? '<a class="inline-flex h-9 items-center rounded-lg bg-brand-700 px-3 text-xs font-bold text-white">باز کردن هامبورگ…</a>' : '<span class="text-xs text-neutral-500">—</span>'}</td></tr>`;
mount(adminShell('countries', `
  <div class="flex flex-wrap items-center gap-3"><h1 class="text-xl font-extrabold">کشورها و شهرها</h1>
    <div class="ms-auto flex gap-1 rounded-xl bg-white p-1 ring-1 ring-neutral-200">${['آلمان', 'کانادا', 'آمریکا', 'استرالیا', 'بریتانیا', 'اتریش'].map((c, i) => `<a class="rounded-lg px-3 py-1.5 text-sm ${i === 0 ? 'bg-brand-50 font-bold text-brand-800' : 'text-neutral-600'}">${c}</a>`).join('')}</div></div>
  <section class="mt-4 rounded-2xl border border-saffron-300 bg-saffron-50 p-4 text-sm"><b class="text-saffron-800">آمادهٔ تصمیم:</b> هامبورگ ${fa(19)} از ${fa(20)} کسب‌وکار دارد (۹۵٪). فقط تعداد کسب‌وکارها شرط است. با باز کردن، ۲۷ آگهی آماده منتشر می‌شود و خبرش را خودتان با ایمیل برای ۳۴۸ نفر منتظر می‌فرستید. هیچ شهری خودکار باز نمی‌شود.</section>
  <section class="mt-4 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
    <div class="flex items-center gap-2 p-4">${flag('de', 'h-5 w-7')}<h2 class="font-extrabold">آلمان</h2><span class="text-sm text-neutral-600">${fa(1)} از ${fa(4)} شهر کلیدی باز</span></div>
    <table class="w-full min-w-[640px] text-sm"><thead class="bg-neutral-50 text-xs text-neutral-600"><tr><th class="p-3 text-start">شهر</th><th class="p-3 text-start">وضعیت</th><th class="p-3 text-start">کسب‌وکار / هدف</th><th class="p-3 text-start">نفر منتظر (فقط برای اطلاع)</th><th class="p-3 text-start">آگهی آماده</th><th class="p-3 text-start"></th></tr></thead><tbody>${cities.map(row).join('')}</tbody></table>
  </section>
  <div class="mt-4 grid gap-4 lg:grid-cols-2">
    <section class="rounded-2xl border border-neutral-200 bg-white p-4"><h2 class="font-extrabold">قاعدهٔ باز شدن کل آلمان</h2>
      <p class="mt-2 text-sm leading-7 text-neutral-700">وقتی <span class="rounded-lg border border-neutral-300 px-2 font-bold">برلین، هامبورگ، فرانکفورت، کلن و بن</span> باز باشند، همهٔ شهرهای آلمان باز می‌شوند. (حدود ۵۵٪ ایرانیان آلمان)</p>
      <p class="mt-2 text-xs text-neutral-600">باز کردن کشور هم یک کلیک شماست، با پیش‌نمایش.</p></section>
    <section class="rounded-2xl border border-neutral-200 bg-white p-4"><h2 class="font-extrabold">پاداش ثبت‌نام زودهنگام</h2>
      <p class="mt-2 flex items-center gap-2 text-sm text-neutral-700">یک نردبان رایگان برای <span class="flex h-8 w-16 items-center justify-center rounded-lg border border-neutral-300 font-bold">${fa(100)}</span> نفر اول هر شهر</p>
      <p class="mt-2 text-xs leading-6 text-neutral-600">هامبورگ: ${fa(38)} نردبان رزرو شده. نردبان روز باز شدن شهر روی اولین آگهی هر نفر اعمال می‌شود. هزینه برای ما: صفر.</p></section>
  </div>`, { counts: { countries: 1 } }));
