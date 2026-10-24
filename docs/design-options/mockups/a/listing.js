// A: listing page: the photo under a slim app bar, time and place, the safety row before the
// details, key-value rows, and the fixed two-button bar (چت + اطلاعات تماس) as on Divar.
// Computer: details on the start side, photos on the end side, as on Divar's web page.
const l = L.wg;
const kv = [['اجاره ماهانه (گرم)', '۵۹۰ €'], ['ودیعه (Kaution)', '۱٬۱۸۰ €'], ['متراژ اتاق', '۱۴ متر'], ['از تاریخ', '۱ دسامبر ۲۰۲۶'], ['ثبت آدرس (Anmeldung)', 'ممکن'], ['مبله', 'بله'], ['هم‌خانه‌ها', '۲ نفر']];
const buttons = `<div class="grid grid-cols-2 gap-2"><a class="flex h-12 items-center justify-center rounded-lg bg-brand-700 font-bold text-white">چت</a><a class="flex h-12 items-center justify-center rounded-lg border border-brand-700 font-bold text-brand-800">اطلاعات تماس</a></div>`;
const info = `
  <nav class="flex items-center gap-1 text-xs text-neutral-500">برلین ${I('chevronEnd', 'size-3')} املاک ${I('chevronEnd', 'size-3')} اتاق و WG</nav>
  <h1 class="mt-3 text-xl font-bold leading-9">${l.title}</h1>
  <p class="mt-1 text-sm text-neutral-500">۲ ساعت پیش در نویکلن، برلین</p>
  <div class="mt-4 hidden lg:block">${buttons}</div>
  <a class="mt-4 flex items-center gap-3 border-y border-neutral-200 py-3.5 text-[15px]"><span class="text-saffron-700">${I('alert', 'size-5')}</span><span class="flex-1 font-medium">نکات ایمنی پیش از اجارهٔ اتاق</span>${I('chevronEnd', 'size-4 text-neutral-400')}</a>
  <dl class="divide-y divide-neutral-200">${kv.map(([k, v]) => `<div class="flex justify-between py-3.5 text-[15px]"><dt class="text-neutral-600">${k}</dt><dd class="font-medium ${v === 'ممکن' ? 'text-brand-800' : ''}">${v}</dd></div>`).join('')}</dl>
  <h2 class="mt-6 font-bold">توضیحات</h2>
  <p class="mt-2 text-[15px] leading-8 text-neutral-800">اتاق مبله در آپارتمان سه‌نفره، ۳ دقیقه تا U-Bahn Hermannplatz. هم‌خانه‌ها دانشجو و فارسی‌زبان هستند. قرارداد Untermietvertrag و ثبت آدرس ممکن است.</p>
  <a class="mt-6 flex items-center gap-3 border-t border-neutral-200 py-4"><span class="flex size-11 items-center justify-center rounded-full bg-neutral-100 font-bold">م</span><span class="flex-1"><b class="block">${l.seller}</b><span class="text-xs text-neutral-500">عضو از شهریور ۱۴۰۵، شماره تأیید شده</span></span>${I('chevronEnd', 'size-4 text-neutral-400')}</a>`;
mount(`
<header class="hidden lg:block">${header()}</header>
<div class="absolute inset-x-0 top-0 z-20 flex items-center gap-1 bg-gradient-to-b from-neutral-900/50 to-transparent px-2 py-2 text-white lg:hidden">
  <a class="flex size-11 items-center justify-center" aria-label="بازگشت">${I('back', 'size-6')}</a>
  <a class="ms-auto flex size-11 items-center justify-center" aria-label="اشتراک">${I('share', 'size-6')}</a>
  <a class="flex size-11 items-center justify-center" aria-label="نشان کردن">${I('heart', 'size-6')}</a>
</div>
<main class="mx-auto w-full max-w-6xl pb-28 lg:grid lg:grid-cols-2 lg:gap-10 lg:px-6 lg:pt-8">
  <div class="lg:order-2">
    <div class="relative aspect-[4/3] bg-neutral-900 lg:overflow-hidden lg:rounded-lg"><img src="../img/room5.webp" class="size-full object-cover" alt="">
      <span class="absolute bottom-3 start-3 rounded bg-neutral-900/70 px-2 text-xs leading-6 text-white">تصویر ۱ از ۶</span></div>
    <div class="mt-2 hidden grid-cols-5 gap-2 lg:grid">${[4, 3, 2, 7, 1].map((n) => `<img src="../img/room${n}.webp" class="aspect-square rounded object-cover" alt="">`).join('')}</div>
  </div>
  <div class="px-4 pt-4 lg:px-0 lg:pt-0">${info}</div>
</main>
<div class="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white px-4 pt-3 pb-4 lg:hidden">${buttons}</div>`);
