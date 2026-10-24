// C: listing page (Airbnb-like): the photo, a rounded sheet with title and highlights, the seller as
// a "host" card, then details; a price bar with «پیام بده» at the bottom. Computer: a photo mosaic
// and a sticky price card beside the details.
const l = L.wg;
const hl = [['stamp', 'Anmeldung ممکن', 'Untermietvertrag با ثبت آدرس'], ['sofa', 'مبله', 'تخت، کمد، میز'], ['calendar', 'از ۱ دسامبر', 'حداقل ۶ ماه'], ['ruler', '۱۴ متر', 'در آپارتمان ۷۰ متری']];
const host = `<div class="flex items-center gap-3 rounded-[20px] bg-page p-4"><span class="flex size-12 items-center justify-center rounded-full bg-saffron-100 text-lg font-black text-saffron-800">م</span>
  <div class="flex-1"><b class="block">${l.seller}</b><span class="text-xs text-neutral-600">عضو از شهریور ۱۴۰۵، معمولاً در ۲ ساعت جواب می‌دهد</span></div>
  <span class="flex items-center gap-1 rounded-full bg-white px-2.5 text-xs font-bold leading-7 text-brand-800">${I('shield', 'size-3.5')}تأیید شده</span></div>`;
const priceCard = `<div class="rounded-[24px] bg-white p-5 shadow-lg ring-1 ring-neutral-200"><p><b class="text-3xl font-black">۵۹۰ €</b> <span class="text-neutral-600">ماهانه، گرم</span></p><p class="mt-1 text-sm text-neutral-600">ودیعه (Kaution): ۱٬۱۸۰ €</p>
  <a class="mt-4 flex h-12 items-center justify-center gap-2 rounded-full bg-brand-700 font-extrabold text-white">${I('chat', 'size-5')}پیام بده</a><a class="mt-2 flex h-12 items-center justify-center gap-2 rounded-full font-bold text-brand-800 ring-1 ring-brand-200">${I('phone', 'size-5')}نمایش شماره</a>
  <p class="mt-3 text-center text-xs text-neutral-500">تا خانه را ندیده‌اید پولی واریز نکنید</p></div>`;
mount(`${deskHeader()}
<div class="min-h-screen bg-white pb-28">
<div class="relative lg:mx-auto lg:max-w-6xl lg:px-6 lg:pt-6">
  <div class="absolute inset-x-0 top-0 z-10 flex justify-between p-3 lg:hidden"><a class="flex size-11 items-center justify-center rounded-full bg-white/95 shadow">${I('back', 'size-5')}</a><span class="flex gap-2"><a class="flex size-11 items-center justify-center rounded-full bg-white/95 shadow">${I('share', 'size-5')}</a><a class="flex size-11 items-center justify-center rounded-full bg-white/95 shadow">${I('heart', 'size-5')}</a></span></div>
  <div class="aspect-[4/3.3] lg:hidden"><img src="../img/room5.webp" class="size-full object-cover" alt=""></div>
  <div class="hidden h-[380px] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-[24px] lg:grid"><img src="../img/room5.webp" class="col-span-2 row-span-2 size-full object-cover" alt="">${[4, 3, 1, 2].map((n) => `<img src="../img/room${n}.webp" class="size-full object-cover" alt="">`).join('')}</div>
</div>
<main class="relative -mt-6 rounded-t-[28px] bg-white px-5 pt-6 lg:mx-auto lg:mt-0 lg:grid lg:max-w-6xl lg:grid-cols-[1fr_22rem] lg:gap-12 lg:px-6 lg:pt-8">
  <div class="min-w-0">
    <p class="text-sm font-semibold text-brand-800">اتاق و WG، نویکلن، برلین</p>
    <h1 class="mt-1 text-2xl font-black leading-[1.5] lg:text-3xl">${l.title}</h1>
    <p class="mt-1 text-sm text-neutral-600">۲ ساعت پیش، ${fa(6)} عکس</p>
    <ul class="mt-5 grid grid-cols-2 gap-3">${hl.map(([ic, t, s]) => `<li class="flex gap-2.5 rounded-2xl border border-neutral-200 p-3"><span class="text-brand-700">${I(ic, 'size-6', 1.75)}</span><span><b class="block text-sm">${t}</b><span class="text-xs text-neutral-600">${s}</span></span></li>`).join('')}</ul>
    <div class="mt-5">${host}</div>
    <h2 class="mt-6 text-lg font-extrabold">دربارهٔ این اتاق</h2>
    <p class="mt-2 text-[15px] leading-8 text-neutral-800">اتاق مبله در آپارتمان سه‌نفره، ۳ دقیقه تا U-Bahn Hermannplatz. هم‌خانه‌ها دانشجو و فارسی‌زبان هستند.</p>
  </div>
  <aside class="hidden lg:block"><div class="sticky top-6">${priceCard}</div></aside>
</main></div>
<div class="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-neutral-200 bg-white px-5 pt-3 pb-4 lg:hidden">
  <p class="flex-1"><b class="text-xl font-black">۵۹۰ €</b> <span class="text-sm text-neutral-600">ماهانه</span><span class="block text-xs text-neutral-500">ودیعه ۱٬۱۸۰ €</span></p>
  <a class="flex h-12 items-center justify-center rounded-full border border-neutral-300 px-4" aria-label="نمایش شماره">${I('phone', 'size-5')}</a>
  <a class="flex h-12 items-center gap-2 rounded-full bg-brand-700 px-6 font-extrabold text-white">${I('chat', 'size-5')}پیام بده</a></div>`);
