// Final design «پیدو، صیقل‌خورده»: today's look, made easier to use. Shared parts of the mockups.
// Rules kept everywhere: prices «۸۷۰ €», «،» between facts (never «·» next to digits), nothing
// under 12px, 44px touch targets, the bottom bar only on browsing pages.

/** Brand header on browsing pages: logo, the city, saved items; on computers the search and actions */
function header({ search = 'جستجو در برلین…', place = 'برلین' } = {}) {
  return `
  <header class="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur">
    <div class="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 lg:px-6">
      <a class="flex shrink-0 items-center gap-2.5">${LOGO('size-9')}
        <span class="flex flex-col"><span class="text-xl font-black leading-none">پیدو</span>
        <span class="mt-1 hidden text-xs leading-none text-neutral-500 lg:block">نیازمندی‌های ایرانیان خارج از کشور</span></span></a>
      <a class="flex h-9 shrink-0 items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 ps-2.5 pe-3 text-[13px] font-medium text-neutral-700">${I('pin', 'size-4 text-brand-700')}${place}${I('chevronDown', 'size-3.5')}</a>
      <form class="ms-auto hidden max-w-md flex-1 lg:block"><div class="flex h-11 items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-500">${I('search', 'size-4')}${search}</div></form>
      <nav class="ms-auto hidden items-center gap-1 text-sm font-medium lg:ms-0 lg:flex">
        <a class="relative flex h-11 items-center gap-1.5 rounded-xl px-3">${I('chat', 'size-[18px]')}پیام‌ها<span class="flex h-5 min-w-5 items-center justify-center rounded-full bg-saffron-500 px-1 text-xs font-bold text-neutral-900">۲</span></a>
        <a class="flex h-11 items-center gap-1.5 rounded-xl px-3">${I('doc', 'size-[18px]')}آگهی‌های من</a>
        <a class="flex size-11 items-center justify-center rounded-xl" aria-label="نشان‌شده‌ها">${I('heart', 'size-5')}</a>
        <a class="flex size-11 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-800" aria-label="حساب من">آ</a>
        <a class="ms-1 flex h-11 items-center gap-1.5 rounded-xl bg-brand-700 px-4 font-bold text-white">${I('plus', 'size-4')}ثبت آگهی</a>
      </nav>
      <a class="ms-auto flex size-11 items-center justify-center rounded-xl text-neutral-700 lg:hidden" aria-label="نشان‌شده‌ها">${I('heart', 'size-6')}</a>
    </div>
  </header>`;
}

/** Focus header for tasks (posting, a conversation): back or close, a title, one action */
function appBar(title, { lead = 'back', action = '', sub = '' } = {}) {
  return `<header class="sticky top-0 z-30 border-b border-neutral-200 bg-white">
    <div class="mx-auto flex max-w-3xl items-center gap-1 px-2 py-1.5">
      <a class="flex size-11 shrink-0 items-center justify-center rounded-xl text-neutral-800" aria-label="${lead === 'close' ? 'بستن' : 'بازگشت'}">${I(lead === 'close' ? 'close' : 'back', 'size-6')}</a>
      <div class="min-w-0 flex-1"><p class="truncate text-base font-extrabold">${title}</p>${sub ? `<p class="truncate text-xs text-neutral-600">${sub}</p>` : ''}</div>
      ${action}
    </div></header>`;
}

function bottomNav(active = 0) {
  const items = [['home', 'آگهی‌ها'], ['chat', 'پیام‌ها', 2], ['plus', 'ثبت آگهی'], ['doc', 'آگهی‌های من'], ['user', 'حساب من']];
  return `<nav class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-neutral-200 bg-white lg:hidden">${items
    .map(([ic, label, badge], i) => `<a class="flex flex-col items-center gap-1 pt-2 pb-3 text-xs ${i === active ? 'font-bold text-brand-700' : 'text-neutral-600'}">
      <span class="relative ${i === 2 ? 'rounded-xl bg-brand-700 px-3 py-0.5 text-white' : ''}">${I(ic, 'size-6')}${badge ? `<span class="absolute -top-1.5 -end-2.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-saffron-500 px-1 text-xs font-bold text-neutral-900">${fa(badge)}</span>` : ''}</span>${label}</a>`)
    .join('')}</nav>`;
}

function photo(l, cls = 'size-full object-cover') {
  if (l.img) return `<img src="${l.img}" alt="" class="${cls}">`;
  return `<div class="flex size-full flex-col items-center justify-center gap-1 bg-brand-50 text-brand-800"><span class="text-lg font-black">${l.tile}</span><span class="text-xs">${l.business || 'بدون عکس'}</span></div>`;
}

const unit = (l) => (l.unit ? `<span class="ms-1 text-xs font-medium text-neutral-600">${l.unit}</span>` : '');

