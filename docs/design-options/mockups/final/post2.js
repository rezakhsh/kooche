// Posting, step 2: photos and text. A big add tile, the cover marked, move buttons instead of
// dragging, a title counter and a short prompt for the description. Saved as you go.
mount(`${appBar('ثبت آگهی', { lead: 'close', sub: 'املاک، اتاق و خانه اشتراکی (WG)' })}
<main class="mx-auto w-full max-w-2xl px-4 pt-4 pb-28">
  ${steps(2)}
  <h1 class="mt-5 text-2xl font-extrabold">عکس و توضیح</h1>
  <p class="mt-1 text-sm text-neutral-600">آگهی با عکس خیلی بیشتر دیده می‌شود. تا ۱۰ عکس.</p>
  <div class="mt-4 grid grid-cols-3 gap-2">
    <div class="relative aspect-square overflow-hidden rounded-2xl"><img src="../img/room5.webp" class="size-full object-cover" alt=""><span class="absolute top-1.5 start-1.5 rounded-md bg-saffron-500 px-1.5 text-xs font-bold leading-5 text-neutral-900">عکس اصلی</span><span class="absolute bottom-1.5 end-1.5 flex size-8 items-center justify-center rounded-full bg-white/95 text-neutral-800">${I('more', 'size-4')}</span></div>
    <div class="relative aspect-square overflow-hidden rounded-2xl"><img src="../img/room4.webp" class="size-full object-cover" alt=""><span class="absolute bottom-1.5 end-1.5 flex size-8 items-center justify-center rounded-full bg-white/95 text-neutral-800">${I('more', 'size-4')}</span></div>
    <a class="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-brand-400 bg-brand-50/50 text-brand-800">${I('camera', 'size-7')}<b class="text-sm">افزودن عکس</b></a>
  </div>
  <p class="mt-2 text-xs text-neutral-600">برای جابه‌جایی یا اصلی کردن، روی ⋯ هر عکس بزنید.</p>
  <label class="mt-6 block"><span class="flex justify-between text-sm font-bold"><span>عنوان</span><span class="font-normal text-neutral-600">${fa(36)} از ${fa(90)}</span></span>
  <span class="mt-1.5 flex h-12 items-center rounded-xl border-2 border-brand-600 px-4 text-base">اتاق مبله در WG، نزدیک Hermannplatz</span></label>
  <label class="mt-5 block"><span class="text-sm font-bold">توضیحات</span>
  <span class="mt-1.5 block min-h-32 rounded-xl border border-neutral-300 px-4 py-3 text-base leading-8 text-neutral-900">اتاق ۱۴ متری در آپارتمان سه‌نفره، ۳ دقیقه تا <bdi>U-Bahn</bdi>.</span></label>
  <div class="mt-2 flex flex-wrap gap-1.5"><span class="text-xs text-neutral-600">بنویسید:</span>${['هم‌خانه‌ها', 'نوع قرارداد', 'از چه تاریخی', 'چه چیزهایی دارد'].map((t) => `<span class="rounded-full bg-neutral-100 px-2.5 text-xs leading-7 text-neutral-700">+ ${t}</span>`).join('')}</div>
  <div class="mt-5 flex gap-2"><span class="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-brand-600 bg-brand-50 text-sm font-bold text-brand-800">${I('check', 'size-4')}اتاق دارم</span><span class="flex h-11 flex-1 items-center justify-center rounded-xl border border-neutral-300 text-sm text-neutral-700">دنبال اتاق هستم</span></div>
</main>${stepBar('ادامه: جزئیات و قیمت')}`);
