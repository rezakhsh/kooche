// Posting an event, step 2: when (day, Persian month name, year; time as hour buttons; repeats as
// chips), the venue with suggestions from venues already on Peydoo, and other cities of a tour.
const sel = (v, w = '') => `<span class="flex h-12 items-center justify-between rounded-xl border border-neutral-400 px-3 text-base ${w}">${v}${I('chevronDown', 'size-4 text-neutral-500')}</span>`;
mount(`${appBar('رویداد تازه', { lead: 'close', sub: 'کنسرت موسیقی ایرانی: گروه نوا' })}
<main class="mx-auto w-full max-w-2xl px-4 pt-4 pb-28">
  ${steps(2, ['پوستر و عنوان', 'زمان و مکان', 'بلیت و انتشار'])}
  <h1 class="mt-5 text-2xl font-extrabold">زمان و مکان</h1>
  <p class="mt-5 mb-1.5 text-sm font-bold">تاریخ</p>
  <div class="grid grid-cols-[5rem_1fr_6rem] gap-2">${sel('۸')}${sel('نوامبر')}${sel('۲۰۲۶')}</div>
  <p class="mt-1 text-xs text-neutral-600">یکشنبه، ۸ نوامبر ۲۰۲۶، ۱۴ روز دیگر</p>
  <div class="mt-4 grid grid-cols-2 gap-3"><div><p class="mb-1.5 text-sm font-bold">شروع</p>${sel('۲۰:۰۰')}</div><div><p class="mb-1.5 text-sm font-bold">پایان <span class="font-normal text-neutral-600">(اختیاری)</span></p>${sel('۲۳:۰۰')}</div></div>
  <p class="mt-1 text-xs text-neutral-600">به وقت برلین. «۲۳:۰۰» پیش از شروع یعنی روز بعد.</p>
  <p class="mt-5 mb-1.5 text-sm font-bold">تکرار</p>
  <div class="flex flex-wrap gap-2">${['یک بار', 'چند روز پشت سر هم', 'هر هفته', 'هر ماه'].map((t, i) => `<span class="flex h-10 items-center rounded-full border px-3.5 text-sm ${i === 0 ? 'border-2 border-brand-600 bg-brand-50 font-bold text-brand-800' : 'border-neutral-300'}">${t}</span>`).join('')}</div>
  <p class="mt-5 mb-1.5 text-sm font-bold">کجا</p>
  <div class="flex gap-1 rounded-xl bg-neutral-100 p-1">${['حضوری', 'آنلاین', 'هر دو'].map((t, i) => `<span class="flex h-10 flex-1 items-center justify-center rounded-lg text-sm ${i === 0 ? 'bg-white font-bold shadow-sm' : 'text-neutral-700'}">${t}</span>`).join('')}</div>
  <div class="mt-3 rounded-xl border-2 border-brand-600"><span class="flex h-12 items-center gap-2 px-3 text-base">${I('search', 'size-5 text-neutral-500')}Heimathafen</span>
    <ul class="border-t border-neutral-200">${[['Heimathafen Neukölln', 'Karl-Marx-Straße 141، نویکلن، ۳ رویداد در پیدو'], ['Heimathafen Spandau', 'Spandau']].map(([a, b], i) => `<li class="flex items-center gap-3 px-3 py-2.5 ${i === 0 ? 'bg-brand-50' : ''}">${I('pin', 'size-4 text-brand-700')}<span class="min-w-0"><bdi class="block text-sm font-bold">${a}</bdi><span class="block truncate text-xs text-neutral-600">${b}</span></span></li>`).join('')}</ul></div>
  <div class="mt-5 rounded-2xl border border-neutral-200 p-3.5"><p class="text-sm font-bold">تور دارید؟</p><p class="text-xs text-neutral-600">برای هر شهر یک صفحه با سالن و لینک بلیت خودش؛ همه به هم لینک می‌شوند.</p>
    <a class="mt-2 flex h-11 items-center justify-center gap-1.5 rounded-xl border border-neutral-300 text-sm font-bold">${I('plus', 'size-4')}افزودن شهر و تاریخ دیگر</a></div>
</main>${stepBar('ادامه: بلیت و انتشار')}`);
