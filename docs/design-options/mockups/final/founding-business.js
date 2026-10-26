// Round 12: what a founding business in a waitlist city receives, said plainly. Normal features,
// nothing invented: a page in the city directory, visibility on opening day, the badge, Pro free
// for 6 months without a card, and help setting up. Places are real and limited (Hamburg: 20).
const perks = [
  ['store', 'صفحهٔ کسب‌وکار خودتان', 'نام، لوگو، نشانی، ساعت کاری، منو یا فهرست قیمت، اینستاگرام، واتس‌اپ و تلگرام. در گوگل هم پیدا می‌شود.'],
  ['star', 'نشان «بنیان‌گذار هامبورگ» برای همیشه', 'فقط ۲۰ کسب‌وکار اول؛ بعداً هرگز داده نمی‌شود.'],
  ['home', 'روز اول، در صفحهٔ اول هامبورگ', 'در بخش «کسب‌وکارهای تأییدشده» و در اعلان باز شدن شهر در تلگرام و اینستاگرام پیدو.'],
  ['sparkle', '۶ ماه پرو رایگان', '۲۵ آگهی فعال به‌جای ۳، یک نردبان رایگان در هفته، آمار بازدید. بدون کارت بانکی و بدون تمدید خودکار.'],
  ['calendar', 'رویدادها و آگهی استخدام', 'رویدادهای نوروز و یلدا و آگهی کار، رایگان.'],
  ['verified', 'نشان «تأییدشده»', 'با یک مدرک ثبت کسب‌وکار؛ حدود ۵ دقیقه. نشان دقیقاً می‌گوید چه چیزی بررسی شده.'],
  ['chat', 'کمک برای راه‌اندازی', 'اگر بخواهید، صفحه و اولین آگهی‌هایتان را با هم می‌سازیم.'],
];
mount(`${appBar('کسب‌وکار بنیان‌گذار هامبورگ')}
<main class="mx-auto w-full max-w-3xl px-4 pt-5 pb-28">
  <section class="rounded-3xl bg-gradient-to-b from-brand-50 to-white p-4 lg:p-6">
    <p class="flex items-center gap-2 text-xs font-bold text-brand-800">${I('store', 'size-4')}برای کسب‌وکارهای ایرانی هامبورگ</p>
    <h1 class="mt-1 text-2xl font-black leading-[1.5]">با شما هامبورگ باز می‌شود</h1>
    <p class="mt-1 text-[15px] leading-8 text-neutral-700">رستوران، آرایشگاه، مترجم، وکیل، آموزشگاه، اسباب‌کشی… هر کسب‌وکار ایرانی. ثبت رایگان است.</p>
    <p class="mt-3 flex items-baseline justify-between text-sm"><b>${fa(12)} از ${fa(20)} جای بنیان‌گذار پر شده</b><span class="text-neutral-600">${fa(8)} جا مانده</span></p>
    <span class="mt-2 block h-2.5 overflow-hidden rounded-full bg-white ring-1 ring-brand-100"><i class="block h-full w-3/5 rounded-full bg-brand-600"></i></span>
  </section>
  <h2 class="mt-6 text-lg font-extrabold">چه می‌گیرید</h2>
  <ul class="mt-3 space-y-2">${perks.map(([ic, t, s]) => `<li class="flex items-start gap-3 rounded-2xl border border-neutral-200 p-3.5"><span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">${I(ic, 'size-5')}</span><span><b class="block text-sm">${t}</b><span class="text-xs leading-6 text-neutral-600">${s}</span></span></li>`).join('')}</ul>
  <h2 class="mt-7 text-lg font-extrabold">چطور</h2>
  <ol class="mt-3 space-y-3">${[['ثبت کسب‌وکار', '۲ دقیقه: نام، دسته، نشانی'], ['تأیید', 'یک مدرک ثبت کسب‌وکار؛ معمولاً همان روز'], ['صفحه و آگهی‌ها', 'از همین حالا آماده کنید'], ['روز باز شدن هامبورگ', 'همه با هم منتشر می‌شوند و شما در صفحهٔ اول هستید']].map(([t, s], i) => `<li class="flex items-start gap-3"><span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">${fa(i + 1)}</span><span><b class="block text-sm">${t}</b><span class="text-xs text-neutral-600">${s}</span></span></li>`).join('')}</ol>
  <div class="mt-6 flex items-center gap-3 rounded-2xl bg-neutral-100 p-3.5"><span class="flex size-12 items-center justify-center rounded-xl bg-white text-brand-700">${I('camera', 'size-6')}</span><span class="flex-1"><b class="block text-sm">ویدیوی کوتاه: پیدو برای کسب‌وکارها</b><span class="text-xs text-neutral-600">به‌زودی</span></span></div>
  <p class="mt-6 text-xs leading-6 text-neutral-600">بعد از ۶ ماه، پرو فقط اگر خودتان بخواهید ادامه پیدا می‌کند (۲۴ € در ماه). بدون پرو هم صفحه و ۳ آگهی رایگان می‌ماند. <a class="font-bold text-brand-800 underline">فرق آگهی شخصی و کسب‌وکار</a></p>
</main>${stepBar('ثبت رایگان کسب‌وکار', '')}`);
