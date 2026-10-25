// Step 3: legal details by country. In Germany the Impressum fields (§ 5 DDG); a Canadian business
// later gets its own fields. Can be done now or later; required for the badge and for payments.
const f = (l, v, opt, ltr) => `<label class="block"><span class="text-sm font-bold">${l}${opt ? '<span class="ms-1 font-normal text-neutral-600">(اختیاری)</span>' : ''}</span><span class="mt-1.5 flex h-12 items-center rounded-xl border ${v ? 'border-neutral-400' : 'border-neutral-300 text-neutral-500'} px-4 text-base" ${ltr ? 'dir="ltr"' : ''}>${v || ''}</span></label>`;
mount(`${appBar('کسب‌وکار تازه', { lead: 'close', sub: 'دارالترجمه پارسیان' })}
<main class="mx-auto w-full max-w-2xl px-4 pt-4 pb-28">
  ${steps(3, ['دربارهٔ کسب‌وکار', 'تماس و ساعت کار', 'اطلاعات قانونی'])}
  <h1 class="mt-5 text-2xl font-extrabold">اطلاعات قانونی</h1>
  <div class="mt-3 flex gap-3 rounded-2xl bg-brand-50 p-3.5 text-sm leading-7"><span class="text-brand-700">${I('shield', 'size-5 mt-1')}</span><span>در آلمان کسب‌وکارها باید «اطلاعات حقوقی» (<bdi>Impressum</bdi>) داشته باشند. ما آن را زیر صفحهٔ شما و هر آگهی‌تان نشان می‌دهیم. برای نشان «تأییدشده» و پرداخت لازم است.</span></div>
  <div class="mt-5 space-y-4">
    <div><p class="mb-1.5 text-sm font-bold">شکل حقوقی</p><div class="flex flex-wrap gap-2">${['Einzelunternehmen', 'GmbH', 'UG', 'GbR', 'دیگر'].map((t, i) => `<span class="flex h-10 items-center rounded-full border px-3.5 text-sm ${i === 0 ? 'border-2 border-brand-600 bg-brand-50 font-bold text-brand-800' : 'border-neutral-300'}" dir="ltr">${t}</span>`).join('')}</div></div>
    ${f('نام کامل صاحب کسب‌وکار', 'Nasrin Example', false, true)}
    ${f('نشانی', 'Kantstraße 1, 10623 Berlin', false, true)}
    ${f('شمارهٔ مالیات بر ارزش افزوده (USt-IdNr)', '', true, true)}
  </div>
  <a class="mt-6 flex h-11 items-center justify-center text-sm font-bold text-brand-800">بعداً تکمیل می‌کنم</a>
</main>${stepBar('ساخت کسب‌وکار')}`);
