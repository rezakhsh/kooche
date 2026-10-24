// Category list (WG rooms): breadcrumb, scoped search, chips that show the applied values, then rows
const rows = [L.wg, L.room,
  { ...L.wg, title: 'اتاق ۱۸ متری در WG سه‌نفره، فریدریش‌هاین', price: 640, place: 'فریدریش‌هاین', ago: 'دیروز', img: '../img/room4.webp', facts: ['۱۸ متر', 'از ۱۵ نوامبر', 'Anmeldung ممکن'] },
  { ...L.wg, title: 'اتاق موقت ۳ ماهه (Zwischenmiete)، مبله', price: 520, place: 'پانکوف', ago: '۳ روز پیش', img: '../img/room7.webp', anmeldung: false, facts: ['۱۲ متر', 'دسامبر تا فوریه'] }];
mount(`${header({ search: 'جستجو در اتاق و WG برلین…' })}
<main class="mx-auto w-full max-w-6xl pb-24 lg:grid lg:grid-cols-[16rem_1fr] lg:gap-8 lg:px-6 lg:pt-6">
  <aside class="hidden lg:block">
    <section class="rounded-2xl border border-neutral-200 p-4 text-sm">
      <h2 class="mb-3 flex items-center gap-1.5 font-extrabold">${I('sliders', 'size-4 text-brand-700')}فیلترها</h2>
      ${filterFields()}
      <a class="mt-4 block rounded-xl bg-brand-700 py-3 text-center font-bold text-white">نمایش ${fa(23)} آگهی</a>
    </section>
  </aside>
  <div class="min-w-0">
    <div class="sticky top-[61px] z-20 border-b border-neutral-200 bg-white px-4 pt-3 pb-2.5 lg:static lg:border-0 lg:px-0 lg:pt-0">
      <nav class="mb-2 flex items-center gap-1 text-xs text-neutral-600">برلین ${I('chevronEnd', 'size-3')} املاک ${I('chevronEnd', 'size-3')} <b class="text-neutral-900">اتاق و WG</b></nav>
      <div class="flex h-12 items-center gap-2 rounded-xl border border-neutral-300 px-3 text-[15px] text-neutral-500 lg:hidden">${I('search', 'size-5')}جستجو در اتاق و WG…</div>
      <div class="no-scrollbar -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        ${chip('فیلترها ۲', { icon: 'sliders', on: true })}${chip('تا ۷۰۰ €', { x: true, tone: 'brand' })}${chip('Anmeldung ممکن', { x: true, tone: 'brand' })}${chip('مبله', { down: true })}${chip('محله', { down: true })}
      </div>
    </div>
    <div class="flex items-center gap-2 px-4 pt-3 pb-1 lg:px-0">
      <h1 class="min-w-0 truncate text-sm text-neutral-700 lg:text-2xl lg:font-extrabold lg:text-neutral-900"><b class="text-neutral-900">${fa(23)} آگهی</b><span class="lg:hidden"> اتاق و WG</span><span class="hidden lg:inline"> اتاق و WG در برلین</span></h1>
      <a class="ms-auto flex h-10 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-medium whitespace-nowrap">${I('sort', 'size-4')}تازه‌ترین</a>
      <a class="flex h-10 shrink-0 items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2.5 text-sm font-bold whitespace-nowrap text-brand-800">${I('bell', 'size-4')}خبرم کن</a>
    </div>
    <p class="mx-4 mt-1 flex gap-2 rounded-xl bg-saffron-50 p-2.5 text-xs leading-6 text-saffron-800 lg:mx-0">${I('alert', 'size-4 mt-1')}<span>پیش از دیدن اتاق، ودیعه یا اجاره واریز نکنید. <b>نکات اجارهٔ امن</b></span></p>
    <div class="px-4 lg:px-0">${rows.map(listCard).join('')}</div>
  </div>
</main>${bottomNav(0)}`);
function filterFields() {
  const seg = (opts, on) => `<div class="flex gap-1 rounded-xl bg-neutral-100 p-1">${opts.map((o, i) => `<span class="flex h-10 flex-1 items-center justify-center rounded-lg text-sm ${i === on ? 'bg-white font-bold shadow-sm' : 'text-neutral-700'}">${o}</span>`).join('')}</div>`;
  return `<p class="mb-1.5 font-bold text-neutral-800">اجارهٔ ماهانه</p>
    <div class="mb-1 grid grid-cols-2 gap-2"><span class="flex h-11 items-center justify-between rounded-xl border border-neutral-300 px-3 text-neutral-500">از<span>€</span></span><span class="flex h-11 items-center justify-between rounded-xl border-2 border-brand-600 px-3">۷۰۰<span class="text-neutral-500">€</span></span></div>
    <p class="mb-4 text-xs text-neutral-600">بیشتر اتاق‌های برلین: ۵۰۰ تا ۷۵۰ €</p>
    <p class="mb-1.5 font-bold text-neutral-800">ثبت آدرس (Anmeldung)</p>${seg(['فرقی نمی‌کند', 'ممکن باشد'], 1)}
    <p class="mt-4 mb-1.5 font-bold text-neutral-800">مبله</p>${seg(['فرقی نمی‌کند', 'بله', 'خیر'], 0)}
    <p class="mt-4 mb-1.5 font-bold text-neutral-800">محل</p><span class="flex h-11 items-center gap-2 rounded-xl border border-neutral-300 px-3 text-neutral-500">${I('pin', 'size-4')}کد پستی یا محله</span>
    <div class="mt-2 flex flex-wrap gap-1.5">${['۵ کیلومتر', '۱۰ کیلومتر', '۲۵ کیلومتر'].map((t, i) => `<span class="rounded-full border px-3 text-sm leading-8 ${i === 1 ? 'border-brand-600 bg-brand-50 font-bold text-brand-800' : 'border-neutral-300'}">${t}</span>`).join('')}</div>`;
}
// filters.html shows the same page with the phone's filter sheet open
if (/filters/.test(location.pathname)) {
  document.getElementById('app').insertAdjacentHTML('beforeend', sheet('فیلترها', `<div class="text-sm">${filterFields()}</div>`,
    `<div class="flex items-center gap-3"><a class="px-2 text-sm font-medium text-neutral-700">پاک کردن همه</a><a class="flex h-12 flex-1 items-center justify-center rounded-xl bg-brand-700 font-bold text-white">نمایش ${fa(23)} آگهی</a></div>`));
}
