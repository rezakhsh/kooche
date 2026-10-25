// Turkey in "events and businesses" mode (Istanbul starter, planned for mid-2027): events by city,
// a directory of verified consumer businesses with the date of their last check, the guide, and
// a waitlist for listings from people (Turkish law requires e-Devlet checks for property and car
// ads). Free; no payments; chat only with businesses and organisers.
const cities = ['استانبول', 'آنکارا', 'آنتالیا', 'ازمیر', 'وان'];
const events = [['جمعه', '۱۸ ژوئن', 'شب موسیقی ایرانی با تار و آواز', 'Kadıköy، از ۴۰۰ لیر'], ['شنبه', '۱۹ ژوئن', 'دورهمی دانشجویان ایرانی استانبول', 'Beşiktaş، رایگان'], ['یکشنبه', '۲۰ ژوئن', 'کارگاه اقامت و کار برای تازه‌واردها', 'آنلاین، رایگان']];
const biz = [['رستوران', 'رستوران ایرانی، Şişli', 'غذای خانگی، بیرون‌بر'], ['ترجمه', 'مترجم رسمی قسم‌خورده', 'فارسی، ترکی، انگلیسی؛ Fatih'], ['زبان', 'آموزشگاه زبان ترکی', 'کلاس فشرده برای تازه‌واردها؛ Kadıköy']];
mount(`${header({ place: 'استانبول', search: 'جستجو در رویدادها و کسب‌وکارها…' })}
<main class="mx-auto w-full max-w-5xl px-4 pb-24">
  <section class="pt-6 lg:pt-10">
    <p class="flex items-center gap-2 text-sm font-bold text-brand-800">${flag('tr', 'h-4 w-6')}ترکیه</p>
    <h1 class="mt-2 text-[26px] font-black leading-[1.5] lg:text-4xl">رویدادها و کسب‌وکارهای ایرانی در ترکیه</h1>
    <p class="mt-1 text-[15px] leading-8 text-neutral-700">همه رایگان، کسب‌وکارها و برگزارکننده‌ها تأییدشده.</p>
    <div class="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">${cities.map((c, i) => chip(c, { on: i === 0 })).join('')}</div>
  </section>
  <div class="lg:grid lg:grid-cols-[1fr_20rem] lg:gap-8">
    <div>
      <h2 class="mt-6 flex items-center justify-between text-lg font-extrabold">رویدادهای این هفته<a class="text-sm font-bold text-brand-800">همه</a></h2>
      <ul class="mt-3 space-y-2">${events.map(([d, n, t, s]) => `<li class="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3"><span class="flex w-14 shrink-0 flex-col items-center rounded-xl bg-saffron-50 py-1.5 text-saffron-800"><span class="text-xs">${d}</span><b class="text-sm">${n}</b></span><span class="min-w-0 flex-1"><b class="block text-sm leading-6">${t}</b><span class="text-xs text-neutral-600">${s}</span></span>${I('chevronEnd', 'size-4 text-neutral-400')}</li>`).join('')}</ul>
      <h2 class="mt-7 flex items-center justify-between text-lg font-extrabold">کسب‌وکارهای تأییدشده<a class="text-sm font-bold text-brand-800">همه</a></h2>
      <div class="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">${['همه', 'رستوران و خوراکی', 'مترجم رسمی', 'آموزشگاه', 'آرایشگاه', 'وکیل', 'حسابدار'].map((c, i) => chip(c, { on: i === 0 })).join('')}</div>
      <ul class="mt-3 grid gap-2 lg:grid-cols-3">${biz.map(([tile, t, s]) => `<li class="rounded-2xl border border-neutral-200 p-3"><div class="flex items-center gap-3"><span class="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-xs font-black text-brand-800">${tile}</span><span class="min-w-0 flex-1"><b class="block truncate text-sm">${t}</b><span class="text-xs text-neutral-600">${s}</span></span></div><p class="mt-2 flex items-center gap-1 text-xs font-bold text-brand-800">${I('verified', 'size-3.5')}تأییدشده، آخرین بررسی مه ۲۰۲۷</p></li>`).join('')}</ul>
    </div>
    <aside>
      <div class="mt-6 rounded-2xl bg-neutral-50 p-4"><h2 class="font-extrabold">آگهی‌های شخصی در ترکیه</h2>
        <p class="mt-1 text-sm leading-7 text-neutral-700">خانه، خودرو و خرید و فروش هنوز باز نیست: قانون ترکیه برای آگهی خانه و خودرو تأیید e-Devlet می‌خواهد. وقتی بتوانیم درست انجامش دهیم خبرتان می‌کنیم.</p>
        <a class="mt-3 flex h-11 items-center justify-center rounded-xl border border-neutral-300 bg-white text-sm font-bold">خبرم کن</a></div>
      <div class="mt-3 rounded-2xl border border-brand-200 bg-brand-50 p-4"><h2 class="font-extrabold">کسب‌وکار یا برگزارکننده هستید؟</h2>
        <p class="mt-1 text-sm leading-7 text-neutral-700">رایگان ثبت کنید. با <bdi>vergi levhası</bdi> و شمارهٔ <bdi>MERSİS</bdi> تأیید می‌شوید.</p>
        <a class="mt-3 flex h-11 items-center justify-center rounded-xl bg-brand-700 text-sm font-bold text-white">ثبت کسب‌وکار یا رویداد</a></div>
      <a class="mt-3 flex items-center gap-3 rounded-2xl bg-saffron-50 p-3.5"><span class="flex size-10 items-center justify-center rounded-xl bg-white text-saffron-800">${I('alert', 'size-5')}</span><span class="flex-1"><b class="block text-sm">راهنما و هشدار کلاهبرداری</b><span class="text-xs text-saffron-800">اقامت، ویزا، دانشگاه</span></span>${I('chevronEnd', 'size-4 text-neutral-400')}</a>
    </aside>
  </div>
</main>${footer()}${bottomNav(0)}`);
