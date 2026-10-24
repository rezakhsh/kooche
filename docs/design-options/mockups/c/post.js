// C: posting start: photos first (skippable), then the title, which suggests the category
mount(`${deskHeader()}
<div class="min-h-screen bg-page pb-32">
<header class="flex items-center gap-2 px-3 pt-3 lg:hidden"><a class="flex size-11 items-center justify-center">${I('close', 'size-6')}</a><span class="flex-1 text-center text-sm font-bold">آگهی تازه</span><a class="px-3 text-sm font-bold text-brand-800">پیش‌نویس</a></header>
<main class="mx-auto max-w-xl px-4 pt-3 lg:pt-10">
  <div class="flex items-center gap-2"><span class="h-1.5 flex-1 rounded-full bg-brand-700"></span><span class="h-1.5 flex-1 rounded-full bg-neutral-300"></span><span class="h-1.5 flex-1 rounded-full bg-neutral-300"></span></div>
  <p class="mt-2 text-xs font-bold text-neutral-600">مرحلهٔ ۱ از ۳: عکس و عنوان</p>
  <h1 class="mt-4 text-2xl font-black leading-[1.5] lg:text-3xl">با عکس شروع کنید</h1>
  <p class="mt-1 text-sm text-neutral-600">آگهی‌های عکس‌دار چند برابر بیشتر پیام می‌گیرند. تا ۲۰ عکس.</p>
  <div class="mt-4 grid grid-cols-3 gap-2.5">
    <a class="col-span-2 row-span-2 flex aspect-square flex-col items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-brand-400 bg-white text-brand-800"><span class="flex size-14 items-center justify-center rounded-full bg-brand-50">${I('camera', 'size-7')}</span><b>افزودن عکس</b><span class="text-xs text-neutral-500">دوربین یا گالری</span></a>
    <div class="relative aspect-square overflow-hidden rounded-2xl"><img src="../img/room5.webp" class="size-full object-cover" alt=""><span class="absolute bottom-1.5 start-1.5 rounded-full bg-saffron-500 px-2 text-xs font-bold leading-5 text-neutral-900">کاور</span></div>
    <div class="relative aspect-square overflow-hidden rounded-2xl"><img src="../img/room4.webp" class="size-full object-cover" alt=""></div>
  </div>
  <label class="mt-6 block"><span class="text-sm font-bold">عنوان آگهی</span>
  <span class="mt-1.5 flex h-14 items-center rounded-2xl bg-white px-4 text-base ring-2 ring-brand-600">اتاق مبله در WG، نزدیک Hermannplatz</span></label>
  <div class="mt-3 flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-neutral-200"><span class="flex size-10 items-center justify-center rounded-xl bg-saffron-100 text-saffron-800">${I('sparkle', 'size-5')}</span>
  <span class="flex-1 text-sm"><span class="block text-xs text-neutral-500">دستهٔ پیشنهادی</span><b>املاک › اتاق و خانه اشتراکی (WG)</b></span><a class="text-sm font-bold text-brand-800">تغییر</a></div>
</main>
<div class="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white px-4 pt-3 pb-4 lg:static lg:mx-auto lg:mt-8 lg:max-w-xl lg:border-0 lg:bg-transparent"><a class="flex h-14 items-center justify-center rounded-full bg-brand-700 text-base font-extrabold text-white">ادامه: جزئیات و قیمت</a></div>
</div>`);
