// "Me" as a hub, not a settings list: who you are, what you have on Peydoo (with counts), the
// business only when there is one, then one row into Settings (account, notifications, security
// and devices, privacy and data), help, and sign out.
const group = (title, rows) => `<section class="mt-6">${title ? `<h2 class="mb-2 px-1 text-sm font-bold text-neutral-600">${title}</h2>` : ''}<ul class="divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 bg-white">${rows.map(([ic, t, v, tone]) => `<li class="flex min-h-14 items-center gap-3 px-4"><span class="text-neutral-600">${I(ic, 'size-5')}</span><span class="flex-1 text-[15px]">${t}</span>${v ? `<span class="text-sm ${tone || 'text-neutral-600'}">${v}</span>` : ''}${I('chevronEnd', 'size-4 text-neutral-400')}</li>`).join('')}</ul></section>`;
const tiles = [['doc', 'آگهی‌های من', '۲ فعال، ۱ پیش‌نویس'], ['heart', 'نشان‌شده‌ها', '۵'], ['bell', 'جستجوهای ذخیره‌شده', '۱'], ['card', 'خریدها', '۳']];
mount(`${header()}
<main class="mx-auto w-full max-w-2xl px-4 pt-5 pb-24">
  <section class="flex items-center gap-4 rounded-2xl bg-brand-50 p-4"><span class="flex size-16 items-center justify-center rounded-full bg-white text-2xl font-black text-brand-800">آ</span>
    <div class="min-w-0 flex-1"><h1 class="text-xl font-extrabold">کاربر نمونه</h1><p class="text-sm text-neutral-700">عضو از مهر ۱۴۰۵، ودینگ، برلین</p><p class="mt-1 flex items-center gap-1 text-xs font-bold text-brand-800">${I('shield', 'size-3.5')}شماره تأیید شده</p></div>
    <a class="flex h-10 items-center rounded-lg bg-white px-3 text-sm font-bold text-brand-800">صفحهٔ من</a></section>
  <h2 class="mt-6 mb-2 px-1 text-sm font-bold text-neutral-600">فعالیت من</h2>
  <div class="grid grid-cols-2 gap-2">${tiles.map(([ic, t, v]) => `<a class="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-3.5"><span class="flex size-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">${I(ic, 'size-5')}</span><b class="text-[15px]">${t}</b><span class="text-xs text-neutral-600">${v}</span></a>`).join('')}</div>
  ${group('کسب‌وکار من', [['store', 'پنل کسب‌وکار', 'بدون اشتراک']])}
  ${group('', [['gear', 'تنظیمات', 'حساب، اعلان‌ها، امنیت، حریم خصوصی'], ['shield', 'راهنما و معاملهٔ امن'], ['chat', 'تماس با پشتیبانی']])}
  <a class="mt-6 flex h-12 items-center justify-center gap-2 rounded-xl border border-neutral-300 font-bold text-neutral-800">${I('logout', 'size-5')}خروج</a>
</main>${bottomNav(4)}`);
