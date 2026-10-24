// Direction B «پیدو، صیقل‌خورده»: today's look, the measured problems fixed.
// Header one row; one sticky search + one chip row; sort and view in one line; sticky contact bar.

function header({ search = 'جستجو در برلین…' } = {}) {
  return `
  <header class="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur">
    <div class="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 lg:px-6">
      <a class="flex shrink-0 items-center gap-2.5">${LOGO('size-9')}
        <span class="flex flex-col"><span class="text-xl font-black leading-none">پیدو</span>
        <span class="mt-1 hidden text-[11px] leading-none text-neutral-500 lg:block">نیازمندی‌های ایرانیان خارج از کشور</span></span></a>
      <a class="flex shrink-0 items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 py-1.5 ps-2 pe-3 text-[13px] font-medium text-neutral-700">${I('pin', 'size-4 text-brand-700')}برلین، آلمان${I('chevronDown', 'size-3')}</a>
      <form class="ms-auto hidden max-w-md flex-1 lg:block"><div class="flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-500">${I('search', 'size-4')}${search}</div></form>
      <nav class="ms-auto hidden items-center gap-1 text-sm font-medium lg:ms-0 lg:flex">
        <a class="flex items-center gap-1.5 rounded-xl px-3 py-2">${I('chat', 'size-4')}پیام‌ها</a>
        <a class="flex items-center rounded-xl px-2.5 py-2">${I('heart', 'size-[18px]')}</a>
        <a class="flex items-center gap-1.5 rounded-xl border border-neutral-200 px-3 py-2">${I('user', 'size-4')}حساب من</a>
        <a class="flex items-center gap-1.5 rounded-xl bg-brand-700 px-4 py-2 font-bold text-white">${I('plus', 'size-4')}ثبت آگهی</a>
      </nav>
      <a class="ms-auto rounded-xl p-2 text-neutral-700 lg:hidden" aria-label="نشان‌شده‌ها">${I('heart', 'size-6')}</a>
    </div>
  </header>`;
}

function bottomNav(active = 0) {
  const items = [['home', 'آگهی‌ها'], ['chat', 'پیام‌ها', 2], ['plus', 'ثبت آگهی'], ['doc', 'آگهی‌های من'], ['user', 'حساب من']];
  return `<nav class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-neutral-200 bg-white lg:hidden">${items
    .map(([ic, label, badge], i) => `<a class="flex flex-col items-center gap-1 pt-2 pb-3 text-xs ${i === active ? 'font-bold text-brand-700' : 'text-neutral-600'}">
      <span class="relative ${i === 2 ? 'rounded-xl bg-brand-700 px-3 py-0.5 text-white' : ''}">${I(ic, 'size-6')}${badge ? `<span class="absolute -top-1.5 -end-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-saffron-500 px-1 text-[10px] font-bold text-neutral-900">${fa(badge)}</span>` : ''}</span>${label}</a>`)
    .join('')}</nav>`;
}

/** Grid card: price first, two-line title without the empty band, place and time */
function gridCard(l) {
  return `<a class="relative flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white">
    <div class="relative aspect-[4/3] bg-neutral-100">${photo(l)}
      ${l.photos > 1 ? `<span class="absolute bottom-1.5 start-1.5 flex items-center gap-1 rounded-md bg-neutral-900/70 px-1.5 text-[11px] leading-5 text-white">${I('camera', 'size-3')}${fa(l.photos)}</span>` : ''}
      ${l.anmeldung ? `<span class="absolute bottom-1.5 end-1.5 rounded-md bg-white/95 px-1.5 text-[11px] font-bold leading-5 text-brand-800">Anmeldung</span>` : ''}
      <span class="absolute top-2 end-2 flex size-9 items-center justify-center rounded-full bg-white/95 text-neutral-700 shadow-sm">${I('heart', 'size-[18px]')}</span>
    </div>
    <div class="flex flex-1 flex-col gap-1 p-3">
      <p class="text-[15px] font-extrabold text-brand-800">${price(l)}${l.unit ? `<span class="ms-1 text-xs font-medium text-neutral-500">${l.unit}</span>` : ''}</p>
      <p class="line-clamp-2 text-sm font-bold leading-6 text-neutral-900">${l.title}</p>
      <p class="mt-auto flex items-center gap-1 pt-1 text-xs text-neutral-600">${I('pin', 'size-3.5')}${l.place}، ${l.ago}</p>
    </div></a>`;
}

/** List card: photo at the start, facts line, verified mark */
function listCard(l) {
  return `<a class="flex gap-3 border-b border-neutral-200 py-3">
    <div class="relative aspect-[4/3] w-32 shrink-0 overflow-hidden rounded-xl bg-neutral-100 lg:w-44">${photo(l)}
      ${l.photos > 1 ? `<span class="absolute bottom-1 start-1 flex items-center gap-1 rounded-md bg-neutral-900/70 px-1.5 text-[11px] leading-5 text-white">${I('camera', 'size-3')}${fa(l.photos)}</span>` : ''}</div>
    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
      <p class="line-clamp-2 text-sm font-bold leading-6">${l.title}</p>
      <p class="text-[15px] font-extrabold text-brand-800">${price(l)}${l.unit ? `<span class="ms-1 text-xs font-medium text-neutral-500">${l.unit}</span>` : ''}</p>
      <p class="truncate text-xs text-neutral-600">${l.facts.join('، ')}</p>
      <p class="mt-auto flex items-center gap-1 text-xs text-neutral-600">${I('pin', 'size-3.5')}${l.place}، ${l.ago}</p>
    </div>
    <span class="flex size-9 shrink-0 items-center justify-center self-start rounded-full border border-neutral-200 text-neutral-600">${I('heart', 'size-[18px]')}</span>
  </a>`;
}

function photo(l, cls = 'size-full object-cover') {
  if (l.img) return `<img src="${l.img}" alt="" class="${cls}">`;
  return `<div class="flex size-full flex-col items-center justify-center gap-1 bg-brand-50 text-brand-700"><span class="text-lg font-black">${l.tile}</span><span class="text-[11px] text-brand-800">بدون عکس</span></div>`;
}

function chip(text, { on = false, icon = null, x = false, tone = '' } = {}) {
  const base = on ? 'border-neutral-900 bg-neutral-900 text-white' : tone === 'saffron' ? 'border-saffron-100 bg-saffron-50 text-saffron-700' : tone === 'brand' ? 'border-brand-200 bg-brand-50 text-brand-800' : 'border-neutral-300 bg-white text-neutral-800';
  return `<a class="flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium whitespace-nowrap ${base}">${icon ? I(icon, 'size-4') : ''}${text}${x ? I('close', 'size-3.5') : ''}</a>`;
}