/** Grid card: price first, title on two lines without an empty band, district and time */
function gridCard(l) {
  return `<a class="relative flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white">
    <div class="relative aspect-[4/3] bg-neutral-100">${photo(l)}
      ${l.photos > 1 ? `<span class="absolute bottom-1.5 start-1.5 flex items-center gap-1 rounded-md bg-neutral-900/70 px-1.5 text-xs leading-5 text-white">${I('camera', 'size-3')}${fa(l.photos)}</span>` : ''}
      ${l.anmeldung ? `<span class="absolute bottom-1.5 end-1.5 rounded-md bg-white/95 px-1.5 text-xs font-bold leading-5 text-brand-800">Anmeldung</span>` : ''}
      ${l.verified ? `<span class="absolute top-2 start-2 flex items-center gap-0.5 rounded-md bg-white/95 px-1.5 text-xs font-bold leading-5 text-brand-800">${I('verified', 'size-3.5')}تأییدشده</span>` : ''}
      <span class="absolute top-2 end-2 flex size-9 items-center justify-center rounded-full bg-white/95 text-neutral-700 shadow-sm">${I('heart', 'size-[18px]')}</span>
    </div>
    <div class="flex flex-1 flex-col gap-1 p-3">
      <p class="text-[15px] font-extrabold text-brand-800">${price(l)}${unit(l)}</p>
      <p class="line-clamp-2 text-sm font-bold leading-6 text-neutral-900">${l.title}</p>
      <p class="mt-auto flex items-center gap-1 pt-1 text-xs text-neutral-600">${I('pin', 'size-3.5')}${l.place}، ${l.ago}</p>
    </div></a>`;
}

/** List card: photo at the start, facts line */
function listCard(l) {
  return `<a class="flex gap-3 border-b border-neutral-200 py-3">
    <div class="relative aspect-[4/3] w-32 shrink-0 overflow-hidden rounded-xl bg-neutral-100 lg:w-44">${photo(l)}
      ${l.anmeldung ? `<span class="absolute bottom-1 end-1 rounded-md bg-white/95 px-1.5 text-xs font-bold leading-5 text-brand-800">Anmeldung</span>` : ''}</div>
    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
      <p class="line-clamp-2 text-[15px] font-bold leading-6">${l.title}</p>
      <p class="text-[15px] font-extrabold text-brand-800">${price(l)}${unit(l)}</p>
      <p class="truncate text-xs text-neutral-600">${l.facts.join('، ')}</p>
      <p class="mt-auto flex items-center gap-1 text-xs text-neutral-600">${I('pin', 'size-3.5')}${l.place}، ${l.ago}</p>
    </div>
    <span class="flex size-11 shrink-0 items-center justify-center self-start rounded-full text-neutral-600" aria-label="نشان کردن">${I('heart', 'size-5')}</span>
  </a>`;
}

function chip(text, { on = false, icon = null, x = false, tone = '', down = false } = {}) {
  const base = on ? 'border-neutral-900 bg-neutral-900 text-white' : tone === 'saffron' ? 'border-saffron-100 bg-saffron-50 text-saffron-700' : tone === 'brand' ? 'border-brand-200 bg-brand-50 text-brand-800' : 'border-neutral-300 bg-white text-neutral-800';
  return `<a class="flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap ${base}">${icon ? I(icon, 'size-4') : ''}${text}${down ? I('chevronDown', 'size-3.5') : ''}${x ? I('close', 'size-3.5') : ''}</a>`;
}

/** A bottom sheet over a dimmed page (phones); on computers it shows as a centred dialog */
function sheet(title, body, footer = '') {
  return `<div class="fixed inset-0 z-40 flex items-end bg-neutral-900/45 lg:items-center lg:justify-center">
    <div class="max-h-[82vh] w-full overflow-y-auto rounded-t-3xl bg-white px-4 pt-3 lg:max-w-lg lg:rounded-3xl">
      <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-neutral-200 lg:hidden"></div>
      <div class="mb-2 flex items-center justify-between"><h2 class="text-lg font-extrabold">${title}</h2><span class="flex size-11 items-center justify-center rounded-full text-neutral-600">${I('close', 'size-5')}</span></div>
      ${body}
      ${footer ? `<div class="sticky bottom-0 -mx-4 mt-4 border-t border-neutral-200 bg-white px-4 pt-3 pb-4">${footer}</div>` : '<div class="h-4"></div>'}
    </div></div>`;
}

