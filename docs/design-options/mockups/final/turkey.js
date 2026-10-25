// Turkey: no marketplace (Turkish law requires e-Devlet verification for every rental and car ad,
// and the main scams there target exactly these needs). Instead an account-free guide: official
// links, named scam warnings, what already works from Turkey (online events and services), and a
// waitlist with no promised date.
const links = [['goc.gov.tr', 'اقامت (ikamet) و تمدید آن، فقط از سایت رسمی'], ['UNHCR Türkiye', 'پناهندگی و کمک حقوقی رایگان'], ['کانون وکلای استانبول', 'وکیل رایگان (Adli Yardım) برای کسانی که توان پرداخت ندارند']];
const scams = ['«کارچاق‌کن» اقامت یا ویزا که پول را پیش از هر کاری می‌خواهد', 'فروش وقت سفارت و نوبت ویزای شنگن', 'قول پذیرش دانشگاه در ازای پول', 'صاحب‌خانه‌ای که پیش از دیدن خانه ودیعه می‌خواهد', 'هر کسی که «راه رفتن به اروپا» می‌فروشد'];
mount(`${header({ place: 'ترکیه', search: 'جستجو در پیدو…' })}
<main>
  <section class="bg-gradient-to-b from-brand-50 to-white px-4 pt-7 pb-4 lg:pt-14">
    <div class="mx-auto max-w-2xl">
      <p class="flex items-center gap-2 text-sm font-bold text-brand-800">${flag('tr', 'h-4 w-6')}به نظر می‌رسد در ترکیه هستید</p>
      <h1 class="mt-3 text-[26px] font-black leading-[1.5] lg:text-4xl">راهنمای ایرانیان در ترکیه</h1>
      <p class="mt-2 text-base leading-8 text-neutral-700">پیدو هنوز در ترکیه آگهی نمی‌پذیرد: قانون ترکیه برای هر آگهی خانه و خودرو تأیید از راه e-Devlet می‌خواهد و ما هنوز نمی‌توانیم این را درست انجام دهیم. تا آن موقع، این راهنما و آنچه از ترکیه هم کار می‌کند.</p>
    </div>
  </section>
  <section class="mx-auto max-w-2xl px-4 lg:grid lg:max-w-5xl lg:grid-cols-2 lg:items-start lg:gap-6">
    <div>
      <div class="rounded-2xl bg-saffron-50 p-4"><h2 class="flex items-center gap-2 text-base font-extrabold text-saffron-800">${I('alert', 'size-5')}مراقب این‌ها باشید</h2>
        <ul class="mt-2 list-disc space-y-1 ps-5 text-sm leading-7 text-neutral-800">${scams.map((s) => `<li>${s}</li>`).join('')}</ul>
        <p class="mt-2 text-xs leading-6 text-saffron-800">اقامت فقط از راه سایت رسمی و دفتر مهاجرت گرفته می‌شود. «تضمین» در کار نیست.</p></div>
      <h2 class="mt-6 text-lg font-extrabold">جاهای رسمی</h2>
      <ul class="mt-3 space-y-2">${links.map(([t, s]) => `<li class="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3.5"><span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">${I('shield', 'size-5')}</span><span class="flex-1"><b class="block text-sm"><bdi>${t}</bdi></b><span class="text-xs leading-6 text-neutral-600">${s}</span></span>${I('chevronEnd', 'size-4 text-neutral-400')}</li>`).join('')}</ul>
    </div>
    <div>
      <h2 class="mt-6 text-lg font-extrabold lg:mt-0">از ترکیه هم کار می‌کند</h2>
      <ul class="mt-3 space-y-2">${[['calendar', 'رویدادهای آنلاین', 'کلاس زبان، کارگاه مهاجرت، شب شعر'], ['wrench', 'خدمات آنلاین', 'مترجم رسمی، مشاورهٔ تحصیلی و کاری از کشورهای باز، با کسب‌وکار تأییدشده']].map(([ic, t, s]) => `<li class="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3.5"><span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">${I(ic, 'size-5')}</span><span class="flex-1"><b class="block text-sm">${t}</b><span class="text-xs leading-6 text-neutral-600">${s}</span></span>${I('chevronEnd', 'size-4 text-neutral-400')}</li>`).join('')}</ul>
      <div class="mt-4 rounded-2xl border border-neutral-200 p-4"><h2 class="text-base font-extrabold">اگر پیدو در ترکیه باز شد خبرم کن</h2>
        <p class="mt-1 text-sm leading-7 text-neutral-700">تاریخی قول نمی‌دهیم. اول رویدادها و کسب‌وکارهای تأییدشده، اگر شریک محلی مطمئن پیدا کنیم.</p>
        <span class="mt-3 flex h-12 items-center rounded-xl border border-neutral-300 px-4 text-base text-neutral-500" dir="ltr">you@example.com</span>
        <a class="mt-3 flex h-12 items-center justify-center rounded-xl bg-brand-700 font-bold text-white">خبرم کن</a></div>
    </div>
  </section>
</main>${footer()}${bottomNav(0)}`);
