// Business dashboard right after a business's second listing: the founding offer where it is
// earned, as progress (2 of 3 listings, verification done), with the real places left and the
// fixed deadline. No countdown timer, no card needed; the full terms one tap away.
const rows = [['ترجمه رسمی مدارک فارسی به آلمانی', 'فعال، ۳۸ بازدید'], ['ترجمهٔ فوری گواهی‌نامه و دیپلم', 'فعال، امروز منتشر شد']];
const step = (done, t, s) => `<li class="flex items-start gap-3"><span class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${done ? 'bg-brand-700 text-white' : 'border-2 border-neutral-300 bg-white'}">${done ? I('check', 'size-3.5', 3) : ''}</span><span><b class="block text-sm">${t}</b><span class="text-xs text-neutral-600">${s}</span></span></li>`;
mount(`${header()}
<main class="mx-auto w-full max-w-3xl px-4 pt-5 pb-24">
  <div class="flex items-center gap-3"><span class="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-lg font-black text-brand-800">پ</span><div><h1 class="text-xl font-extrabold">دارالترجمه پارسیان</h1><p class="text-sm text-neutral-600">پنل کسب‌وکار، شارلوتنبورگ، برلین</p></div></div>
  <section class="mt-5 rounded-3xl border-2 border-saffron-300 bg-saffron-50 p-4 lg:p-5">
    <p class="flex items-center gap-2 text-xs font-bold text-saffron-800">${I('star', 'size-4')}کسب‌وکار بنیان‌گذار برلین</p>
    <h2 class="mt-1 text-lg font-extrabold">یک آگهی دیگر تا ۶ ماه پرو رایگان</h2>
    <div class="mt-3 flex items-center gap-3"><span class="h-2.5 flex-1 overflow-hidden rounded-full bg-white"><i class="block h-full w-2/3 rounded-full bg-saffron-500"></i></span><b class="text-sm">${fa(2)} از ${fa(3)} آگهی</b></div>
    <ol class="mt-4 space-y-3">${step(true, 'کسب‌وکار تأیید شد', 'شماره، نشانی و Impressum بررسی شد')}${step(true, 'دو آگهی فعال', 'هر دو منتشر شده‌اند')}${step(false, 'آگهی سوم تا ۲۲ نوامبر', 'بعد از آن پرو خودکار روشن می‌شود؛ بدون کارت بانکی')}</ol>
    <p class="mt-4 text-xs leading-6 text-saffron-800">پرو ۲۴ € در ماه است. برای بنیان‌گذاران ۶ ماه رایگان، بی تمدید خودکار. ${fa(31)} جا از ${fa(50)} مانده؛ ثبت‌نام تا ۳۱ ژانویه ۲۰۲۷. <a class="font-bold underline">شرایط کامل</a></p>
    <a class="mt-4 flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-700 font-bold text-white">${I('plus', 'size-5')}ثبت آگهی سوم</a>
  </section>
  <h2 class="mt-7 mb-2 text-base font-extrabold">آگهی‌های کسب‌وکار</h2>
  <ul class="divide-y divide-neutral-200 rounded-2xl border border-neutral-200">${rows.map(([t, s]) => `<li class="flex min-h-16 items-center gap-3 px-4"><span class="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-xs font-black text-brand-800">ترجمه</span><span class="min-w-0 flex-1"><b class="block truncate text-sm">${t}</b><span class="text-xs text-neutral-600">${s}</span></span>${I('chevronEnd', 'size-4 text-neutral-400')}</li>`).join('')}</ul>
</main>${bottomNav(3)}`);
