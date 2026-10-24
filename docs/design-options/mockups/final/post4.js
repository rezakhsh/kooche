// Posting, step 4: place and contact (filled from the profile), then "check before publishing"
// with a «تغییر» link per part. The security check runs only here, right before publishing.
const row = (k, v) => `<div class="flex items-start gap-3 py-3"><dt class="w-24 shrink-0 text-sm text-neutral-600">${k}</dt><dd class="min-w-0 flex-1 text-sm font-bold leading-6">${v}</dd><a class="text-sm font-bold text-brand-800">تغییر</a></div>`;
mount(`${appBar('ثبت آگهی', { lead: 'close', sub: 'املاک، اتاق و خانه اشتراکی (WG)' })}
<main class="mx-auto w-full max-w-2xl px-4 pt-4 pb-28">
  ${steps(4)}
  <h1 class="mt-5 text-2xl font-extrabold">محل و انتشار</h1>
  <p class="mt-4 mb-1.5 text-sm font-bold">کد پستی</p>
  <span class="flex h-12 items-center justify-between rounded-xl border border-neutral-400 px-4 text-base"><bdi dir="ltr">12043</bdi><span class="flex items-center gap-1 text-sm font-bold text-green-800">${I('check', 'size-4')}نویکلن، برلین</span></span>
  <p class="mt-1 text-xs text-neutral-600">فقط محله نشان داده می‌شود، نه آدرس دقیق.</p>
  <p class="mt-5 mb-1.5 text-sm font-bold">راه تماس</p>
  <div class="space-y-2"><span class="flex min-h-12 items-center justify-between rounded-xl border border-neutral-300 px-4 text-sm"><span>گفتگو در پیدو</span><span class="flex h-6 w-11 items-center justify-end rounded-full bg-brand-700 p-0.5"><i class="size-5 rounded-full bg-white"></i></span></span>
  <span class="flex min-h-12 items-center justify-between rounded-xl border border-neutral-300 px-4 text-sm"><span>نمایش شماره تلفن<span class="block text-xs text-neutral-600">فقط به کاربران تأییدشده</span></span><span class="flex h-6 w-11 items-center rounded-full bg-neutral-300 p-0.5"><i class="size-5 rounded-full bg-white"></i></span></span></div>
  <h2 class="mt-7 text-lg font-extrabold">پیش از انتشار بررسی کنید</h2>
  <dl class="mt-1 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 px-4">
    ${row('عکس‌ها', '<span class="flex gap-1.5"><img src="../img/room5.webp" class="size-11 rounded-lg object-cover" alt=""><img src="../img/room4.webp" class="size-11 rounded-lg object-cover" alt=""></span>')}
    ${row('عنوان', 'اتاق مبله در WG، نزدیک Hermannplatz')}
    ${row('قیمت', '۵۹۰ € گرم، ماهانه؛ ودیعه: <span class="font-normal text-neutral-600">وارد نشده</span>')}
    ${row('جزئیات', '۱۴ متر، مبله، Anmeldung ممکن، از ۱ دسامبر ۲۰۲۶')}
    ${row('انتشار به نام', 'خودم (کاربر نمونه)')}
  </dl>
  <p class="mt-4 text-xs leading-6 text-neutral-600">با انتشار، <a class="underline">شرایط استفاده</a> را می‌پذیرید. بیشتر آگهی‌ها همان لحظه منتشر می‌شوند؛ اگر بررسی لازم باشد، معمولاً کمتر از چند ساعت طول می‌کشد.</p>
</main>${stepBar('انتشار آگهی')}`);
