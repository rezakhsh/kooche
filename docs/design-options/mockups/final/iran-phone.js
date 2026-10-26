// Phone check, when the number shared through Telegram or WhatsApp starts with +98 (round 12: no
// SMS, and the reason never says "sanctions"). People abroad add their local number as a second
// Telegram or WhatsApp account; nothing costs us anything.
mount(`${appBar('تأیید شماره')}
<main class="mx-auto w-full max-w-xl px-4 pt-6 pb-10">
  <div class="rounded-2xl border border-neutral-200 p-4">
    <p class="flex items-center gap-2 text-sm text-neutral-600">${I('send', 'size-4 text-brand-700')}شماره‌ای که در تلگرام فرستادید</p>
    <p class="mt-2 text-lg font-extrabold" dir="ltr" style="text-align:end">+98 912 ••• ••••</p>
  </div>
  <section class="mt-4 rounded-2xl bg-saffron-50 p-4">
    <h1 class="flex items-center gap-2 text-base font-extrabold text-saffron-800">${I('ban', 'size-5')}شمارهٔ ایران پذیرفته نمی‌شود</h1>
    <p class="mt-2 text-sm leading-7 text-neutral-800">برای ثبت آگهی و پیام دادن در پیدو، شمارهٔ کشوری لازم است که در آن زندگی می‌کنید. شماره‌های ایران <bdi dir="ltr">(+98)</bdi> را نمی‌پذیریم، حتی برای ایرانیانی که خارج از کشورند: پیدو در ایران دفتر ندارد و نمی‌تواند امنیت معامله را با این شماره‌ها تضمین کند.</p>
  </section>
  <h2 class="mt-6 text-base font-extrabold">چه کار می‌توانید بکنید</h2>
  <ul class="mt-3 space-y-2">${[['phone', 'شمارهٔ کشوری که در آن زندگی می‌کنید؟', 'در تلگرام «افزودن حساب» یا در واتس‌اپ «حساب دوم» با شمارهٔ محلی بسازید؛ کد را خود تلگرام یا واتس‌اپ می‌فرستد'], ['heart', 'بدون شماره هم می‌شود', 'آگهی‌ها را ببینید، نشان کنید و جستجو ذخیره کنید'], ['chat', 'فکر می‌کنید اشتباه شده؟', 'به پشتیبانی بنویسید']].map(([ic, t, s]) => `<li class="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3.5"><span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">${I(ic, 'size-5')}</span><span class="flex-1"><b class="block text-sm">${t}</b><span class="text-xs leading-6 text-neutral-600">${s}</span></span>${I('chevronEnd', 'size-4 text-neutral-400')}</li>`).join('')}</ul>
  <a class="mt-6 flex h-12 items-center justify-center rounded-xl bg-brand-700 font-bold text-white">ورود با تلگرام با شمارهٔ دیگر</a>
  <a class="mt-2 flex h-12 items-center justify-center rounded-xl border border-neutral-300 font-bold text-neutral-800">تأیید با واتس‌اپ</a>
</main>`);
