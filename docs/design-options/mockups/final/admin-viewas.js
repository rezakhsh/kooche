// Round 12, admin › users › "see the site as…": three tools, safest first.
// 1. View as a country: the site renders as for a visitor from that country (no account).
// 2. Test accounts: one per country, verified by staff, marked as test, never shown to the public
//    and never counted in city goals or statistics.
// 3. Sign in as a real user: owner only, with a reason, read-only by default, 30 minutes, logged.
const countries = [['de', 'آلمان', 'برلین'], ['ca', 'کانادا', 'تورنتو'], ['us', 'آمریکا', 'لس‌آنجلس'], ['au', 'استرالیا', 'سیدنی'], ['gb', 'بریتانیا', 'لندن'], ['at', 'اتریش', 'وین'], ['nl', 'هلند', 'آمستردام'], ['tr', 'ترکیه', 'استانبول']];
mount(adminShell('users', `
  <h1 class="text-xl font-extrabold">دیدن سایت از نگاه دیگران</h1>
  <div class="mt-4 grid gap-4 lg:grid-cols-2">
    <section class="rounded-2xl border border-neutral-200 bg-white p-4"><h2 class="flex items-center gap-2 font-extrabold">${I('globe', 'size-5 text-brand-700')}۱. نمایش به‌عنوان یک کشور</h2>
      <p class="mt-1 text-sm leading-7 text-neutral-700">صفحهٔ اول و هر صفحهٔ دیگر را همان‌طور ببینید که یک بازدیدکننده از آن کشور می‌بیند. بدون حساب، بدون ثبت چیزی.</p>
      <div class="mt-3 flex flex-wrap gap-2">${countries.map(([f, c]) => `<a class="flex h-10 items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 text-sm">${flag(f)}${c}</a>`).join('')}<a class="flex h-10 items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 text-sm">${I('globe', 'size-4')}ایران</a></div></section>
    <section class="rounded-2xl border border-neutral-200 bg-white p-4"><h2 class="flex items-center gap-2 font-extrabold">${I('shield', 'size-5 text-saffron-700')}۳. ورود به‌جای یک کاربر واقعی</h2>
      <p class="mt-1 text-sm leading-7 text-neutral-700">فقط برای شما (مالک)، با کد دومرحله‌ای تازه. دلیل لازم است. پیش‌فرض: فقط دیدن؛ فرستادن پیام، پرداخت و تغییر تنظیمات بسته است. ۳۰ دقیقه، و در «گزارش کارها» ثبت می‌شود.</p>
      <div class="mt-3 flex gap-2"><span class="flex h-11 flex-1 items-center rounded-xl border border-neutral-300 px-3 text-sm text-neutral-500">ایمیل یا شناسهٔ کاربر</span><a class="flex h-11 items-center rounded-xl bg-neutral-900 px-4 text-sm font-bold text-white">ادامه…</a></div></section>
  </div>
  <section class="mt-4 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
    <div class="p-4"><h2 class="flex items-center gap-2 font-extrabold">${I('user', 'size-5 text-brand-700')}۲. حساب‌های آزمایشی، یکی برای هر کشور</h2>
    <p class="mt-1 text-sm text-neutral-700">تأییدشده توسط شما، با برچسب «آزمایشی». آگهی‌هایشان فقط برای کارکنان دیده می‌شود و در هدف شهرها و آمار شمرده نمی‌شوند.</p></div>
    <table class="w-full min-w-[620px] text-sm"><thead class="bg-neutral-50 text-xs text-neutral-600"><tr><th class="p-3 text-start">کشور</th><th class="p-3 text-start">حساب</th><th class="p-3 text-start">شهر</th><th class="p-3 text-start">تأیید</th><th class="p-3 text-start"></th></tr></thead>
    <tbody>${countries.map(([f, c, city]) => `<tr class="border-t border-neutral-200"><td class="p-3"><span class="flex items-center gap-2">${flag(f)}${c}</span></td><td class="p-3" dir="ltr" style="text-align:end">test-${f}@peydoo.com</td><td class="p-3">${city}</td><td class="p-3"><span class="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-bold">آزمایشی، تأیید کارکنان</span></td><td class="p-3"><a class="inline-flex h-9 items-center rounded-lg border border-neutral-300 px-3 text-xs font-bold">ورود با این حساب</a></td></tr>`).join('')}
    <tr class="border-t border-neutral-200"><td class="p-3"><span class="flex items-center gap-2">${I('globe', 'size-4')}ایران</span></td><td class="p-3" dir="ltr" style="text-align:end">test-ir@peydoo.com</td><td class="p-3">—</td><td class="p-3"><span class="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-bold">فقط ایمیل، فقط پیام</span></td><td class="p-3"><a class="inline-flex h-9 items-center rounded-lg border border-neutral-300 px-3 text-xs font-bold">ورود با این حساب</a></td></tr></tbody></table>
  </section>`));
