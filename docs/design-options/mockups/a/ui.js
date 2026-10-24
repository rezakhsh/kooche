// Direction A «آشنا»: Divar's structure (what users already know) in Peydoo's colours.
// Search + city in the header, a category grid on the city page, one-column list with the photo
// at the end side, a filter chip row, a two-button contact bar, and «پیدوی من» in the bottom bar.

function header({ q = 'جستجو در همهٔ آگهی‌ها', back = false } = {}) {
  return `
  <header class="sticky top-0 z-30 border-b border-neutral-200 bg-white">
    <div class="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2 lg:gap-4 lg:px-6 lg:py-3">
      ${back ? `<a class="flex size-11 shrink-0 items-center justify-center text-neutral-800 lg:hidden" aria-label="بازگشت">${I('back', 'size-6')}</a>` : `<a class="shrink-0 lg:hidden">${LOGO('size-9')}</a>`}
      <a class="hidden shrink-0 items-center gap-2 lg:flex">${LOGO('size-10')}<span class="text-2xl font-black">پیدو</span></a>
      <a class="hidden h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-neutral-800 lg:flex">${I('pin', 'size-5 text-brand-700')}برلین</a>
      <div class="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg bg-neutral-100 px-3 text-[15px] text-neutral-500 lg:max-w-xl">${I('search', 'size-5')}<span class="truncate">${q}</span></div>
      <a class="flex h-11 shrink-0 items-center gap-1 rounded-lg border border-neutral-200 px-2.5 text-sm font-medium text-neutral-800 lg:hidden">${I('pin', 'size-4 text-brand-700')}برلین</a>
      <nav class="ms-auto hidden items-center gap-1 text-sm font-medium text-neutral-700 lg:flex">
        <a class="flex h-11 items-center gap-1.5 rounded-lg px-3">${I('user', 'size-5')}پیدوی من</a>
        <a class="flex h-11 items-center gap-1.5 rounded-lg px-3">${I('chat', 'size-5')}پیام‌ها</a>
        <a class="flex h-11 items-center rounded-lg bg-brand-700 px-5 font-bold text-white">ثبت آگهی</a>
      </nav>
    </div>
  </header>`;
}

function bottomNav(active = 0) {
  const items = [['home', 'آگهی‌ها'], ['grid', 'دسته‌ها'], ['plus', 'ثبت آگهی'], ['chat', 'پیام‌ها', 2], ['user', 'پیدوی من']];
  return `<nav class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-neutral-200 bg-white lg:hidden">${items
    .map(([ic, label, badge], i) => `<a class="flex flex-col items-center gap-1 pt-2 pb-3 text-xs ${i === active ? 'font-bold text-brand-700' : 'text-neutral-600'}">
      <span class="relative ${i === 2 ? 'flex size-7 items-center justify-center rounded-full border-2 border-current' : ''}">${I(ic, i === 2 ? 'size-4' : 'size-6', i === 2 ? 3 : 2)}${badge ? `<span class="absolute -top-1.5 -end-2.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-700 px-1 text-xs font-bold text-white">${fa(badge)}</span>` : ''}</span>${label}</a>`)
    .join('')}</nav>`;
}

/** Divar-style row: text at the start, square photo at the end, a hairline between rows */
function row(l, { first = false } = {}) {
  return `<a class="flex gap-3 ${first ? '' : 'border-t'} border-neutral-200 py-4 lg:rounded-lg lg:border lg:p-3">
    <div class="flex min-w-0 flex-1 flex-col">
      <p class="line-clamp-2 text-base font-semibold leading-7 text-neutral-900">${l.title}</p>
      <p class="mt-1 truncate text-sm text-neutral-600">${l.facts.join('، ')}</p>
      <p class="mt-auto pt-2 text-[15px] font-bold text-neutral-900">${price(l)}${l.unit ? `<span class="ms-1 text-xs font-medium text-neutral-500">${l.unit}</span>` : ''}</p>
      <p class="text-xs text-neutral-500">${l.ago} در ${l.place}${l.business ? '، <span class="font-medium text-brand-800">کسب‌وکار</span>' : ''}</p>
    </div>
    <div class="relative size-[124px] shrink-0 overflow-hidden rounded-lg bg-neutral-100">${photo(l)}
      ${l.verified ? `<span class="absolute top-1.5 start-1.5 flex items-center gap-0.5 rounded bg-white/95 px-1.5 text-xs font-bold leading-5 text-brand-800">${I('verified', 'size-3.5')}احراز شده</span>` : ''}
      ${l.anmeldung ? `<span class="absolute bottom-1.5 start-1.5 rounded bg-white/95 px-1.5 text-xs font-bold leading-5 text-brand-800">Anmeldung</span>` : ''}
      ${l.photos > 1 ? `<span class="absolute bottom-1.5 end-1.5 flex items-center gap-0.5 rounded bg-neutral-900/70 px-1 text-xs leading-5 text-white">${I('camera', 'size-3')}${fa(l.photos)}</span>` : ''}
    </div>
  </a>`;
}

function photo(l, cls = 'size-full object-cover') {
  if (l.img) return `<img src="${l.img}" alt="" class="${cls}">`;
  return `<div class="flex size-full items-center justify-center bg-neutral-100 text-neutral-400">${I('image', 'size-8')}</div>`;
}

function chip(text, { on = false, icon = null, down = false } = {}) {
  return `<a class="flex h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-sm whitespace-nowrap ${on ? 'border-brand-700 bg-brand-50 font-bold text-brand-800' : 'border-neutral-300 text-neutral-800'}">${icon ? I(icon, 'size-4') : ''}${text}${down ? I('chevronDown', 'size-3.5') : ''}</a>`;
}
