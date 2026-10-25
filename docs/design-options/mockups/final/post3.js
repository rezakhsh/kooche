// Posting, step 3: the category's fields and the price. Choices as buttons instead of selects,
// dates as day / month / year with Persian month names, euros next to amounts, required ones marked.
const seg = (opts, on) => `<div class="flex flex-wrap gap-2">${opts.map((o, i) => `<span class="flex h-11 items-center rounded-xl border px-4 text-sm ${i === on ? 'border-2 border-brand-600 bg-brand-50 font-bold text-brand-800' : 'border-neutral-300 text-neutral-800'}">${o}</span>`).join('')}</div>`;
const label = (t, req) => `<p class="mb-1.5 text-sm font-bold">${t}${req ? '' : '<span class="ms-1 font-normal text-neutral-600">(اختیاری)</span>'}</p>`;
const money = (v, ph) => `<span class="flex h-12 items-center justify-between rounded-xl border ${v ? 'border-neutral-400' : 'border-neutral-300'} px-4 text-base"><span class="${v ? '' : 'text-neutral-500'}">${v || ph}</span><span class="text-neutral-600">€</span></span>`;
const preview = `<div class="rounded-2xl border border-neutral-200 p-3"><p class="mb-2 text-xs font-bold text-neutral-600">پیش‌نمایش</p><div class="flex gap-3"><img src="../img/room5.webp" class="aspect-[4/3] w-28 rounded-xl object-cover" alt=""><div class="min-w-0"><p class="text-sm font-bold leading-6">اتاق مبله در WG، نزدیک Hermannplatz</p><p class="font-extrabold text-brand-800">۵۹۰ €<span class="ms-1 text-xs font-medium text-neutral-600">گرم، ماهانه</span></p><p class="text-xs text-neutral-600">۱۴ متر، مبله، Anmeldung ممکن</p></div></div></div>`;
mount(`${appBar('ثبت آگهی', { lead: 'close', sub: 'املاک، اتاق و خانه اشتراکی (WG)' })}
<main class="mx-auto w-full max-w-5xl px-4 pt-4 pb-28 lg:grid lg:grid-cols-[1fr_20rem] lg:gap-10">
  <div class="min-w-0">
  ${steps(3)}
  <h1 class="mt-5 text-2xl font-extrabold">جزئیات و قیمت</h1>
  <div class="mt-5 space-y-5">
    <div>${label('اجارهٔ ماهانه، با هزینه‌ها (گرم)', true)}${money('۵۹۰')}</div>
    <div>${label('ودیعه (Kaution)', false)}${money('', 'مثلاً ۱٬۱۸۰')}</div>
    <div>${label('متراژ اتاق', true)}<span class="flex h-12 items-center justify-between rounded-xl border border-neutral-400 px-4 text-base">۱۴<span class="text-neutral-600">متر مربع</span></span></div>
    <div>${label('ثبت آدرس (Anmeldung)', true)}${seg(['ممکن است', 'ممکن نیست'], 0)}</div>
    <div>${label('مبله', true)}${seg(['بله', 'نیمه', 'نه'], 0)}</div>
    <div>${label('از تاریخ', true)}<div class="grid grid-cols-[5rem_1fr_6rem] gap-2">${['۱', 'دسامبر', '۲۰۲۶'].map((v) => `<span class="flex h-12 items-center justify-between rounded-xl border border-neutral-400 px-3 text-base">${v}${I('chevronDown', 'size-4 text-neutral-500')}</span>`).join('')}</div><p class="mt-1 text-xs text-neutral-600">سه‌شنبه، ۱ دسامبر ۲۰۲۶</p><div class="mt-2 flex gap-2">${["از همین حالا", "اول ماه بعد"].map((t, i) => `<span class="flex h-9 items-center rounded-full border px-3 text-sm ${i ? "border-brand-600 bg-brand-50 font-bold text-brand-800" : "border-neutral-300"}">${t}</span>`).join("")}</div></div>
    <div>${label('تا تاریخ', false)}${seg(['نامحدود', 'تاریخ مشخص'], 0)}</div>
    <div>${label('هم‌خانه‌ها', false)}${seg(['۱', '۲', '۳', '۴+'], 1)}</div>
  </div>
  </div>
  <aside class="hidden lg:block"><div class="sticky top-20 space-y-3">${preview}<p class="text-xs leading-6 text-neutral-600">فیلدهای بدون «اختیاری» لازم‌اند. هر تغییر خودکار ذخیره می‌شود.</p></div></aside>
</main>${stepBar('ادامه: محل و انتشار')}`);
