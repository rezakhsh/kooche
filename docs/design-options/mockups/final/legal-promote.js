// Legal pieces (Nov 6, 2026; owner: "very simple"): the only change is the price on the button,
// which follows the ticked card (CSS :has, no script), as Kleinanzeigen shows the cost at its button.
const offers = [
  ['نردبان یک‌باره', '۱٫۹۹ €', 'آگهی همین حالا یک بار به بالای فهرست می‌رود.', true],
  ['۳ نردبان در ۷ روز', '۴٫۴۹ €', 'الان، ۳ روز بعد و ۶ روز بعد به بالای فهرست می‌رود.', false],
  ['ویژهٔ ۷ روزه', '۶٫۹۹ €', '۷ روز در ردیف «آگهی‌های ویژه» بالای همان دسته و شهر.', false],
];
const card = ([name, price, text, on]) => `<label class="flex gap-3 rounded-2xl border ${on ? 'border-brand-600 ring-2 ring-brand-600/20' : 'border-neutral-200'} bg-white p-4">
  <span class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-brand-700 bg-brand-700 text-white' : 'border-neutral-300 text-transparent'}">${I('check', 'size-4')}</span>
  <span class="min-w-0 flex-1"><span class="flex flex-wrap items-baseline justify-between gap-2"><b>${name}</b><b class="text-brand-700">${price}</b></span><span class="mt-1 block text-sm text-neutral-600">${text}</span></span></label>`;
const row = (k, v) => `<div class="flex gap-3 py-2"><dt class="w-24 shrink-0 text-neutral-600">${k}</dt><dd class="min-w-0 flex-1 font-medium text-neutral-900">${v}</dd></div>`;
mount(`${header()}
<main class="mx-auto w-full max-w-3xl px-4 pt-5 pb-28 lg:pb-10">
  <h1 class="text-xl font-extrabold">ارتقای آگهی</h1>
  <p class="mt-2 text-sm"><a class="font-bold text-brand-800">مبل سه‌نفرهٔ طوسی، تمیز</a></p>
  <p class="mt-4 mb-3 text-sm text-neutral-700">آگهی‌تان را بیشتر ببینند. ثبت آگهی همیشه رایگان است؛ این‌ها فقط برای دیده شدن بیشتر است.</p>
  <div class="grid gap-3 lg:grid-cols-3">${offers.map(card).join('')}</div>
  <p class="mt-3 text-xs text-neutral-500">قیمت نهایی است (بدون مالیات بر ارزش افزوده، طبق §۱۹ قانون مالیات آلمان).</p>

  <label class="mt-4 flex gap-2 text-sm"><span class="mt-1 flex size-4 shrink-0 items-center justify-center rounded bg-brand-700 text-white">${I('check', 'size-3')}</span>
    <span>موافقم که این خدمت همین حالا شروع شود و می‌دانم حق انصراف ۱۴ روزه‌ام با انجام کامل آن از بین می‌رود. <a class="text-brand-800 underline">شرایط خدمات پولی</a></span></label>

  <a class="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 text-base font-bold text-white lg:w-auto lg:px-8 lg:inline-flex">${I('lock', 'size-4')}پرداخت ۱٫۹۹ €</a>
  <p class="mt-2 text-xs text-neutral-500">پرداخت با کارت، Apple Pay، Google Pay یا PayPal در صفحهٔ امن Stripe.</p>
</main>
${bottomNav(3)}`);
