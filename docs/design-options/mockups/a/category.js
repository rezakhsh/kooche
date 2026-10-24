// A: category list: scoped search, one chip row (filters with count, then one chip per filter, sort last)
const rows = [L.wg,
  { ...L.wg, title: 'اتاق ۱۸ متری در WG سه‌نفره، فریدریش‌هاین', price: 640, place: 'فریدریش‌هاین', ago: 'دیروز', img: '../img/room4.webp', facts: ['۱۸ متر', 'از ۱۵ نوامبر', 'Anmeldung ممکن'] },
  { ...L.room, title: 'اتاق در آپارتمان دو نفره، نزدیک Leopoldplatz', price: 610, unit: 'گرم، ماهانه', ago: '۳ روز پیش', img: '../img/room1.webp', facts: ['۱۶ متر', 'مبله', 'Anmeldung ممکن'] },
  { ...L.wg, title: 'اتاق موقت ۳ ماهه (Zwischenmiete)، مبله', price: 520, place: 'پانکوف', ago: '۴ روز پیش', img: '../img/room7.webp', anmeldung: false, facts: ['۱۲ متر', 'دسامبر تا فوریه'] }];
mount(`${header({ q: 'جستجو در اتاق و WG', back: true })}
<div class="sticky top-[61px] z-20 border-b border-neutral-200 bg-white lg:static lg:mx-auto lg:max-w-6xl lg:border-0 lg:px-6">
  <div class="no-scrollbar flex gap-2 overflow-x-auto px-4 py-2.5 lg:px-0">
    ${chip('فیلترها ۲', { icon: 'sliders', on: true })}${chip('اتاق و WG', { on: true, down: true })}${chip('تا ۷۰۰ €', { on: true, down: true })}${chip('Anmeldung ممکن', { on: true })}${chip('محله', { down: true })}${chip('مبله')}${chip('عکس‌دار')}${chip('تازه‌ترین', { icon: 'sort', down: true })}
  </div>
</div>
<main class="mx-auto w-full max-w-6xl px-4 pb-24 lg:px-6">
  <div class="flex items-center justify-between py-3"><h1 class="text-sm text-neutral-600"><b class="text-neutral-900">${fa(23)} آگهی</b> اتاق و WG در برلین</h1>
  <a class="flex h-9 items-center gap-1 rounded-full border border-neutral-300 px-3 text-sm font-medium text-neutral-800">${I('bell', 'size-4')}خبرم کن</a></div>
  <div class="lg:grid lg:grid-cols-2 lg:gap-4">${rows.map((l, i) => row(l, { first: i === 0 })).join('')}</div>
</main>${bottomNav(1)}`);
