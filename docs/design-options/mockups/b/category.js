// B: category list (WG rooms in Berlin): scoped search, filter chips that show what is applied
const rows = ['wg', 'room'].map((k) => L[k]).concat([
  { ...L.wg, title: 'اتاق ۱۸ متری در WG سه‌نفره، فریدریش‌هاین', price: 640, place: 'فریدریش‌هاین', ago: 'دیروز', img: '../img/room4.webp', facts: ['۱۸ متر', 'از ۱۵ نوامبر', 'Anmeldung ممکن'] },
  { ...L.wg, title: 'اتاق موقت ۳ ماهه (Zwischenmiete)، مبله', price: 520, place: 'پانکوف', ago: '۳ روز پیش', img: '../img/room7.webp', anmeldung: false, facts: ['۱۲ متر', 'دسامبر تا فوریه'] },
]);
mount(`${header({ search: 'جستجو در اتاق و WG برلین…' })}
<main class="mx-auto w-full max-w-6xl pb-24 lg:grid lg:grid-cols-[16rem_1fr] lg:gap-8 lg:px-6 lg:pt-6">
  <aside class="hidden lg:block">
    <section class="rounded-2xl border border-neutral-200 p-4 text-sm">
      <h2 class="mb-3 flex items-center gap-1.5 font-extrabold">${I('sliders', 'size-4 text-brand-700')}فیلترها</h2>
      <p class="mb-1 font-medium text-neutral-700">اجاره ماهانه (€)</p>
      <div class="mb-4 grid grid-cols-2 gap-2"><span class="rounded-xl border border-neutral-300 px-3 py-2 text-neutral-500">از</span><span class="rounded-xl border border-brand-600 px-3 py-2">۷۰۰</span></div>
      <p class="mb-1 font-medium text-neutral-700">محل</p>
      <div class="mb-4 rounded-xl border border-neutral-300 px-3 py-2">کد پستی یا محله</div>
      <label class="mb-2 flex items-center gap-2"><span class="flex size-5 items-center justify-center rounded bg-brand-700 text-white">${I('check', 'size-3.5', 3)}</span>Anmeldung ممکن</label>
      <label class="mb-2 flex items-center gap-2"><span class="size-5 rounded border border-neutral-400"></span>مبله</label>
      <label class="mb-4 flex items-center gap-2"><span class="size-5 rounded border border-neutral-400"></span>فقط با عکس</label>
      <a class="block rounded-xl bg-brand-700 py-2.5 text-center font-bold text-white">نمایش ${fa(23)} آگهی</a>
    </section>
  </aside>
  <div class="min-w-0">
    <div class="sticky top-[57px] z-20 border-b border-neutral-200 bg-white px-4 pt-3 pb-2.5 lg:static lg:border-0 lg:px-0 lg:pt-0">
      <nav class="mb-2 flex items-center gap-1 text-xs text-neutral-600">برلین ${I('chevronEnd', 'size-3')} املاک ${I('chevronEnd', 'size-3')} <b class="text-neutral-900">اتاق و WG</b></nav>
      <div class="flex items-center gap-2 rounded-xl border border-neutral-300 px-3 py-2.5 text-[15px] text-neutral-500 lg:hidden">${I('search', 'size-5')}جستجو در اتاق و WG…</div>
      <div class="no-scrollbar -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        ${chip('فیلترها ۲', { icon: 'sliders', on: true })}${chip('تا ۷۰۰ €', { x: true, tone: 'brand' })}${chip('Anmeldung ممکن', { x: true, tone: 'brand' })}${chip('مبله')}${chip('محله')}
      </div>
    </div>
    <div class="flex items-center gap-2 px-4 pt-3 pb-1 lg:px-0">
      <h1 class="text-base font-extrabold lg:text-2xl">اتاق و WG در برلین</h1><span class="text-sm text-neutral-500">${fa(23)} آگهی</span>
      <a class="ms-auto flex items-center gap-1 text-sm font-medium text-neutral-700">${I('sort', 'size-4')}تازه‌ترین</a>
      <a class="rounded-lg border border-brand-200 bg-brand-50 p-1.5 text-brand-700" aria-label="ذخیره جستجو">${I('bell', 'size-4')}</a>
    </div>
    <div class="px-4 lg:px-0">${rows.map(listCard).join('')}</div>
  </div>
</main>${bottomNav(0)}`);
