// Round 12: choosing a city. Open cities first; waitlist cities show their one goal (businesses);
// the country line says when the whole country opens. Other countries: their first city's goal.
const de = [['برلین', 'open', 648], ['هامبورگ', 12, 20], ['فرانکفورت', 8, 20], ['کلن و بن', 5, 15]];
const other = [['ca', 'کانادا', 'تورنتو', 9, 30], ['us', 'آمریکا', 'لس‌آنجلس', 6, 30], ['au', 'استرالیا', 'سیدنی', 4, 20], ['gb', 'بریتانیا', 'لندن', 3, 30], ['at', 'اتریش', 'وین', 7, 15], ['nl', 'هلند', 'آمستردام', 2, 15]];
const bar = (n, g) => `<span class="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-neutral-100"><i class="block h-full rounded-full bg-brand-600" style="width:${(n / g) * 100}%"></i></span>`;
mount(`${appBar('شهر شما', { lead: 'close' })}
<main class="mx-auto w-full max-w-xl px-4 pt-4 pb-10">
  <div class="flex h-12 items-center gap-2 rounded-xl border border-neutral-300 px-3 text-[15px] text-neutral-500">${I('search', 'size-5')}جستجوی شهر</div>
  <h2 class="mt-5 flex items-center gap-2 text-sm font-extrabold">${flag('de')}آلمان<span class="ms-auto text-xs font-normal text-neutral-600">${fa(1)} از ${fa(4)} شهر باز</span></h2>
  <ul class="mt-2 divide-y divide-neutral-200 rounded-2xl border border-neutral-200">${de.map(([c, a, b]) => a === 'open'
    ? `<li class="flex min-h-14 items-center gap-3 px-4"><span class="flex size-9 items-center justify-center rounded-xl bg-brand-700 text-white">${I('check', 'size-4', 3)}</span><span class="flex-1"><b class="block text-sm">${c}</b><span class="text-xs text-neutral-600">باز، ${fa(b)} آگهی</span></span>${I('chevronEnd', 'size-4 text-neutral-400')}</li>`
    : `<li class="flex min-h-16 items-center gap-3 px-4"><span class="flex size-9 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">${I('clock', 'size-4')}</span><span class="flex-1"><b class="block text-sm">${c}</b><span class="text-xs text-neutral-600">به‌زودی: ${fa(a)} از ${fa(b)} کسب‌وکار</span>${bar(a, b)}</span><span class="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-800">خبرم کن</span></li>`).join('')}</ul>
  <p class="mt-2 rounded-xl bg-neutral-50 p-3 text-xs leading-6 text-neutral-700">وقتی این چهار شهر باز شوند، کل آلمان با همهٔ شهرها باز می‌شود. تا آن موقع، خدمات آنلاین و رویدادهای آنلاین برای همهٔ آلمان است.</p>
  <h2 class="mt-6 text-sm font-extrabold">کشورهای دیگر</h2>
  <ul class="mt-2 divide-y divide-neutral-200 rounded-2xl border border-neutral-200">${other.map(([f, c, city, n, g]) => `<li class="flex min-h-16 items-center gap-3 px-4">${flag(f, 'h-5 w-7')}<span class="flex-1"><b class="block text-sm">${c}</b><span class="text-xs text-neutral-600">اول ${city}: ${fa(n)} از ${fa(g)} کسب‌وکار</span>${bar(n, g)}</span>${I('chevronEnd', 'size-4 text-neutral-400')}</li>`).join('')}</ul>
  <a class="mt-3 flex h-12 items-center justify-center rounded-xl border border-neutral-300 text-sm font-bold">کشور من در این فهرست نیست</a>
</main>`);
