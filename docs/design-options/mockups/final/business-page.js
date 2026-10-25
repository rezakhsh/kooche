// A business's public page: cover, logo, verified, one line, languages, open now, contact, its
// listings and events, follow; the Impressum folds out at the bottom.
const t = L.translate;
mount(`${header()}
<main class="mx-auto w-full max-w-4xl pb-10">
  <div class="h-28 bg-gradient-to-l from-brand-800 to-brand-600 lg:mt-6 lg:h-40 lg:rounded-3xl"></div>
  <div class="px-4"><div class="-mt-10 flex items-end gap-3"><span class="relative flex size-20 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-2xl font-black text-brand-800 shadow-md">پ</span><a class="ms-auto flex h-10 items-center rounded-lg border border-brand-200 bg-brand-50 px-3 text-sm font-bold text-brand-800">دنبال کردن</a></div>
    <h1 class="mt-3 flex items-center gap-1.5 text-2xl font-extrabold">دارالترجمه پارسیان${I('verified', 'size-6 text-brand-700')}</h1>
    <p class="text-sm text-neutral-700">ترجمهٔ رسمی فارسی و آلمانی، مترجم قسم‌خورده</p>
    <div class="mt-3 flex flex-wrap gap-1.5 text-xs">${['شارلوتنبورگ، برلین', 'فارسی، آلمانی، انگلیسی', 'عضو از اکتبر ۲۰۲۶'].map((x) => `<span class="rounded-full bg-neutral-100 px-2.5 leading-7">${x}</span>`).join('')}<span class="rounded-full bg-green-50 px-2.5 font-bold leading-7 text-green-800">الان باز است، تا ۱۸:۰۰</span></div>
    <div class="mt-4 grid grid-cols-3 gap-2">${[['chat', 'پیام'], ['phone', 'تماس'], ['pin', 'مسیر']].map(([ic, l]) => `<a class="flex h-12 items-center justify-center gap-1.5 rounded-xl ${ic === 'chat' ? 'bg-brand-700 text-white' : 'border border-neutral-300'} text-sm font-bold">${I(ic, 'size-4')}${l}</a>`).join('')}</div>
    <div class="mt-6 flex gap-5 border-b border-neutral-200 text-sm"><span class="border-b-2 border-brand-700 pb-2 font-bold text-brand-800">آگهی‌ها (${fa(4)})</span><span class="pb-2 text-neutral-600">رویدادها</span><span class="pb-2 text-neutral-600">دربارهٔ ما</span></div>
    <div class="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">${[t, { ...t, title: 'ترجمهٔ گواهینامهٔ رانندگی برای تعویض', price: 45 }, { ...t, title: 'کمک در فرم‌های Jobcenter و Ausländerbehörde', price: 30, tile: 'اداری' }].map(gridCard).join('')}</div>
    <details class="mt-6 rounded-2xl border border-neutral-200 p-4"><summary class="cursor-pointer text-sm font-bold">اطلاعات حقوقی (<bdi>Impressum</bdi>)</summary></details>
  </div>
</main>${footer()}${bottomNav(0)}`);
