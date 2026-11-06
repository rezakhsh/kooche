// Legal pieces (Nov 6, 2026), item 6: terms 12(4). After a change that worsens users' position,
// the next sign-in (and the next signed-in page) shows this before anything else. Silence is not
// consent: without «موافقم» the old terms go on applying.
const li = (t) => `<li class="flex gap-2">${I('chevronEnd', 'mt-1.5 size-3.5 shrink-0 text-brand-700')}<span>${t}</span></li>`;
mount(`${appBar('شرایط استفادهٔ تازه', { lead: 'close' })}
<main class="mx-auto w-full max-w-xl px-4 pt-6 pb-10">
  <div class="flex items-start gap-3 rounded-2xl bg-brand-50 p-4"><span class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700">${I('doc', 'size-6')}</span>
    <p class="text-sm leading-7 text-neutral-800"><b class="block text-brand-800">شرایط استفادهٔ پیدو از ۱ فوریهٔ ۲۰۲۷ تغییر می‌کند</b>بعضی از این تغییرها برای شما محدودیت تازه دارد؛ برای همین بدون موافقت شما اجرا نمی‌شود.</p></div>
  <h2 class="mt-5 text-sm font-extrabold">چه چیزی تغییر می‌کند</h2>
  <ul class="mt-2 space-y-2 text-sm leading-7 text-neutral-800">
    ${li('آگهی‌های خودرو فقط با شمارهٔ شاسی منتشر می‌شوند.')}
    ${li('نردبان‌های رایگان پرو بعد از ۳۰ روز تمام می‌شوند و به ماه بعد نمی‌روند.')}
  </ul>
  <p class="mt-3 text-sm"><a class="font-bold text-brand-800 underline">متن کامل شرایط تازه</a> · <a class="font-bold text-brand-800 underline"><bdi>Deutsch (verbindlich)</bdi></a></p>
  <a class="mt-6 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-700 font-bold text-white">موافقم <bdi class="ms-1 text-sm font-medium opacity-90">(Ich stimme zu)</bdi></a>
  <a class="mt-3 flex h-12 w-full items-center justify-center rounded-xl border border-neutral-300 font-bold">فعلاً نه</a>
  <p class="mt-3 text-xs leading-6 text-neutral-600">با «فعلاً نه» حساب‌تان با همان شرایط قبلی ادامه دارد و دفعهٔ بعد دوباره می‌پرسیم. اگر موافق نیستید، می‌توانید <a class="font-bold text-brand-800 underline">حساب را حذف کنید</a>.</p>
</main>`);
