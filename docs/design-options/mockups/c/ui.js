// Direction C «محله»: a city hub. Home shows what Berlin's Iranians look for (rooms, work, Persian-
// speaking services, events); search opens as one pill; big photo cards; Airbnb-style listing page
// with a price bar; photo-first posting with a suggested category.

function bottomNav(active = 0) {
  const items = [['home', 'خانه'], ['search', 'جستجو'], ['plus', 'ثبت آگهی'], ['chat', 'پیام‌ها', 2], ['user', 'من']];
  return `<nav class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-neutral-200 bg-white lg:hidden">${items
    .map(([ic, label, badge], i) => i === 2
      ? `<a class="flex flex-col items-center gap-1 pb-3 text-xs font-bold text-neutral-900"><span class="-mt-5 flex size-14 items-center justify-center rounded-full bg-saffron-500 text-neutral-900 shadow-lg ring-4 ring-white">${I('plus', 'size-7', 2.5)}</span>${label}</a>`
      : `<a class="flex flex-col items-center gap-1 pt-2.5 pb-3 text-xs ${i === active ? 'font-bold text-brand-800' : 'text-neutral-600'}"><span class="relative">${I(ic, 'size-6')}${badge ? `<span class="absolute -top-1.5 -end-2.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-saffron-500 px-1 text-xs font-bold text-neutral-900">${fa(badge)}</span>` : ''}</span>${label}</a>`)
    .join('')}</nav>`;
}

function deskHeader() {
  return `<header class="hidden border-b border-neutral-200 bg-white lg:block"><div class="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
    <a class="flex items-center gap-2">${LOGO('size-10')}<span class="text-2xl font-black">پیدو</span></a>
    <a class="flex h-10 items-center gap-1 rounded-full bg-page px-4 text-sm font-semibold">${I('pin', 'size-4 text-brand-700')}برلین${I('chevronDown', 'size-3.5')}</a>
    <div class="flex h-11 flex-1 items-center gap-2 rounded-full border border-neutral-200 px-4 text-sm text-neutral-500 shadow-sm">${I('search', 'size-5 text-brand-700')}اتاق، خودرو، مترجم، کلاس آلمانی…</div>
    <a class="flex h-10 items-center gap-1.5 px-2 text-sm font-medium">${I('chat', 'size-5')}پیام‌ها</a>
    <a class="flex h-10 items-center gap-1.5 px-2 text-sm font-medium">${I('heart', 'size-5')}نشان‌ها</a>
    <a class="flex h-11 items-center gap-1.5 rounded-full bg-saffron-500 px-5 text-sm font-extrabold text-neutral-900">${I('plus', 'size-4', 2.5)}ثبت آگهی رایگان</a>
    <span class="flex size-10 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-800">س</span>
  </div></header>`;
}

function photo(l, cls = 'size-full object-cover') {
  if (l.img) return `<img src="${l.img}" alt="" class="${cls}">`;
  return `<div class="girih flex size-full flex-col items-center justify-center gap-1 text-white"><span class="text-xl font-black">${l.tile}</span><span class="text-xs text-brand-100">${l.business || l.cat}</span></div>`;
}

/** Big photo card: square photo, price as a saffron pill on the photo, title and place below */
function card(l, cls = '') {
  return `<a class="block ${cls}">
    <div class="relative aspect-square overflow-hidden rounded-[20px] bg-neutral-100">${photo(l)}
      <span class="absolute bottom-2.5 start-2.5 rounded-full bg-saffron-500 px-3 text-sm font-extrabold leading-7 text-neutral-900">${price(l)}</span>
      <span class="absolute top-2.5 end-2.5 flex size-9 items-center justify-center rounded-full bg-white/90 text-neutral-800">${I('heart', 'size-5')}</span>
      ${l.anmeldung ? `<span class="absolute top-2.5 start-2.5 flex items-center gap-1 rounded-full bg-white/95 px-2.5 text-xs font-bold leading-6 text-brand-800">${I('stamp', 'size-3.5')}Anmeldung</span>` : ''}
      ${l.verified ? `<span class="absolute top-2.5 start-2.5 flex items-center gap-1 rounded-full bg-white/95 px-2.5 text-xs font-bold leading-6 text-brand-800">${I('verified', 'size-3.5')}تأیید شده</span>` : ''}
    </div>
    <p class="mt-2 line-clamp-2 text-[15px] font-bold leading-6">${l.title}</p>
    <p class="mt-0.5 text-[13px] text-neutral-600">${l.place}، ${l.ago}</p>
  </a>`;
}

function section(title, more, body) {
  return `<section class="mt-7"><div class="mb-3 flex items-baseline justify-between px-4 lg:px-0"><h2 class="text-lg font-extrabold">${title}</h2>${more ? `<a class="text-sm font-bold text-brand-800">${more}</a>` : ''}</div>${body}</section>`;
}
