// Round 12: phone check without SMS. Asked only when someone first posts or messages, with the
// reason first. Telegram login (tested on 25 Oct) is the main way; WhatsApp (the user sends us a
// code) the second; a limited account if neither works.
mount(`${appBar('یک بار شماره‌تان را تأیید کنید')}
<main class="mx-auto w-full max-w-xl px-4 pt-6 pb-10">
  <div class="flex items-start gap-3 rounded-2xl bg-brand-50 p-4"><span class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700">${I('shield', 'size-6')}</span>
    <p class="text-sm leading-7 text-neutral-800"><b class="block text-brand-900">برای جلوگیری از کلاهبرداری</b>فقط یک بار، پیش از اولین آگهی یا پیام. شماره‌تان به هیچ‌کس نشان داده نمی‌شود.</p></div>
  <a class="mt-5 flex h-14 items-center justify-center gap-2 rounded-xl bg-[#2aabee] text-base font-bold text-white">${I('send', 'size-5')}تأیید با تلگرام</a>
  <p class="mt-1.5 text-center text-xs text-neutral-600">تلگرام باز می‌شود؛ «اجازه» را بزنید و خودکار برمی‌گردید.</p>
  <a class="mt-4 flex h-14 items-center justify-center gap-2 rounded-xl bg-[#25d366] text-base font-bold text-white">${I('chat', 'size-5')}تأیید با واتس‌اپ</a>
  <p class="mt-1.5 text-center text-xs text-neutral-600">واتس‌اپ با یک پیام آماده باز می‌شود؛ فقط «فرستادن» را بزنید.</p>
  <div class="mt-6 rounded-2xl border border-neutral-200 p-4 text-sm leading-7 text-neutral-700"><b class="block text-neutral-900">تلگرام و واتس‌اپ‌تان روی شمارهٔ ایران است؟</b>در تلگرام «افزودن حساب» یا در واتس‌اپ «حساب دوم» با شمارهٔ کشوری که در آن زندگی می‌کنید بسازید. کد را خود تلگرام یا واتس‌اپ می‌فرستد.</div>
  <a class="mt-3 flex h-11 items-center justify-center text-sm font-bold text-brand-800">هیچ‌کدام را ندارم</a>
</main>`);
