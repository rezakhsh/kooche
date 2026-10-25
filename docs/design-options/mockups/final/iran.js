// A visit from Iran (Cloudflare's country header says IR): browse only. One calm notice says what
// works and why the rest doesn't, without blame; no sign-in, posting, chat, favorites or payments
// anywhere on the page, so nothing leads to a dead end. Reporting a listing stays open (DSA Art. 16).
const feed = ['wg', 'car', 'rug', 'translate', 'phone', 'setar'].map((k) => L[k]);
const navItems = [['home', 'آگهی‌ها', true], ['calendar', 'رویدادها'], ['shield', 'راهنما']];
mount(`<header class="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur">
    <div class="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 lg:px-6">
      <a class="flex shrink-0 items-center gap-2.5">${LOGO('size-9')}<span class="text-xl font-black leading-none">پیدو</span></a>
      <a class="flex h-9 shrink-0 items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 ps-2.5 pe-3 text-[13px] font-medium text-neutral-700">${I('pin', 'size-4 text-brand-700')}برلین${I('chevronDown', 'size-3.5')}</a>
      <form class="ms-auto hidden max-w-md flex-1 lg:block"><div class="flex h-11 items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-500">${I('search', 'size-4')}جستجو در برلین…</div></form>
      <span class="ms-auto flex h-9 items-center gap-1.5 rounded-full bg-neutral-100 px-3 text-xs font-bold text-neutral-700 lg:ms-0">${I('search', 'size-3.5')}فقط مشاهده</span>
    </div>
  </header>
<main class="mx-auto w-full max-w-6xl pb-24 lg:px-6 lg:pt-6">
  <section class="mx-4 mt-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 lg:mx-0 lg:flex lg:items-start lg:gap-4">
    <span class="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700 lg:flex">${I('globe', 'size-6')}</span>
    <div class="flex-1"><h1 class="text-base font-extrabold text-brand-900 lg:text-lg">از ایران، پیدو فقط برای دیدن است</h1>
      <p class="mt-1 text-sm leading-7 text-neutral-800">آگهی‌ها و رویدادهای ایرانیان خارج از کشور را ببینید و جستجو کنید. ثبت‌نام، گذاشتن آگهی و پیام دادن از داخل ایران ممکن نیست؛ به خاطر قوانین تحریم و شرایط شرکت‌هایی که پیدو با آن‌ها کار می‌کند. این تصمیم دربارهٔ شما نیست.</p>
      <p class="mt-2 text-sm leading-7 text-neutral-800">اگر مهاجرت می‌کنید: وقتی در کشور تازه ساکن شدید، با ایمیل و شمارهٔ موبایل همان کشور ثبت‌نام کنید.</p>
      <div class="mt-3 flex flex-wrap gap-2"><a class="flex h-10 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-bold text-brand-800">${I('book', 'size-4')}راهنمای تازه‌واردها</a><a class="flex h-10 items-center rounded-xl px-3 text-sm font-bold text-brand-800 underline">چرا؟</a><a class="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-neutral-700">${I('flag', 'size-4')}گزارش محتوای غیرقانونی</a></div></div>
  </section>
  <div class="sticky top-[61px] z-20 bg-white px-4 pt-3 pb-2 lg:static lg:px-0">
    <div class="flex h-12 items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 text-[15px] text-neutral-500 lg:hidden">${I('search', 'size-5')}جستجو در برلین…</div>
    <div class="no-scrollbar -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:mt-0 lg:px-0">${chip('فیلترها', { icon: 'sliders', tone: 'brand' })}${CATS.slice(0, 5).map((c) => chip(c.short)).join('')}</div>
  </div>
  <div class="flex items-center gap-2 px-4 pt-2 pb-1 lg:px-0"><h2 class="text-base font-extrabold lg:text-2xl">آگهی‌های برلین</h2><span class="text-sm text-neutral-600">${fa(648)} آگهی</span></div>
  <div class="grid grid-cols-2 gap-3 px-4 pt-3 lg:grid-cols-4 lg:gap-4 lg:px-0">${feed.map((l) => gridCard(l).replace(/<span class="absolute top-2 end-2[^]*?<\/span>/, '')).join('')}</div>
</main>${footer()}
<nav class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-neutral-200 bg-white lg:hidden">${navItems.map(([ic, t, on]) => `<a class="flex flex-col items-center gap-1 pt-2 pb-3 text-xs ${on ? 'font-bold text-brand-700' : 'text-neutral-600'}">${I(ic, 'size-6')}${t}</a>`).join('')}</nav>`);
