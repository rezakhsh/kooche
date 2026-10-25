// Posting in Germany with a verified number from outside Europe (here Turkey, +90): offers that
// need someone on the spot (renting out, selling, cars, job offers) wait until the person has a
// local number; "wanted" posts, events, verified businesses and online services are open. A
// German number posting in Austria sees none of this (Europe is one zone), only a note on its listing.
const open = [['search', 'دنبال اتاق، خانه یا کار هستم', 'آگهی «درخواست»؛ برای کسانی که به آلمان می‌آیند'], ['calendar', 'رویداد', 'کنسرت، کلاس، دورهمی'], ['wrench', 'خدمات آنلاین', 'ترجمه، مشاوره، کلاس آنلاین'], ['store', 'کسب‌وکار تأییدشده', 'با شماره، ثبت و نشانی کسب‌وکار']];
const locked = [['building', 'اجاره دادن خانه و اتاق'], ['car', 'فروش خودرو'], ['sofa', 'خرید و فروش وسایل'], ['briefcase', 'پیشنهاد کار']];
mount(`${appBar('ثبت آگهی', { lead: 'close' })}
<main class="mx-auto w-full max-w-2xl px-4 pt-4 pb-10">
  ${steps(1)}
  <h1 class="mt-5 text-2xl font-extrabold">چه چیزی آگهی می‌کنید؟</h1>
  <p class="mt-1 flex items-center gap-1.5 text-sm text-neutral-600">${flag('de', 'h-3.5 w-5')}در آلمان منتشر می‌شود، <a class="font-bold text-brand-800">تغییر</a></p>
  <section class="mt-4 rounded-2xl bg-brand-50 p-4"><p class="flex items-center gap-2 text-sm font-extrabold text-brand-900">${flag('tr', 'h-3.5 w-5')}شمارهٔ تأییدشدهٔ شما از ترکیه است</p>
    <p class="mt-1 text-sm leading-7 text-neutral-800">در اروپا این‌ها از همین حالا باز است. برای اجاره دادن، فروش و پیشنهاد کار، شمارهٔ یک کشور اروپایی لازم است؛ وقتی آمدید، آن را تأیید کنید.</p></section>
  <ul class="mt-4 divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200">${open.map(([ic, t, s]) => `<li class="flex min-h-16 items-center gap-3 px-4 py-2"><span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">${I(ic, 'size-5')}</span><span class="flex-1"><b class="block text-[15px]">${t}</b><span class="text-xs text-neutral-600">${s}</span></span>${I('chevronEnd', 'size-5 text-neutral-400')}</li>`).join('')}</ul>
  <p class="mt-6 mb-2 flex items-center gap-1.5 text-sm font-bold text-neutral-600">${I('lock', 'size-4')}با شمارهٔ اروپایی</p>
  <ul class="divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">${locked.map(([ic, t]) => `<li class="flex min-h-14 items-center gap-3 px-4 text-neutral-600"><span class="flex size-9 items-center justify-center rounded-xl bg-white">${I(ic, 'size-5')}</span><span class="flex-1 text-[15px]">${t}</span>${I('lock', 'size-4')}</li>`).join('')}</ul>
  <a class="mt-4 flex h-12 items-center justify-center gap-2 rounded-xl border border-neutral-300 font-bold text-neutral-800">${I('phone', 'size-5')}تأیید شمارهٔ دیگر</a>
</main>`);
