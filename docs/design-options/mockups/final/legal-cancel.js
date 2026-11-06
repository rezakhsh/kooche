// Legal pieces (Nov 6, 2026), item 2: § 312k BGB. «لغو قرارداد (Verträge hier kündigen)» in
// every page's footer opens this page; no sign-in needed. Signed in, the owner's subscriptions
// are listed and the fields are filled. Step 2 is the confirmation button «همین حالا لغو کن».
const field = (label, value, hint = '') => `<label class="block"><span class="text-sm font-bold">${label}</span>
  <span class="mt-1 flex h-12 items-center rounded-xl border border-neutral-300 bg-white px-3 text-sm ${value ? '' : 'text-neutral-400'}">${value || hint}</span></label>`;
const radio = (label, on, sub = '') => `<label class="flex gap-3 rounded-xl border ${on ? 'border-brand-600 ring-2 ring-brand-600/20' : 'border-neutral-200'} bg-white p-3 text-sm"><span class="mt-0.5 size-4 shrink-0 rounded-full ${on ? 'border-4 border-brand-700' : 'border-2 border-neutral-400'}"></span><span><b>${label}</b>${sub ? `<span class="block text-xs leading-6 text-neutral-600">${sub}</span>` : ''}</span></label>`;
const step = window.STEP || 1;
const form = `
  <p class="text-sm leading-7 text-neutral-700">اشتراک پرو یا پرو پلاس را اینجا لغو کنید. لازم نیست وارد حساب شوید. رسید لغو را با تاریخ و ساعت فوراً به ایمیل‌تان می‌فرستیم.</p>
  <div class="mt-4 space-y-4">
    ${field('نام شما', 'سارا احمدی')}
    ${field('ایمیل', '<bdi dir="ltr">sara@example.com</bdi>', '')}
    ${field('کدام قرارداد؟', 'پرو، «نان سنگک برلین»', '')}
    <p class="-mt-2 text-xs leading-6 text-neutral-600">نام کسب‌وکار یا شمارهٔ فاکتور. اگر نمی‌دانید، خالی بگذارید؛ با ایمیل پیدایش می‌کنیم.</p>
    <fieldset class="space-y-2"><legend class="mb-1 text-sm font-bold">نوع لغو</legend>
      ${radio('عادی: برای پایان دورهٔ فعلی', true, 'تا آن روز همه‌چیز مثل حالا کار می‌کند.')}
      ${radio('فوری، با دلیل مهم', false, 'دلیل را در یک خط بنویسید؛ بررسی می‌کنیم و جواب می‌دهیم.')}
    </fieldset>
    ${field('تاریخ پایان', 'زودترین زمان ممکن (۲۱ دسامبر ۲۰۲۶)')}
  </div>
  <a class="mt-5 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-red-700 font-bold text-white lg:w-auto lg:px-8 lg:inline-flex">همین حالا لغو کن <bdi class="ms-1 text-sm font-medium opacity-90">(jetzt kündigen)</bdi></a>`;
const confirm = `
  <div class="rounded-2xl border-2 border-brand-200 bg-brand-50/60 p-4 text-sm">
    <h2 class="font-extrabold text-brand-800">لغو را تأیید کنید</h2>
    <dl class="mt-2 divide-y divide-brand-100">
      <div class="flex gap-3 py-2"><dt class="w-24 shrink-0 text-neutral-600">قرارداد</dt><dd class="font-medium">پرو، «نان سنگک برلین»</dd></div>
      <div class="flex gap-3 py-2"><dt class="w-24 shrink-0 text-neutral-600">نوع</dt><dd class="font-medium">عادی، برای پایان دورهٔ فعلی (۲۱ دسامبر ۲۰۲۶)</dd></div>
      <div class="flex gap-3 py-2"><dt class="w-24 shrink-0 text-neutral-600">نام و ایمیل</dt><dd class="font-medium">سارا احمدی، <bdi dir="ltr">sara@example.com</bdi></dd></div>
    </dl>
  </div>
  <a class="mt-5 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-red-700 font-bold text-white lg:w-auto lg:px-8 lg:inline-flex">همین حالا لغو کن <bdi class="ms-1 text-sm font-medium opacity-90">(jetzt kündigen)</bdi></a>
  <a class="mt-3 flex h-11 items-center justify-center text-sm font-bold text-brand-800 lg:inline-flex lg:ms-4">برگشت و تغییر</a>`;
const done = `
  <div class="flex items-start gap-3 rounded-2xl bg-brand-50 p-4"><span class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700">${I('check', 'size-6')}</span>
    <div class="text-sm leading-7"><b class="block text-brand-800">لغو ثبت شد</b>اشتراک پرو «نان سنگک برلین» در ۲۱ دسامبر ۲۰۲۶ تمام می‌شود و دیگر پولی برداشته نمی‌شود.</div></div>
  <div class="mt-4 rounded-2xl border border-neutral-200 p-4 text-sm leading-7">
    <p><b>زمان دریافت:</b> ۶ نوامبر ۲۰۲۶، ساعت ۱۴:۳۲ (به وقت برلین)</p>
    <p>رسید همین حالا به <bdi dir="ltr">sara@example.com</bdi> و به ایمیل صاحب کسب‌وکار رفت.</p>
    <p class="text-neutral-600">پشیمان شدید؟ تا ۲۱ دسامبر از «اشتراک و فاکتورها» دوباره روشنش کنید.</p>
  </div>
  <a class="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 font-bold lg:w-auto lg:px-6 lg:inline-flex">${I('download', 'size-4')}ذخیرهٔ این صفحه</a>`;
mount(`${header()}
<main class="mx-auto w-full max-w-xl px-4 pt-6 pb-10">
  <h1 class="text-xl font-extrabold">لغو قرارداد <bdi class="text-sm font-medium text-neutral-600">(Verträge hier kündigen)</bdi></h1>
  ${step === 1 ? form : `<div class="mt-4">${done}</div>`}
</main>
<div class="${step === 1 ? '' : 'hidden lg:block'}">${footer()}</div>`);
