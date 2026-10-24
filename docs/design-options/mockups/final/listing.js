// Listing page. Phone: back, share and save over the photo (no bottom bar here), chat always at the
// bottom. Computer: title, price and contact beside a shorter photo, all on the first screen.
const l = L.room;
const thumbs = [2, 3, 4, 5, 6].map((n) => `<img src="../img/room${n}.webp" class="aspect-square w-16 shrink-0 rounded-lg object-cover lg:w-20" alt="">`).join('');
const facts = [['ruler', '۶۵ متر'], ['door', '۲ اتاق'], ['stamp', 'Anmeldung ممکن'], ['calendar', 'از ۱ دسامبر']];
const details = [['اجارهٔ سرد', '۸۷۰ €'], ['هزینه‌های جانبی', '۱۵۰ €'], ['ودیعه (Kaution)', '۲٬۶۱۰ €'], ['طبقه', '۲ از ۴، آسانسور دارد'], ['مبله', 'بله'], ['حیوان خانگی', 'نه']];
const seller = `<section class="rounded-2xl border border-neutral-200 p-4">
  <div class="flex items-center gap-3"><span class="flex size-12 items-center justify-center rounded-full bg-saffron-50 text-lg font-extrabold text-saffron-800">آ</span>
  <div class="min-w-0 flex-1"><p class="font-bold">${l.seller}</p><p class="text-xs text-neutral-600">عضو از ${l.since}، معمولاً در چند ساعت جواب می‌دهد</p></div>${I('chevronEnd', 'size-4 text-neutral-500')}</div>
  <div class="mt-3 flex flex-wrap gap-1.5"><span class="flex items-center gap-1 rounded-full bg-brand-50 px-2.5 text-xs font-bold leading-7 text-brand-800">${I('shield', 'size-3.5')}شماره تأیید شده</span><span class="rounded-full bg-neutral-100 px-2.5 text-xs leading-7 text-neutral-700">${fa(2)} آگهی دیگر</span></div></section>`;
const safety = `<section class="rounded-2xl bg-saffron-50 p-4 text-saffron-800"><p class="flex items-center gap-2 font-bold">${I('alert', 'size-5')}پیش از اجاره</p>
  <ul class="mt-2 list-disc space-y-1 ps-5 text-sm leading-7"><li>تا خانه را ندیده‌اید و قرارداد امضا نکرده‌اید، پولی (Kaution) واریز نکنید.</li><li>«کلید را پست می‌کنم» و «صاحب‌خانه خارج از کشور است» نشانهٔ کلاهبرداری است.</li></ul><a class="mt-1 inline-block text-sm font-bold underline">نکات ایمنی اجاره</a></section>`;
const actions = (wide) => `<div class="flex gap-2"><a class="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-700 font-bold text-white">${I('chat', 'size-5')}گفتگو با آگهی‌دهنده</a>
  <a class="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-neutral-300 px-4 font-bold text-neutral-800" aria-label="نمایش شماره">${I('phone', 'size-5')}${wide ? 'شماره' : ''}</a>
  ${wide ? '' : `<a class="flex size-12 items-center justify-center rounded-xl border border-neutral-300 text-neutral-800" aria-label="نشان کردن">${I('heart', 'size-5')}</a>`}</div>`;
