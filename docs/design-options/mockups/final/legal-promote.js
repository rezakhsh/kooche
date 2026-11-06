// Legal pieces (Nov 6, 2026), item 3: the essentials right above the button that goes to Stripe
// (§ 312j (2) BGB). The summary follows the ticked card (CSS :has in the app, no script).
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

  <section class="mt-5 rounded-2xl border-2 border-brand-200 bg-brand-50/60 p-4 lg:p-5">
    <h2 class="flex items-center gap-2 text-sm font-extrabold text-brand-800">${I('doc', 'size-5 text-brand-700')}خلاصهٔ سفارش <bdi class="text-xs font-medium text-neutral-600">(Bestellübersicht)</bdi></h2>
    <dl class="mt-2 divide-y divide-brand-100 text-sm">
      ${row('خدمت', 'نردبان یک‌باره برای «مبل سه‌نفرهٔ طوسی، تمیز»: همین حالا یک بار به بالای فهرست می‌رود.')}
      ${row('مدت', 'یک‌باره. اشتراک نیست و خودبه‌خود تمدید نمی‌شود.')}
      ${row('قیمت کل', '<b class="text-base text-brand-800">۱٫۹۹ €</b> <span class="text-xs font-normal text-neutral-600">یک بار، بدون هزینهٔ دیگر</span>')}
      ${row('حق انصراف', '۱۴ روز. چون خدمت همین حالا انجام می‌شود، با انجام کامل آن حق انصراف از بین می‌رود.')}
    </dl>
    <label class="mt-3 flex gap-2 rounded-xl bg-white p-3 text-sm leading-7"><span class="mt-1 flex size-4 shrink-0 items-center justify-center rounded bg-brand-700 text-white">${I('check', 'size-3')}</span>
      <span>موافقم که این خدمت همین حالا شروع شود و می‌دانم حق انصراف ۱۴ روزه‌ام با انجام کامل آن از بین می‌رود. <a class="text-brand-800 underline">شرایط خدمات پولی</a></span></label>
    <p class="mt-3 text-xs leading-6 text-neutral-700">${I('lock', 'inline size-3.5 text-brand-700')} با دکمهٔ پایین سفارش پولی ثبت می‌شود و به صفحهٔ امن Stripe برای پرداخت می‌روید. اگر آن‌جا نپردازید، سفارشی ثبت نمی‌شود و پولی کم نمی‌شود.</p>
  </section>

  <a class="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 text-base font-bold text-white lg:w-auto lg:px-8 lg:inline-flex">${I('lock', 'size-4')}سفارش با پرداخت <bdi class="text-sm font-medium opacity-90">(zahlungspflichtig bestellen)</bdi></a>
  <p class="mt-2 text-xs text-neutral-500">پرداخت با کارت، Apple Pay، Google Pay یا PayPal در صفحهٔ امن Stripe.</p>
</main>
${bottomNav(3)}`);
