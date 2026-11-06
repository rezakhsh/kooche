// Legal pieces (Nov 6, 2026), item 3 for plans: the billing page's plan card ends with the
// essentials (what, price, term, renewal, how to cancel) right above the button to Stripe.
const feat = (t) => `<li class="flex gap-2">${I('check', 'mt-1 size-4 shrink-0 text-brand-700')}${t}</li>`;
const row = (k, v) => `<div class="flex gap-3 py-1.5"><dt class="w-20 shrink-0 text-neutral-600">${k}</dt><dd class="min-w-0 flex-1 font-medium">${v}</dd></div>`;
const plan = (name, m, y, feats, open) => `<div class="space-y-3 rounded-2xl border ${open ? 'border-brand-600 ring-2 ring-brand-600/20' : 'border-neutral-200'} bg-white p-4">
  <p class="text-lg font-extrabold">${name}</p>
  <ul class="space-y-1 text-sm text-neutral-700">${feats.map(feat).join('')}</ul>
  <div class="space-y-2 text-sm"><label class="flex items-center gap-2"><span class="size-4 rounded-full border-4 border-brand-700"></span>ماهانه: <b>${m}</b></label><label class="flex items-center gap-2"><span class="size-4 rounded-full border-2 border-neutral-400"></span>سالانه: <b>${y}</b></label></div>
  <dl class="divide-y divide-neutral-100 rounded-xl bg-neutral-50 px-3 text-[13px] leading-6">
    ${row('چه چیزی', `${name} برای کسب‌وکار «نان سنگک برلین»`)}
    ${row('قیمت', `<b class="text-brand-800">${m}</b> هر ماه`)}
    ${row('مدت', 'یک ماه، هر ماه خودبه‌خود تمدید می‌شود')}
    ${row('لغو', 'هر وقت بخواهید، برای پایان همان ماه. از همین صفحه یا «لغو قرارداد» پایین هر صفحه.')}
  </dl>
  <label class="flex gap-2 text-sm"><span class="mt-0.5 size-4 shrink-0 rounded border-2 border-neutral-400"></span>برای کسب‌وکارم می‌خرم، نه به‌عنوان مصرف‌کنندهٔ شخصی.</label>
  <a class="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 font-bold text-white">${I('lock', 'size-4')}سفارش با پرداخت <bdi class="text-xs font-medium opacity-90">(zahlungspflichtig bestellen)</bdi></a>
</div>`;
mount(`${appBar('اشتراک و فاکتورها: نان سنگک برلین')}
<main class="mx-auto w-full max-w-3xl px-4 pt-5 pb-10">
  <div class="rounded-2xl border border-neutral-200 p-4"><h2 class="font-extrabold">اشتراک فعلی</h2><p class="mt-1 text-sm text-neutral-600">اشتراکی ندارید.</p></div>
  <h2 class="mt-6 mb-3 font-extrabold">یک اشتراک انتخاب کنید</h2>
  <div class="grid gap-3 lg:grid-cols-2">
    ${plan('پرو', '۲۴ €', '۲۴۰ €', ['۲۵ آگهی فعال', '۳ نردبان در هر ۳۰ روز', '۱ همکار'], true)}
    ${plan('پرو پلاس', '۵۹ €', '۵۹۰ €', ['۱۰۰ آگهی فعال', '۱۵ نردبان در هر ۳۰ روز', '۲ ویژه هم‌زمان', '۵ همکار'], false)}
  </div>
  <p class="mt-3 text-xs leading-6 text-neutral-500">با «سفارش با پرداخت» به صفحهٔ امن Stripe می‌روید؛ اشتراک وقتی شروع می‌شود که آن‌جا بپردازید. قیمت نهایی است (بدون مالیات بر ارزش افزوده، §۱۹). پرو فقط برای کسب‌وکارهاست.</p>
</main>`);
