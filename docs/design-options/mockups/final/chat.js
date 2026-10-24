// A conversation fills the screen: back, the listing (photo, title, price), ⋯ for report, block
// and archive. A safety note once at the top, no flag beside every message, quick replies above
// the composer.
const msgs = [['in', 'سلام، اتاق هنوز خالیه؟', '۲۲:۵۳'], ['out', 'سلام، بله. از ۱ دسامبر خالی می‌شه.', '۲۲:۵۴'], ['in', 'می‌شه این هفته بیام ببینم؟', '۲۲:۵۵'], ['day', 'امروز'], ['out', 'پنجشنبه ساعت ۱۸ خوبه؟', '۰۰:۱۴'], ['in', 'عالیه، آدرس رو می‌فرستید؟', '۱۱:۳۵']];
mount(`<main class="mx-auto flex h-screen max-w-3xl flex-col bg-white lg:border-x lg:border-neutral-200">
  <header class="flex items-center gap-2 border-b border-neutral-200 px-2 py-2">
    <a class="flex size-11 items-center justify-center" aria-label="بازگشت">${I('back', 'size-6')}</a>
    <img src="../img/room1.webp" class="size-11 rounded-lg object-cover" alt="">
    <div class="min-w-0 flex-1"><p class="truncate text-[15px] font-bold">اجاره خانه در ودینگ</p><p class="truncate text-xs text-neutral-600">با کاربر نمونه، خریدار، <b class="text-brand-800">۸۷۰ €</b></p></div>
    <a class="flex size-11 items-center justify-center text-neutral-700" aria-label="کارهای بیشتر">${I('more', 'size-6')}</a>
  </header>
  <div class="flex-1 space-y-2 overflow-hidden bg-neutral-50 px-3 py-3">
    <p class="mx-auto flex max-w-sm gap-2 rounded-xl bg-saffron-50 p-2.5 text-xs leading-6 text-saffron-800">${I('shield', 'size-4 mt-1')}<span>پیش از دیدن خانه پولی واریز نکنید. پیدو هرگز کد یا رمز از شما نمی‌خواهد.</span></p>
    ${msgs.map(([k, t, time]) => k === 'day' ? `<p class="py-1 text-center"><span class="rounded-full bg-white px-3 text-xs leading-7 text-neutral-600 ring-1 ring-neutral-200">${t}</span></p>`
      : `<div class="flex ${k === 'out' ? 'justify-end' : ''}"><p class="max-w-[78%] rounded-2xl px-3.5 py-2 text-[15px] leading-7 ${k === 'out' ? 'rounded-ee-md bg-brand-700 text-white' : 'rounded-es-md bg-white ring-1 ring-neutral-200'}">${t}<span class="ms-2 inline-flex items-center gap-0.5 align-bottom text-xs ${k === 'out' ? 'text-brand-100' : 'text-neutral-500'}">${time}${k === 'out' ? I('checks', 'size-3.5') : ''}</span></p></div>`).join('')}
  </div>
  <div class="border-t border-neutral-200 bg-white px-3 pt-2 pb-4">
    <div class="no-scrollbar mb-2 flex gap-2 overflow-x-auto">${['هنوز موجود است', 'کی وقت دارید ببینید؟', 'آدرس را می‌فرستم', 'اجاره داده شد'].map((q) => `<span class="flex h-9 shrink-0 items-center rounded-full border border-brand-200 bg-brand-50 px-3 text-sm text-brand-800">${q}</span>`).join('')}</div>
    <div class="flex items-end gap-2"><span class="flex min-h-12 flex-1 items-center rounded-2xl border border-neutral-300 px-4 text-[15px] text-neutral-500">پیامتان را بنویسید…</span><a class="flex size-12 items-center justify-center rounded-full bg-brand-700 text-white" aria-label="فرستادن">${I('send', 'size-5')}</a></div>
  </div>
</main>`);
