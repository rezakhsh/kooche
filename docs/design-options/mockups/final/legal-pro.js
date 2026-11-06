// Legal pieces (Nov 6, 2026, Kleinanzeigen level): price, renewal and how to cancel in one line
// above the button. VIEW=cancel: a running plan with «لغو اشتراک» and its confirmation.
const feat = (t) => `<li class="flex gap-2">${I('check', 'mt-1 size-4 shrink-0 text-brand-700')}${t}</li>`;
const row = (k, v) => `<div class="flex gap-3 py-1.5"><dt class="w-20 shrink-0 text-neutral-600">${k}</dt><dd class="min-w-0 flex-1 font-medium">${v}</dd></div>`;
const plan = (name, m, y, feats, open) => `<div class="space-y-3 rounded-2xl border ${open ? 'border-brand-600 ring-2 ring-brand-600/20' : 'border-neutral-200'} bg-white p-4">
  <p class="text-lg font-extrabold">${name}</p>
  <ul class="space-y-1 text-sm text-neutral-700">${feats.map(feat).join('')}</ul>
  <div class="space-y-2 text-sm"><label class="flex items-center gap-2"><span class="size-4 rounded-full border-4 border-brand-700"></span>ماهانه: <b>${m}</b></label><label class="flex items-center gap-2"><span class="size-4 rounded-full border-2 border-neutral-400"></span>سالانه: <b>${y}</b></label></div>
  <p class="rounded-xl bg-neutral-50 px-3 py-2 text-[13px] leading-6"><b class="text-brand-800">${m}</b> هر ماه · هر ماه خودبه‌خود تمدید می‌شود · هر وقت بخواهید، از همین صفحه لغو کنید</p>
  <label class="flex gap-2 text-sm"><span class="mt-0.5 size-4 shrink-0 rounded border-2 border-neutral-400"></span>برای کسب‌وکارم می‌خرم، نه به‌عنوان مصرف‌کنندهٔ شخصی.</label>
  <a class="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 font-bold text-white">${I('lock', 'size-4')}پرداخت و شروع اشتراک</a>
</div>`;
const view = window.VIEW || 'buy';
const running = `<div class="rounded-2xl border border-neutral-200 p-4"><h2 class="font-extrabold">اشتراک فعلی</h2>
  <p class="mt-2 flex items-center gap-2"><b>پرو</b><span class="text-sm text-neutral-600">ماهانه</span><span class="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-800">فعال</span></p>
  <p class="mt-1 text-sm text-neutral-600">تمدید بعدی: ۲۱ دسامبر ۲۰۲۶ (۲۴ €)</p>
  <div class="mt-3 flex flex-wrap gap-2"><a class="flex h-10 items-center rounded-xl border border-neutral-300 px-4 text-sm font-bold">کارت، فاکتورها و تغییر پلن</a><a class="flex h-10 items-center rounded-xl border border-red-300 px-4 text-sm font-bold text-red-700">لغو اشتراک</a></div></div>
  <div class="mt-4 rounded-2xl border-2 border-neutral-200 bg-neutral-50 p-4 text-sm leading-7"><b class="block">اشتراک پرو لغو شود؟</b>پرو تا ۲۱ دسامبر ۲۰۲۶ مثل حالا کار می‌کند و بعد تمام می‌شود؛ دیگر پولی برداشته نمی‌شود. تا آن روز می‌توانید دوباره روشنش کنید.
    <div class="mt-3 flex flex-wrap gap-2"><a class="flex h-11 items-center rounded-xl bg-red-700 px-5 font-bold text-white">بله، لغو کن</a><a class="flex h-11 items-center rounded-xl px-4 font-bold text-brand-800">نه، بماند</a></div></div>`;
if (view === 'cancel') { mount(`${appBar('اشتراک و فاکتورها: نان سنگک برلین')}<main class="mx-auto w-full max-w-3xl px-4 pt-5 pb-10">${running}</main>`); } else
mount(`${appBar('اشتراک و فاکتورها: نان سنگک برلین')}
<main class="mx-auto w-full max-w-3xl px-4 pt-5 pb-10">
  <div class="rounded-2xl border border-neutral-200 p-4"><h2 class="font-extrabold">اشتراک فعلی</h2><p class="mt-1 text-sm text-neutral-600">اشتراکی ندارید.</p></div>
  <h2 class="mt-6 mb-3 font-extrabold">یک اشتراک انتخاب کنید</h2>
  <div class="grid gap-3 lg:grid-cols-2">
    ${plan('پرو', '۲۴ €', '۲۴۰ €', ['۲۵ آگهی فعال', '۳ نردبان در هر ۳۰ روز', '۱ همکار'], true)}
    ${plan('پرو پلاس', '۵۹ €', '۵۹۰ €', ['۱۰۰ آگهی فعال', '۱۵ نردبان در هر ۳۰ روز', '۲ ویژه هم‌زمان', '۵ همکار'], false)}
  </div>
  <p class="mt-3 text-xs leading-6 text-neutral-500">قیمت نهایی است (بدون مالیات بر ارزش افزوده، §۱۹). پرو فقط برای کسب‌وکارهاست.</p>
</main>`);
