// B: listing page: phone keeps the photo-first page but a sticky contact bar replaces the bottom
// bar; computer puts title, price and contact beside a shorter photo, all above the fold
const l = L.room;
const thumbs = [2, 3, 4, 5, 6].map((n) => `<img src="../img/room${n}.webp" class="aspect-square w-16 shrink-0 rounded-lg object-cover lg:w-20" alt="">`).join('');
const facts = [['ruler', '۶۵ متر'], ['door', '۲ اتاق'], ['stamp', 'Anmeldung ممکن'], ['calendar', 'از ۱ دسامبر']];
const sellerBox = `<section class="rounded-2xl border border-neutral-200 p-4">
  <div class="flex items-center gap-3"><span class="flex size-11 items-center justify-center rounded-full bg-saffron-50 text-lg font-extrabold text-saffron-700">آ</span>
  <div class="min-w-0"><p class="font-bold">${l.seller}</p><p class="text-xs text-neutral-600">عضو از ${l.since}، معمولاً در چند ساعت جواب می‌دهد</p></div></div>
  <p class="mt-3 flex items-center gap-1.5 text-xs font-medium text-brand-800">${I('shield', 'size-4')}شماره تلفن تأیید شده</p></section>`;
const actions = `<div class="flex gap-2"><a class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-700 py-3 font-bold text-white">${I('chat', 'size-5')}گفتگو با آگهی‌دهنده</a>
  <a class="flex items-center justify-center rounded-xl border border-neutral-300 px-4 text-neutral-800" aria-label="نمایش شماره">${I('phone', 'size-5')}</a>
  <a class="flex items-center justify-center rounded-xl border border-neutral-300 px-4 text-neutral-800" aria-label="نشان کردن">${I('heart', 'size-5')}</a></div>`;
const safety = `<p class="flex gap-2 rounded-xl bg-saffron-50 p-3 text-xs leading-6 text-saffron-800">${I('alert', 'size-4 mt-1')}<span><b>پیش از دیدن خانه و امضای قرارداد، هیچ پولی (Kaution) واریز نکنید.</b> کلید پستی و «صاحب‌خانهٔ خارج از کشور» نشانهٔ کلاهبرداری است.</span></p>`;
mount(`${header()}
<main class="mx-auto w-full max-w-6xl pb-28 lg:grid lg:grid-cols-[1fr_22rem] lg:gap-8 lg:px-6 lg:pt-6">
  <div class="min-w-0">
    <div class="relative aspect-[4/3] bg-neutral-900 lg:aspect-[16/10] lg:max-h-[440px] lg:overflow-hidden lg:rounded-2xl">
      <img src="../img/room1.webp" class="size-full object-cover" alt="">
      <span class="absolute bottom-3 start-3 flex items-center gap-1 rounded-lg bg-neutral-900/70 px-2 py-0.5 text-xs text-white">${I('camera', 'size-3.5')}۱ از ۹</span>
    </div>
    <div class="no-scrollbar flex gap-2 overflow-x-auto px-4 pt-2 lg:px-0">${thumbs}</div>
    <div class="space-y-4 px-4 pt-4 lg:px-0">
      <nav class="flex items-center gap-1 text-xs text-neutral-600">برلین ${I('chevronEnd', 'size-3')} املاک ${I('chevronEnd', 'size-3')} اجاره آپارتمان</nav>
      <div class="lg:hidden"><h1 class="text-xl font-extrabold leading-9">${l.title}</h1>
        <p class="mt-1 flex items-baseline gap-2"><span class="text-2xl font-black text-brand-800">${price(l)}</span><span class="text-sm text-neutral-600">اجاره سرد، گرم ${fa(1020)} €</span></p>
        <p class="mt-1 flex items-center gap-1 text-xs text-neutral-600">${I('pin', 'size-3.5')}ودینگ، 13351 Berlin، هفتهٔ گذشته</p></div>
      <div class="grid grid-cols-2 gap-2 lg:grid-cols-4">${facts.map(([ic, t]) => `<div class="flex items-center gap-2 rounded-xl bg-neutral-50 px-3 py-2.5 text-sm font-medium">${I(ic, 'size-5 text-brand-700')}${t}</div>`).join('')}</div>
      <div class="lg:hidden">${safety}</div>
      <div class="lg:hidden">${sellerBox}</div>
      <section><h2 class="mb-2 font-extrabold">توضیحات</h2><p class="text-[15px] leading-8 text-neutral-800">آپارتمان دو اتاقه، مبله، طبقهٔ دوم با آسانسور. ۵ دقیقه تا ایستگاه Leopoldplatz. قرارداد اصلی (Hauptmietvertrag) و ثبت آدرس ممکن است. برای یک نفر یا زوج، بدون حیوان خانگی.</p></section>
    </div>
  </div>
  <aside class="hidden lg:block"><div class="sticky top-20 space-y-4">
    <section class="space-y-3 rounded-2xl border border-neutral-200 p-5">
      <h1 class="text-xl font-extrabold leading-9">${l.title}</h1>
      <p class="flex items-baseline gap-2"><span class="text-3xl font-black text-brand-800">${price(l)}</span><span class="text-sm text-neutral-600">اجاره سرد</span></p>
      <p class="text-sm text-neutral-700">اجاره گرم (با هزینه‌های جانبی): ${fa(1020)} €</p>
      <p class="flex items-center gap-1 text-xs text-neutral-600">${I('pin', 'size-3.5')}ودینگ، 13351 Berlin، هفتهٔ گذشته</p>
      ${actions}
    </section>${sellerBox}${safety}</div></aside>
</main>
<div class="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white px-4 pt-2.5 pb-4 lg:hidden">${actions}</div>`);