/** Posting steps: a bar per step, the current one named */
function steps(n, names = ['دسته', 'عکس و متن', 'جزئیات و قیمت', 'محل و انتشار']) {
  return `<div class="mb-1"><ol class="grid grid-cols-4 gap-1.5">${names.map((_, i) => `<li class="h-1.5 rounded-full ${i < n ? 'bg-brand-700' : 'bg-neutral-200'}"></li>`).join('')}</ol>
    <p class="mt-2 flex items-center justify-between text-xs"><b class="text-brand-800">مرحلهٔ ${fa(n)} از ${fa(names.length)}: ${names[n - 1]}</b><span class="flex items-center gap-1 text-neutral-600">${I('check', 'size-3.5')}پیش‌نویس ذخیره شد</span></p></div>`;
}

/** The posting flow's bottom bar: back and continue, always within thumb reach */
function stepBar(next, back = 'قبلی') {
  return `<div class="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white px-4 pt-3 pb-4 lg:static lg:mt-8 lg:border-0 lg:bg-transparent lg:px-0">
    <div class="mx-auto flex max-w-2xl gap-2">${back ? `<a class="flex h-12 items-center justify-center rounded-xl border border-neutral-300 px-5 font-bold text-neutral-800">${back}</a>` : ''}<a class="flex h-12 flex-1 items-center justify-center rounded-xl bg-brand-700 font-bold text-white">${next}</a></div></div>`;
}

/** Admin chrome: its own dark bar (so staff always know they are in admin), the environment, the menu */
function adminShell(active, body, { counts = {} } = {}) {
  const nav = [['overview', 'نمای کلی', 'chart'], ['queue', 'صف بررسی', 'flag'], ['fresh', 'آگهی‌های تازه', 'sparkle'], ['listings', 'آگهی‌ها و رویدادها', 'doc'], ['users', 'کاربران', 'people'], ['businesses', 'کسب‌وکارها', 'store'], ['payments', 'پرداخت‌ها', 'card'], ['audit', 'گزارش کارها', 'list'], ['system', 'وضعیت سیستم', 'gear'], ['staff', 'همکاران', 'shield']];
  return `<div class="min-h-screen bg-neutral-50">
  <header class="sticky top-0 z-30 bg-brand-950 text-white"><div class="flex items-center gap-3 px-4 py-2.5 lg:px-6">
    ${LOGO('size-8')}<b class="text-base">پیدو</b><span class="rounded-md bg-white/15 px-2 text-xs font-bold leading-6">پنل مدیریت</span><span class="rounded-md bg-saffron-500 px-2 text-xs font-bold leading-6 text-neutral-900">staging</span>
    <div class="ms-auto hidden h-10 w-80 items-center gap-2 rounded-lg bg-white/10 px-3 text-sm text-brand-100 lg:flex">${I('search', 'size-4')}کد آگهی، ایمیل یا نام…<span class="ms-auto rounded border border-white/30 px-1.5 text-xs">/</span></div>
    <span class="ms-auto text-sm text-brand-100 lg:ms-3">کاربر نمونه، مدیر</span><a class="hidden h-9 items-center rounded-lg px-3 text-sm text-brand-100 ring-1 ring-white/25 lg:flex">بازگشت به سایت</a>
  </div></header>
  <div class="lg:grid lg:grid-cols-[15rem_1fr]">
    <nav class="no-scrollbar flex gap-1 overflow-x-auto border-b border-neutral-200 bg-white px-3 py-2 lg:sticky lg:top-[52px] lg:h-[calc(100vh-52px)] lg:flex-col lg:border-b-0 lg:border-e lg:p-3">
      ${nav.map(([k, t, ic]) => `<a class="flex h-10 shrink-0 items-center gap-2.5 rounded-xl px-3 text-sm whitespace-nowrap ${k === active ? 'bg-brand-50 font-bold text-brand-800' : 'text-neutral-700'}">${I(ic, 'size-[18px]')}${t}${counts[k] ? `<span class="ms-auto rounded-full px-2 text-xs font-bold leading-5 ${k === 'system' ? 'bg-red-100 text-red-800' : 'bg-saffron-500 text-neutral-900'}">${counts[k]}</span>` : ''}</a>`).join('')}
    </nav>
    <main class="min-w-0 p-4 lg:p-6">${body}</main>
  </div></div>`;
}

/** Footer on every browsing page: help, legal (Impressum by its German name), countries with the
 * ones coming soon, Telegram. On phones it sits above the bottom bar; task pages (posting, chat)
 * reach the same legal links from their ⋯ menu and the account page. */
