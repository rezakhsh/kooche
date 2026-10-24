// C: category list: title with the count, the search pill, filter chips, one large card per row
const rows = [L.wg,
  { ...L.wg, title: 'اتاق ۱۸ متری در WG سه‌نفره، فریدریش‌هاین', price: 640, place: 'فریدریش‌هاین', ago: 'دیروز', img: '../img/room4.webp' },
  { ...L.room, title: 'اتاق در آپارتمان دو نفره، نزدیک Leopoldplatz', price: 610, ago: '۳ روز پیش', img: '../img/room1.webp' }];
const chipC = (t, on, ic) => `<a class="flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold whitespace-nowrap ${on ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-800 ring-1 ring-neutral-300'}">${ic ? I(ic, 'size-4') : ''}${t}</a>`;
mount(`${deskHeader()}
<div class="min-h-screen bg-page pb-28">
<div class="sticky top-0 z-20 bg-page/95 px-4 pt-3 pb-3 backdrop-blur lg:static lg:mx-auto lg:max-w-6xl lg:px-6 lg:pt-8">
  <div class="flex items-center gap-2"><a class="flex size-11 items-center justify-center rounded-full bg-white ring-1 ring-neutral-200 lg:hidden">${I('back', 'size-5')}</a>
  <div class="flex-1"><h1 class="text-xl font-black lg:text-3xl">اتاق و WG در برلین</h1><p class="text-xs text-neutral-600 lg:text-sm">${fa(23)} آگهی، ${fa(17)} با Anmeldung</p></div>
  <a class="flex size-11 items-center justify-center rounded-full bg-white text-brand-800 ring-1 ring-neutral-200" aria-label="خبرم کن">${I('bell', 'size-5')}</a></div>
  <div class="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">${chipC('فیلترها ۲', true, 'sliders')}${chipC('Anmeldung ممکن', true, 'stamp')}${chipC('تا ۷۰۰ €', true)}${chipC('مبله')}${chipC('از دسامبر')}${chipC('محله')}</div>
</div>
<main class="mx-auto grid max-w-6xl gap-6 px-4 pt-2 lg:grid-cols-3 lg:px-6">
  ${rows.map((l) => `<a class="block">
    <div class="relative aspect-[4/3] overflow-hidden rounded-[22px]">${photo(l)}
      <span class="absolute top-3 start-3 flex items-center gap-1 rounded-full bg-white/95 px-2.5 text-xs font-bold leading-7 text-brand-800">${I('stamp', 'size-3.5')}Anmeldung ممکن</span>
      <span class="absolute top-3 end-3 flex size-10 items-center justify-center rounded-full bg-white/90">${I('heart', 'size-5')}</span>
      <span class="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">${[1, 2, 3, 4, 5].map((i) => `<i class="size-1.5 rounded-full ${i === 1 ? 'bg-white' : 'bg-white/55'}"></i>`).join('')}</span></div>
    <div class="mt-2.5 flex items-start gap-3"><div class="min-w-0 flex-1"><p class="text-base font-extrabold leading-7">${l.title}</p><p class="text-sm text-neutral-600">${l.place}، ${l.facts.slice(0, 2).join('، ')}</p></div>
    <p class="shrink-0 text-end"><b class="text-lg font-black">${fa(l.price)} €</b><span class="block text-xs text-neutral-500">ماهانه، گرم</span></p></div></a>`).join('')}
</main></div>${bottomNav(1)}`);