const similar = [L.wg, { ...L.wg, title: 'اتاق ۱۸ متری در WG سه‌نفره', price: 640, place: 'فریدریش‌هاین', ago: 'دیروز', img: '../img/room4.webp' }, { ...L.desk }];
mount(`<div class="hidden lg:block">${header()}</div>
<main class="mx-auto w-full max-w-6xl pb-28 lg:grid lg:grid-cols-[1fr_22rem] lg:gap-8 lg:px-6 lg:pt-6">
  <div class="min-w-0">
    <div class="relative aspect-[4/3] bg-neutral-900 lg:aspect-[16/10] lg:max-h-[440px] lg:overflow-hidden lg:rounded-2xl">
      <img src="../img/room1.webp" class="size-full object-cover" alt="">
      <div class="absolute inset-x-0 top-0 flex items-center gap-2 p-3 lg:hidden"><a class="flex size-11 items-center justify-center rounded-full bg-white/95 shadow" aria-label="بازگشت">${I('back', 'size-5')}</a><a class="ms-auto flex size-11 items-center justify-center rounded-full bg-white/95 shadow" aria-label="اشتراک">${I('share', 'size-5')}</a><a class="flex size-11 items-center justify-center rounded-full bg-white/95 shadow" aria-label="نشان کردن">${I('heart', 'size-5')}</a></div>
      <span class="absolute bottom-3 start-3 flex items-center gap-1 rounded-lg bg-neutral-900/70 px-2 text-xs leading-6 text-white">${I('camera', 'size-3.5')}۱ از ۹</span>
    </div>
    <div class="no-scrollbar flex gap-2 overflow-x-auto px-4 pt-2 lg:px-0">${thumbs}</div>
    <div class="space-y-5 px-4 pt-4 lg:px-0">
      <nav class="flex items-center gap-1 text-xs text-neutral-600">برلین ${I('chevronEnd', 'size-3')} املاک ${I('chevronEnd', 'size-3')} اجارهٔ آپارتمان</nav>
      <div class="lg:hidden"><h1 class="text-xl font-extrabold leading-9">${l.title}</h1>
        <p class="mt-1 flex flex-wrap items-baseline gap-x-2"><span class="text-2xl font-black text-brand-800">۸۷۰ €</span><span class="text-sm text-neutral-700">اجارهٔ سرد، با هزینه‌ها ${fa(1020)} €</span></p>
        <p class="mt-1 flex items-center gap-1 text-sm text-neutral-600">${I('pin', 'size-4')}ودینگ، <bdi dir="ltr">13351 Berlin</bdi>، هفتهٔ گذشته</p></div>
      <div class="grid grid-cols-2 gap-2 lg:grid-cols-4">${facts.map(([ic, t]) => `<div class="flex h-12 items-center gap-2 rounded-xl bg-neutral-50 px-3 text-sm font-bold">${I(ic, 'size-5 text-brand-700')}${t}</div>`).join('')}</div>
      <div class="lg:hidden">${safety}</div>
      <div class="lg:hidden">${seller}</div>
      <section><h2 class="mb-2 text-lg font-extrabold">توضیحات</h2><p class="text-base leading-8 text-neutral-800">آپارتمان دو اتاقه، مبله، طبقهٔ دوم با آسانسور. ۵ دقیقه تا ایستگاه Leopoldplatz. قرارداد اصلی (Hauptmietvertrag) و ثبت آدرس ممکن است. برای یک نفر یا زوج، بدون حیوان خانگی.</p></section>
      <section><h2 class="mb-1 text-lg font-extrabold">مشخصات</h2><dl class="divide-y divide-neutral-200">${details.map(([k, v]) => `<div class="flex justify-between py-3 text-[15px]"><dt class="text-neutral-600">${k}</dt><dd class="font-bold">${v}</dd></div>`).join('')}</dl></section>
      <section><h2 class="mb-3 text-lg font-extrabold">آگهی‌های مشابه</h2><div class="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 lg:mx-0 lg:grid lg:grid-cols-3 lg:px-0">${similar.map((s) => `<div class="w-44 shrink-0 lg:w-auto">${gridCard(s)}</div>`).join('')}</div></section>
      <p class="flex justify-between border-t border-neutral-200 pt-4 text-sm text-neutral-600"><span>کد آگهی: ${faDigits(375558445)}</span><a class="flex items-center gap-1">${I('flag', 'size-4')}گزارش این آگهی</a></p>
    </div>
  </div>
  <aside class="hidden lg:block"><div class="sticky top-20 space-y-4">
    <section class="space-y-3 rounded-2xl border border-neutral-200 p-5">
      <h1 class="text-xl font-extrabold leading-9">${l.title}</h1>
      <p class="flex items-baseline gap-2"><span class="text-3xl font-black text-brand-800">۸۷۰ €</span><span class="text-sm text-neutral-700">اجارهٔ سرد</span></p>
      <p class="text-sm text-neutral-700">با هزینه‌های جانبی: ${fa(1020)} €</p>
      <p class="flex items-center gap-1 text-sm text-neutral-600">${I('pin', 'size-4')}ودینگ، برلین، هفتهٔ گذشته</p>
      ${actions(true)}
      <a class="flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-bold text-neutral-700">${I('heart', 'size-4')}نشان کردن</a>
    </section>${seller}${safety}</div></aside>
</main>
<div class="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white px-4 pt-2.5 pb-4 lg:hidden">${actions(false)}</div>`);
