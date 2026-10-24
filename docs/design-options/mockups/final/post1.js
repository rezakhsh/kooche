// Posting, step 1: what are you posting. A search over category names with suggestions, the
// categories the person used before, then the full list. One tap on a suggestion goes on.
mount(`${appBar('ثبت آگهی', { lead: 'close' })}
<main class="mx-auto w-full max-w-2xl px-4 pt-4 pb-10">
  ${steps(1)}
  <h1 class="mt-5 text-2xl font-extrabold">چه چیزی آگهی می‌کنید؟</h1>
  <p class="mt-1 flex items-center gap-1.5 text-sm text-neutral-600"><span class="flex h-3.5 w-5 flex-col overflow-hidden rounded-sm"><i class="flex-1 bg-black"></i><i class="flex-1 bg-red-600"></i><i class="flex-1 bg-yellow-400"></i></span>در آلمان منتشر می‌شود، <a class="font-bold text-brand-800">تغییر</a></p>
  <div class="mt-4 flex h-14 items-center gap-2 rounded-2xl border-2 border-brand-600 px-4 text-base">${I('search', 'size-5 text-neutral-500')}<span>اتاق</span><span class="h-5 w-px bg-neutral-900"></span></div>
  <ul class="mt-3 overflow-hidden rounded-2xl border border-brand-200 bg-brand-50/60">
    ${[['اتاق و خانه اشتراکی (WG)', 'املاک', 41], ['اجارهٔ موقت و کوتاه‌مدت', 'املاک', 23], ['اتاق خواب، تخت و کمد', 'خانه و آشپزخانه', 12]].map(([a, b, n]) => `<li class="flex min-h-14 items-center gap-3 border-b border-brand-100 px-4 py-2.5 last:border-0"><span class="flex-1"><b class="block text-[15px]">${a}</b><span class="text-xs text-neutral-600">در ${b}، ${fa(n)} آگهی در برلین</span></span>${I('chevronEnd', 'size-5 text-neutral-500')}</li>`).join('')}
  </ul>
  <p class="mt-6 mb-2 text-sm font-bold text-neutral-700">همه دسته‌ها</p>
  <ul class="divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200">
    ${CATS.slice(0, 7).map((c) => `<li class="flex min-h-14 items-center gap-3 px-4"><span class="flex size-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">${I(c.icon, 'size-5')}</span><span class="text-[15px]">${c.fa}</span>${I('chevronEnd', 'ms-auto size-5 text-neutral-400')}</li>`).join('')}
  </ul>
</main>`);