function footer() {
  const col = (title, links) => `<div><h2 class="mb-2 text-sm font-extrabold text-neutral-900">${title}</h2><ul class="space-y-1">${links.map((l) => `<li><a class="flex min-h-9 items-center text-sm text-neutral-700">${l}</a></li>`).join('')}</ul></div>`;
  return `<footer class="mt-10 border-t border-neutral-200 bg-neutral-50 pb-24 lg:pb-0">
    <div class="mx-auto max-w-6xl px-4 py-8 lg:px-6">
      <div class="flex items-center gap-3">${LOGO('size-10')}<div><p class="font-extrabold">نیازمندی‌های ایرانیان خارج از کشور</p><p class="text-sm text-neutral-700">هر چی بخوای، تو پیدو پیداست</p></div>
        <a class="ms-auto hidden h-10 items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3 text-sm font-bold lg:flex">${I('send', 'size-4 text-brand-700')}کانال تلگرام پیدو</a></div>
      <div class="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-4">
        ${col('کمک', ['راهنما و پرسش‌ها', 'معاملهٔ امن', 'گزارش یک آگهی', 'تماس با ما'])}
        ${col('حقوقی', ['<span><bdi>Impressum</bdi> (اطلاعات ناشر)</span>', '<span>شرایط استفاده <bdi>(AGB)</bdi></span>', '<span>حریم خصوصی و کوکی‌ها <bdi>(Datenschutz)</bdi></span>', '<span>تماس طبق <bdi>DSA</bdi> و قوانین محتوا</span>'])}
        ${col('پیدو', ['دربارهٔ پیدو', 'پیدو برای کسب‌وکارها (پرو)', 'پرو رایگان برای کسب‌وکارهای بنیان‌گذار', 'رویدادها', 'کانال تلگرام'])}
        <div><h2 class="mb-2 text-sm font-extrabold text-neutral-900">کشورها</h2><ul class="space-y-1">${[['آلمان', 'de']].map(([c, f]) => `<li><a class="flex min-h-9 items-center gap-2 text-sm text-neutral-700">${flag(f)}${c}</a></li>`).join('')}</ul>
          <p class="mt-2 text-xs leading-6 text-neutral-600">به‌زودی: اتریش، هلند، کانادا، ایتالیا. <a class="font-bold text-brand-800">خبرم کن</a><br><a class="font-bold text-brand-800">راهنمای ایرانیان در ترکیه</a></p></div>
      </div>
      <p class="mt-8 border-t border-neutral-200 pt-4 text-xs text-neutral-600">© ۲۰۲۶ پیدو، برلین. آگهی برای اشخاص رایگان است.</p>
    </div></footer>`;
}

/** Small flags drawn with stripes (no images needed) */
function flag(code, cls = 'h-4 w-6') {
  const s = { de: ['bg-black', 'bg-red-600', 'bg-yellow-400'], at: ['bg-red-600', 'bg-white', 'bg-red-600'], nl: ['bg-red-700', 'bg-white', 'bg-blue-800'] }[code];
  if (s) return `<span class="flex ${cls} shrink-0 flex-col overflow-hidden rounded-sm ring-1 ring-neutral-200">${s.map((c) => `<i class="flex-1 ${c}"></i>`).join('')}</span>`;
  const svg = {
    ca: '<rect width="30" height="20" fill="#fff"/><rect width="7.5" height="20" fill="#d52b1e"/><rect x="22.5" width="7.5" height="20" fill="#d52b1e"/><path d="M15 4l1.6 3.4 2.4-.8-1 3.6 2-.4-3.5 3.4.4 2.3-1.9-.6-1.9.6.4-2.3-3.5-3.4 2 .4-1-3.6 2.4.8z" fill="#d52b1e"/>',
    us: '<rect width="30" height="20" fill="#fff"/>' + [0, 2, 4, 6, 8, 10, 12].map((i) => `<rect y="${(i * 20) / 13}" width="30" height="${20 / 13}" fill="#b22234"/>`).join('') + '<rect width="13" height="10.8" fill="#3c3b6e"/>',
    au: '<rect width="30" height="20" fill="#012169"/><path d="M0 0l15 10M15 0L0 10" stroke="#fff" stroke-width="2"/><path d="M7.5 0v10M0 5h15" stroke="#fff" stroke-width="3"/><path d="M7.5 0v10M0 5h15" stroke="#c8102e" stroke-width="1.6"/><circle cx="7.5" cy="15" r="1.6" fill="#fff"/><circle cx="23" cy="5" r="1" fill="#fff"/><circle cx="20" cy="10" r="1" fill="#fff"/><circle cx="25.5" cy="9" r="1" fill="#fff"/><circle cx="23" cy="16" r="1" fill="#fff"/>',
    it: '<rect width="10" height="20" fill="#009246"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#ce2b37"/>',
    tr: '<rect width="30" height="20" fill="#e30a17"/><circle cx="11" cy="10" r="5" fill="#fff"/><circle cx="12.3" cy="10" r="4" fill="#e30a17"/><path d="M17 10l3.6-1.2-2.2 3 0-3.6 2.2 3z" fill="#fff"/>',
  }[code];
  return `<svg viewBox="0 0 30 20" class="${cls} shrink-0 rounded-sm ring-1 ring-neutral-200" aria-hidden="true">${svg || '<rect width="30" height="20" fill="#dce4e2"/>'}</svg>`;
}
