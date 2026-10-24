// B: posting start: a step bar, the fixed country, a category search with suggestions, the list
const steps = ['دسته', 'عکس و متن', 'جزئیات', 'انتشار'];
mount(`${header()}
<main class="mx-auto w-full max-w-2xl px-4 pt-5 pb-28 lg:px-6 lg:pt-10">
  <ol class="mb-5 grid grid-cols-4 gap-1.5">${steps.map((s, i) => `<li><span class="block h-1.5 rounded-full ${i === 0 ? 'bg-brand-700' : 'bg-neutral-200'}"></span><span class="mt-1.5 block text-xs ${i === 0 ? 'font-bold text-brand-800' : 'text-neutral-500'}">${fa(i + 1)}. ${s}</span></li>`).join('')}</ol>
  <h1 class="text-2xl font-extrabold">چه چیزی آگهی می‌کنید؟</h1>
  <div class="mt-3 flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm">
    <span class="flex h-4 w-6 flex-col overflow-hidden rounded-sm"><i class="flex-1 bg-black"></i><i class="flex-1 bg-red-600"></i><i class="flex-1 bg-yellow-400"></i></span>آگهی در آلمان منتشر می‌شود<a class="ms-auto font-medium text-brand-800">تغییر کشور</a></div>
  <div class="mt-4 flex items-center gap-2 rounded-xl border-2 border-brand-600 px-3 py-3 text-[15px]">${I('search', 'size-5 text-neutral-500')}<span>اتاق</span><span class="h-5 w-px animate-pulse bg-neutral-900"></span></div>
  <p class="mt-4 mb-2 text-xs font-bold text-neutral-500">پیشنهاد برای «اتاق»</p>
  <ul class="overflow-hidden rounded-2xl border border-brand-200 bg-brand-50/50">
    ${[['اتاق و خانه اشتراکی (WG)', 'املاک'], ['اجاره موقت و کوتاه‌مدت', 'املاک'], ['اتاق خواب، تخت و کمد', 'خانه و آشپزخانه']].map(([a, b]) => `<li class="flex items-center gap-3 border-b border-brand-100 px-4 py-3.5 last:border-0"><span class="flex-1"><b class="block text-[15px]">${a}</b><span class="text-xs text-neutral-600">در ${b}</span></span>${I('chevronEnd', 'size-4 text-neutral-500')}</li>`).join('')}
  </ul>
  <p class="mt-6 mb-2 text-xs font-bold text-neutral-500">یا از فهرست دسته‌ها</p>
  <ul class="divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200">
    ${CATS.slice(0, 8).map((c) => `<li class="flex items-center gap-3 px-4 py-3.5"><span class="flex size-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">${I(c.icon, 'size-5')}</span><span class="text-[15px]">${c.fa}</span>${I('chevronEnd', 'ms-auto size-4 text-neutral-400')}</li>`).join('')}
  </ul>
</main>${bottomNav(2)}`);
