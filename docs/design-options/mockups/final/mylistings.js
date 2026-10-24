// My listings: compact rows with what matters (status, days left, views, saves, chats), one
// action that fits the moment (renew when it is running out, else boost) and ⋯ for the rest.
// mylistings.html#menu shows the ⋯ sheet open.
const rows = [
  { ...L.room, status: ['منتشر شده', 'bg-green-50 text-green-800'], left: '۲۳ روز مانده', stats: [['۱۸۴', 'بازدید'], ['۹', 'نشان'], ['۴', 'گفتگو']], act: 'اجاره داده شد' },
  { ...L.rug, status: ['منتشر شده', 'bg-green-50 text-green-800'], left: '۳ روز مانده', warn: true, stats: [['۶۲', 'بازدید'], ['۲', 'نشان'], ['۱', 'گفتگو']], act: 'تمدید رایگان' },
  { ...L.desk, status: ['پیش‌نویس', 'bg-saffron-50 text-saffron-800'], left: 'هنوز منتشر نشده', stats: [], act: 'ادامهٔ ثبت' },
];
const card = (r) => `<li class="flex gap-3 border-b border-neutral-200 py-3.5">
  <img src="${r.img}" class="aspect-square w-20 shrink-0 rounded-xl object-cover lg:w-24" alt="">
  <div class="min-w-0 flex-1">
    <p class="truncate text-[15px] font-bold">${r.title}</p>
    <p class="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs"><span class="rounded-full px-2 font-bold leading-6 ${r.status[1]}">${r.status[0]}</span><span class="${r.warn ? 'font-bold text-red-700' : 'text-neutral-600'}">${r.left}</span></p>
    ${r.stats.length ? `<p class="mt-1 text-xs text-neutral-700">${r.stats.map(([n, t]) => `<b>${n}</b> ${t}`).join('، ')}</p>` : ''}
    <div class="mt-2 flex gap-2"><a class="flex h-10 items-center rounded-lg bg-brand-700 px-3.5 text-sm font-bold whitespace-nowrap text-white">${r.act}</a><a class="flex h-10 items-center rounded-lg border border-neutral-300 px-3.5 text-sm font-bold">ویرایش</a><a class="flex h-10 items-center gap-1 rounded-lg border border-neutral-300 px-3 text-sm font-bold">بیشتر${I('more', 'size-4')}</a></div>
  </div></li>`;
mount(`${header()}
<main class="mx-auto w-full max-w-3xl px-4 pt-5 pb-24">
  <div class="flex items-center justify-between"><h1 class="text-2xl font-extrabold">آگهی‌های من</h1><a class="flex h-11 items-center gap-1.5 rounded-xl bg-brand-700 px-4 text-sm font-bold text-white">${I('plus', 'size-4')}آگهی تازه</a></div>
  <div class="no-scrollbar mt-4 flex gap-2 overflow-x-auto">${chip('همه ۳', { on: true })}${chip('منتشر شده ۲')}${chip('پیش‌نویس ۱')}${chip('متوقف')}${chip('فروخته شده')}</div>
  <ul class="mt-2">${rows.map(card).join('')}</ul>
</main>${bottomNav(3)}`);
if (location.hash === '#menu' || /menu/.test(location.pathname)) {
  document.getElementById('app').insertAdjacentHTML('beforeend', sheet('اجاره خانه در ودینگ', `<ul class="divide-y divide-neutral-100">${[['arrow-up', 'ارتقا: بالای فهرست از ۱٫۹۹ €', 'font-bold text-saffron-800'], ['pin', 'دیدن آگهی'], ['share', 'اشتراک در تلگرام یا واتس‌اپ'], ['clock', 'توقف موقت'], ['trash', 'حذف آگهی', 'text-red-700']].map(([ic, t, c]) => `<li class="flex h-14 items-center gap-3 text-base ${c || ''}">${I(ic, 'size-5')}${t}</li>`).join('')}</ul>`));
}
