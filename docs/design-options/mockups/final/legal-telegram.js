// Legal pieces (Nov 6, 2026), item 5: art. 49 (1) (a) GDPR. Telegram is outside the EEA; nothing
// goes out through the bot before this «بله». Shown after a Telegram phone check and in the
// notification settings; withdrawn there with one tap (email takes over at once).
const sw = (on) => `<span class="inline-flex h-6 w-10 items-center rounded-full ${on ? 'bg-brand-700 justify-end' : 'bg-neutral-300 justify-start'} px-0.5"><i class="block size-5 rounded-full bg-white shadow"></i></span>`;
const ask = `<div class="rounded-2xl border-2 border-[#2aabee]/40 bg-sky-50 p-4">
  <p class="flex items-center gap-2 font-extrabold">${I('send', 'size-5 text-[#2aabee]')}اعلان‌ها را در تلگرام هم بفرستیم؟</p>
  <p class="mt-2 text-sm leading-7 text-neutral-800">پیام‌های تازه، جواب‌ها و خبر پرداخت‌ها را آن‌وقت در تلگرام هم می‌گیرید.</p>
  <ul class="mt-2 space-y-1 text-[13px] leading-6 text-neutral-700">
    <li class="flex gap-2">${I('globe', 'mt-1 size-4 shrink-0 text-neutral-500')}تلگرام (Telegram Messenger Inc.) داده‌ها را به کشورهایی مثل امارات و جزایر ویرجین بریتانیا هم می‌برد که اتحادیهٔ اروپا حفاظت داده‌شان را هم‌سطح اروپا نمی‌داند؛ ممکن است مقام‌های آن‌جا به داده‌ها دسترسی بگیرند و شما نتوانید حق‌تان را آن‌جا بگیرید.</li>
    <li class="flex gap-2">${I('doc', 'mt-1 size-4 shrink-0 text-neutral-500')}پیام‌های ربات رمزنگاری سرتاسری ندارند: متن اعلان (مثلاً عنوان آگهی و نام فرستنده) به تلگرام می‌رسد و تلگرام آن را طبق قوانین خودش نگه می‌دارد.</li>
    <li class="flex gap-2">${I('mail', 'mt-1 size-4 shrink-0 text-neutral-500')}نخواهید، همه‌چیز با ایمیل می‌آید. هر وقت بخواهید از «اعلان‌ها» پسش بگیرید.</li>
  </ul>
  <a class="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2aabee] font-bold text-white">${I('send', 'size-5')}بله، در تلگرام هم بفرستید</a>
  <a class="mt-2 flex h-11 w-full items-center justify-center text-sm font-bold text-brand-800">نه، فقط ایمیل</a>
  <p class="mt-1 text-center text-xs text-neutral-500"><a class="underline">بیشتر در حریم خصوصی، بخش ۸</a></p>
</div>`;
const on = `<div class="rounded-2xl border border-neutral-200 p-4 text-sm"><p class="flex items-center justify-between gap-3"><b class="flex items-center gap-2">${I('send', 'size-4 text-[#2aabee]')}اعلان در تلگرام</b>${sw(true)}</p>
  <p class="mt-1 text-xs leading-6 text-neutral-600">اجازه داده‌اید در ۶ نوامبر ۲۰۲۶. خاموشش کنید، از همین لحظه چیزی در تلگرام نمی‌فرستیم و ایمیل جایش را می‌گیرد.</p></div>`;
const rows = [['پیام تازه در گفت‌وگو', true, false], ['جواب به آگهی شما', true, false], ['آگهی تازه در جستجوی ذخیره‌شده', true, false]];
const table = (tgOk) => `<div class="mt-4 overflow-hidden rounded-2xl border border-neutral-200"><table class="w-full text-sm"><thead class="bg-neutral-50 text-xs text-neutral-600"><tr><th class="p-3 text-start"></th><th class="p-2">تلگرام</th><th class="p-2">ایمیل</th></tr></thead>
  <tbody class="divide-y divide-neutral-200">${rows.map(([t, a, b]) => `<tr><td class="p-3 text-[13px] leading-6">${t}</td><td class="p-2 text-center ${tgOk ? '' : 'opacity-40'}">${sw(tgOk && a)}</td><td class="p-2 text-center">${sw(!tgOk || b)}</td></tr>`).join('')}</tbody></table></div>`;
const view = window.VIEW || 'ask';
mount(`${appBar(view === 'ask' ? 'شماره تأیید شد' : 'اعلان‌ها')}
<main class="mx-auto w-full max-w-xl px-4 pt-5 pb-10">
  ${view === 'ask'
    ? `<div class="mb-4 flex items-center gap-3 rounded-2xl bg-brand-50 p-4 text-sm"><span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700">${I('verified', 'size-6')}</span><b class="text-brand-800">شماره‌تان با تلگرام تأیید شد.</b></div>${ask}`
    : view === 'settings-off' ? `${ask}${table(false)}` : `${on}${table(true)}`}
</main>`);
