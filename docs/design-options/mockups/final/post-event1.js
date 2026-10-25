// Posting an event, step 1: the poster first (the one already made for Instagram, 4:5), the
// Instagram caption pasted to fill the form, then the type as chips and the title.
const types = ['کنسرت', 'مهمانی', 'فرهنگی و ادبی', 'دورهمی', 'کارگاه و کلاس', 'یادبود و همبستگی', 'کودکان', 'ورزش'];
mount(`${appBar('رویداد تازه', { lead: 'close' })}
<main class="mx-auto w-full max-w-2xl px-4 pt-4 pb-28">
  ${steps(1, ['پوستر و عنوان', 'زمان و مکان', 'بلیت و انتشار'])}
  <h1 class="mt-5 text-2xl font-extrabold">با پوستر شروع کنید</h1>
  <p class="mt-1 text-sm text-neutral-600">همان پوستری که برای اینستاگرام ساخته‌اید (عمودی ۴ به ۵ بهترین است).</p>
  <div class="mt-4 grid grid-cols-[9rem_1fr] gap-3">
    <div class="relative overflow-hidden rounded-2xl text-[10px]">${poster(E.nava)}<span class="absolute bottom-1.5 end-1.5 flex size-8 items-center justify-center rounded-full bg-white/95">${I('more', 'size-4')}</span></div>
    <div class="flex flex-col gap-2"><a class="flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-brand-400 bg-brand-50/50 text-sm font-bold text-brand-800">${I('camera', 'size-6')}عکس‌های بیشتر</a>
      <p class="text-xs leading-6 text-neutral-600">عکس سالن یا اجرای قبلی هم کمک می‌کند.</p></div>
  </div>
  <div class="mt-5 rounded-2xl border border-brand-200 bg-brand-50/60 p-3.5"><p class="flex items-center gap-2 text-sm font-bold text-brand-800">${I('sparkle', 'size-4')}متن پست اینستاگرام یا تلگرام را بچسبانید</p>
    <p class="mt-1 text-xs leading-6 text-neutral-700">عنوان، تاریخ، شهر، سالن و قیمت را از آن پر می‌کنیم؛ شما فقط بررسی می‌کنید.</p>
    <span class="mt-2 flex h-11 items-center justify-center rounded-xl border border-brand-300 bg-white text-sm font-bold text-brand-800">چسباندن متن</span></div>
  <p class="mt-6 mb-1.5 text-sm font-bold">نوع رویداد</p>
  <div class="flex flex-wrap gap-2">${types.map((t, i) => `<span class="flex h-10 items-center rounded-full border px-3.5 text-sm ${i === 0 ? 'border-2 border-brand-600 bg-brand-50 font-bold text-brand-800' : 'border-neutral-300'}">${t}</span>`).join('')}</div>
  <label class="mt-5 block"><span class="flex justify-between text-sm font-bold"><span>عنوان</span><span class="font-normal text-neutral-600">${fa(32)} از ${fa(90)}</span></span>
  <span class="mt-1.5 flex h-12 items-center rounded-xl border-2 border-brand-600 px-4 text-base">کنسرت موسیقی ایرانی: گروه نوا</span>
  <span class="mt-1 block text-xs text-neutral-600">بدون تاریخ و نام سالن؛ آن‌ها جای خودشان را دارند.</span></label>
</main>${stepBar('ادامه: زمان و مکان', '')}`);
