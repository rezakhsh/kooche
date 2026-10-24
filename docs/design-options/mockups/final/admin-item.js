// Admin: one reported item. Content large on the start side, the reports and the seller's history
// next to it, and the decision on the end side: nothing chosen in advance, keys 1–5, reason chips,
// facts from a template, "save and next". The SLA clock and the place in the queue on top.
const reports = [['کلاهبرداری یا آگهی جعلی', '«قبل از دیدن اتاق ۳۹۰ یورو بیعانه خواست، گفت خودش در ترکیه است.»', '۲ ساعت پیش'], ['کلاهبرداری یا آگهی جعلی', '«همین متن را در گروه تلگرامی با عکس‌های دیگر دیدم.»', '۵ ساعت پیش']];
const actions = [['۱', 'مشکلی ندارد، گزارش‌ها رد شوند'], ['۲', 'هشدار به آگهی‌دهنده'], ['۳', 'برداشتن آگهی', true], ['۴', 'برداشتن و محدودیت انتشار ۷ روزه', true], ['۵', 'مسدود کردن حساب', true]];
const body = `
  <div class="flex flex-wrap items-center gap-2 text-sm"><a class="text-brand-800">صف بررسی</a>${I('chevronEnd', 'size-3.5 text-neutral-500')}<span>مورد ۱ از ۳</span>
    <span class="ms-auto flex items-center gap-1 rounded-full bg-saffron-50 px-3 font-bold leading-8 text-saffron-800">${I('clock', 'size-4')}۱۹ ساعت تا مهلت ۲۴ ساعته</span>
    <a class="flex h-9 items-center rounded-lg border border-neutral-300 bg-white px-3">قبلی <kbd class="ms-1.5 rounded bg-neutral-100 px-1 text-xs">K</kbd></a><a class="flex h-9 items-center rounded-lg border border-neutral-300 bg-white px-3">بعدی <kbd class="ms-1.5 rounded bg-neutral-100 px-1 text-xs">J</kbd></a></div>
  <div class="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr_20rem]">
    <section class="rounded-2xl border border-neutral-200 bg-white p-4">
      <p class="mb-2 flex items-center justify-between text-xs text-neutral-600"><span>عکس‌ها (${fa(4)})</span><span class="flex items-center gap-1.5">سیاه‌وسفید<span class="flex h-5 w-9 items-center rounded-full bg-neutral-300 p-0.5"><i class="size-4 rounded-full bg-white"></i></span></span></p>
      <div class="grid grid-cols-3 gap-1.5"><img src="../img/room7.webp" class="col-span-3 aspect-[16/10] w-full rounded-xl object-cover" alt="">${[8, 9, 2].map((n) => `<img src="../img/room${n}.webp" class="aspect-square w-full rounded-lg object-cover" alt="">`).join('')}</div>
      <h1 class="mt-3 text-lg font-extrabold">اتاق مبله نزدیک Alexanderplatz، فوری</h1>
      <p class="text-sm text-neutral-700"><b class="text-brand-800">۳۹۰ €</b> ماهانه، میته، کد ${faDigits(518204377)}، <span class="text-red-700">۳۸٪ ارزان‌تر از اتاق‌های مشابه</span></p>
      <p class="mt-2 text-sm leading-7 text-neutral-800">اتاق کاملاً مبله، خودم فعلاً در ترکیه هستم. برای رزرو لطفاً <mark class="rounded bg-red-100 px-0.5 text-red-900">بیعانه را اول واریز کنید</mark> تا <mark class="rounded bg-red-100 px-0.5 text-red-900">کلید را پست کنم</mark>.</p>
      <p class="mt-2 text-xs text-neutral-600">عبارت‌های قرمز در فهرست نشانه‌های کلاهبرداری هستند.</p>
    </section>
    <section class="space-y-4">
      <div class="rounded-2xl border border-neutral-200 bg-white p-4"><h2 class="font-extrabold">گزارش‌ها (${fa(2)})</h2>${reports.map(([r, t, w]) => `<div class="mt-3 border-t border-neutral-100 pt-3"><p class="flex justify-between text-sm"><b>${r}</b><span class="text-xs text-neutral-600">${w}</span></p><p class="mt-1 text-sm leading-7 text-neutral-700">${t}</p><p class="text-xs text-neutral-600">گزارش‌دهنده: ${fa(0)} گزارش بی‌پایه قبلی</p></div>`).join('')}</div>
      <div class="rounded-2xl border border-neutral-200 bg-white p-4"><h2 class="font-extrabold">آگهی‌دهنده</h2>
        <dl class="mt-2 divide-y divide-neutral-100 text-sm">${[['عضو از', '۲ روز پیش', 'text-red-700'], ['شماره', 'پیامک، +90', 'text-red-700'], ['آگهی‌ها', '۴ فعال، همه اتاق'], ['تصمیم‌های قبلی', '۱ هشدار'], ['متن مشابه', 'در ۲ آگهی دیگر همین حساب', 'text-red-700']].map(([k, v, c]) => `<div class="flex justify-between py-2"><dt class="text-neutral-600">${k}</dt><dd class="font-bold ${c || ''}">${v}</dd></div>`).join('')}</dl>
        <a class="mt-2 inline-block text-sm font-bold text-brand-800">دیدن ۳ آگهی دیگر</a></div>
    </section>
    <section class="rounded-2xl border border-neutral-200 bg-white p-4 xl:sticky xl:top-20 xl:self-start">
      <h2 class="font-extrabold">تصمیم</h2><p class="text-xs text-neutral-600">با کلید ۱ تا ۵ انتخاب کنید؛ هیچ گزینه‌ای از پیش انتخاب نمی‌شود. اینجا «۳» زده شده.</p>
      <ul class="mt-3 space-y-1.5">${actions.map(([k, t, red]) => `<li class="flex min-h-11 items-center gap-2.5 rounded-xl border ${k === '۳' ? 'border-2 border-red-600 bg-red-50 font-bold text-red-800' : 'border-neutral-200'} px-3 text-sm"><kbd class="rounded bg-neutral-100 px-1.5 text-xs text-neutral-700">${k}</kbd>${t}</li>`).join('')}</ul>
      <p class="mt-4 mb-1.5 text-sm font-bold">دلیل</p><div class="flex flex-wrap gap-1.5">${['کلاهبرداری', 'بیعانه پیش از دیدن', 'تکراری', 'اطلاعات غلط'].map((t, i) => `<span class="rounded-full border px-3 text-sm leading-8 ${i < 2 ? 'border-brand-600 bg-brand-50 font-bold text-brand-800' : 'border-neutral-300'}">${t}</span>`).join('')}</div>
      <p class="mt-1.5 text-xs text-neutral-600">بند شرایط: ۴٫۲ کلاهبرداری (خودکار از دلیل)</p>
      <p class="mt-4 mb-1.5 text-sm font-bold">واقعیت‌ها (برای کاربر)</p><p class="min-h-20 rounded-xl border border-neutral-300 p-2.5 text-sm leading-7">در توضیحات پیش از دیدن اتاق بیعانه خواسته شده و پست کردن کلید پیشنهاد شده است.</p>
      <a class="mt-4 flex h-12 items-center justify-center gap-2 rounded-xl bg-red-700 font-bold text-white">برداشتن آگهی و بعدی<kbd class="rounded bg-white/20 px-1.5 text-xs">Enter</kbd></a>
      <p class="mt-2 text-center text-xs text-neutral-600">متن کامل پیامِ کاربر پیش از ثبت نشان داده می‌شود.</p>
    </section>
  </div>`;
mount(adminShell('queue', body, { counts: { queue: '۳', system: '۱' } }) + `<div class="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-neutral-200 bg-white px-4 pt-3 pb-4 lg:hidden"><a class="flex h-12 items-center rounded-xl border border-neutral-300 px-4 font-bold">بعدی</a><a class="flex h-12 flex-1 items-center justify-center rounded-xl bg-brand-700 font-bold text-white">تصمیم بگیرید</a></div>`);
