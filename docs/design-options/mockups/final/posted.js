// After publishing: what happens next, share to Telegram and WhatsApp (where Iranians in Berlin
// already are), copy the link, and only then the paid boost
mount(`${appBar('آگهی ثبت شد', { lead: 'close' })}
<main class="mx-auto w-full max-w-xl px-4 pt-8 pb-10 text-center">
  <span class="mx-auto flex size-16 items-center justify-center rounded-full bg-brand-50 text-brand-700">${I('check', 'size-9', 2.5)}</span>
  <h1 class="mt-4 text-2xl font-extrabold">آگهی شما منتشر شد</h1>
  <p class="mt-1 text-base text-neutral-700">از همین حالا در برلین دیده می‌شود. پیام‌ها را در «پیام‌ها» می‌بینید.</p>
  <div class="mt-6 flex gap-3 rounded-2xl border border-neutral-200 p-3 text-start"><img src="../img/room5.webp" class="aspect-[4/3] w-28 rounded-xl object-cover" alt=""><div class="min-w-0"><p class="text-sm font-bold leading-6">اتاق مبله در WG، نزدیک Hermannplatz</p><p class="font-extrabold text-brand-800">۵۹۰ €</p><p class="text-xs text-neutral-600">کد آگهی ${faDigits(482193705)}</p></div></div>
  <h2 class="mt-7 text-start text-base font-extrabold">به دیگران بگویید</h2>
  <div class="mt-3 grid grid-cols-3 gap-2">${[['send', 'تلگرام'], ['chat', 'واتس‌اپ'], ['share', 'کپی پیوند']].map(([ic, t]) => `<a class="flex h-16 flex-col items-center justify-center gap-1 rounded-2xl border border-neutral-200 text-sm font-bold">${I(ic, 'size-5 text-brand-700')}${t}</a>`).join('')}</div>
  <a class="mt-7 flex items-center gap-3 rounded-2xl bg-saffron-50 p-4 text-start"><span class="flex size-10 items-center justify-center rounded-xl bg-saffron-500 text-neutral-900">${I('arrow-up', 'size-5')}</span><span class="flex-1"><b class="block">ارتقای آگهی</b><span class="text-sm text-saffron-800">بالای فهرست از ۱٫۹۹ €، ویژه یک هفته ۶٫۹۹ €</span></span>${I('chevronEnd', 'size-5 text-saffron-800')}</a>
  <div class="mt-6 grid grid-cols-2 gap-2"><a class="flex h-12 items-center justify-center rounded-xl border border-neutral-300 font-bold">دیدن آگهی</a><a class="flex h-12 items-center justify-center rounded-xl border border-neutral-300 font-bold">آگهی دیگر</a></div>
</main>`);
