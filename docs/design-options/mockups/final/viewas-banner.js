// Round 12: what the owner sees after "sign in with this account" (Canada test account): the site
// as in Toronto, with a fixed staff banner on every page so it is never mistaken for a normal session.
mount(`<div class="sticky top-0 z-40 flex items-center gap-2 bg-saffron-500 px-4 py-2 text-sm font-bold text-neutral-900">${I('shield', 'size-4')}<span class="flex-1 truncate">شما با «حساب آزمایشی کانادا» هستید، نمای تورنتو</span><a class="rounded-lg bg-neutral-900 px-3 py-1 text-xs text-white">پایان</a></div>
${header({ place: 'تورنتو', search: 'جستجو در تورنتو…' })}
<main class="mx-auto w-full max-w-5xl px-4 pb-24">
  <section class="pt-5"><p class="flex items-center gap-2 text-sm font-bold text-brand-800">${flag('ca', 'h-4 w-6')}کانادا</p>
    <h1 class="mt-2 text-[26px] font-black leading-[1.5]">پیدو به‌زودی در تورنتو</h1>
    <div class="mt-3 rounded-2xl border border-neutral-200 p-4"><p class="flex items-baseline justify-between"><b>${fa(9)} از ${fa(30)} کسب‌وکار</b><span class="text-sm text-neutral-600">${fa(412)} نفر منتظرند</span></p><span class="mt-2 block h-3 overflow-hidden rounded-full bg-neutral-100"><i class="block h-full w-[30%] rounded-full bg-brand-600"></i></span></div></section>
  <section class="mt-4 rounded-2xl bg-neutral-50 p-4 text-sm leading-7 text-neutral-700"><b class="block text-neutral-900">در نمای آزمایشی</b>آگهی‌ای که با این حساب بگذارید فقط برای کارکنان دیده می‌شود. برای دیدن سایت از نگاه یک بازدیدکنندهٔ بدون حساب، از «نمایش به‌عنوان یک کشور» استفاده کنید.</section>
</main>${bottomNav(0)}`);
