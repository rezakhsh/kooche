// A new business, step 1 of 3: only what the public page needs to start (name, category, city,
// logo); the address is made from the name. Legal details come in step 3 and can wait until
// the "verified" badge or the first payment.
mount(`${appBar('کسب‌وکار تازه', { lead: 'close' })}
<main class="mx-auto w-full max-w-2xl px-4 pt-4 pb-28">
  ${steps(1, ['دربارهٔ کسب‌وکار', 'تماس و ساعت کار', 'اطلاعات قانونی'])}
  <h1 class="mt-5 text-2xl font-extrabold">کسب‌وکارتان را معرفی کنید</h1>
  <p class="mt-1 text-sm text-neutral-600">دو دقیقه طول می‌کشد. بعد می‌توانید اولین آگهی را بگذارید.</p>
  <div class="mt-5 flex items-center gap-4"><span class="flex size-20 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-brand-400 bg-brand-50/50 text-xs font-bold text-brand-800">${I('camera', 'size-6')}لوگو</span><p class="text-xs leading-6 text-neutral-600">مربع، دست‌کم ۴۰۰ پیکسل. اختیاری، ولی صفحه را معتبرتر می‌کند.</p></div>
  <label class="mt-5 block"><span class="text-sm font-bold">نام کسب‌وکار</span><span class="mt-1.5 flex h-12 items-center rounded-xl border-2 border-brand-600 px-4 text-base">دارالترجمه پارسیان</span></label>
  <p class="mt-1 text-xs text-neutral-600">نشانی صفحه: <bdi dir="ltr" class="font-bold text-neutral-800">peydoo.com/b/parsian-translations</bdi> <a class="font-bold text-brand-800">تغییر</a></p>
  <p class="mt-5 mb-1.5 text-sm font-bold">چه کاری می‌کنید؟</p>
  <div class="flex flex-wrap gap-2">${['ترجمه و کارهای اداری', 'تعمیرات و ساختمان', 'آرایشگری و زیبایی', 'آموزش و کلاس', 'املاک', 'خودرو', 'رستوران و خوراکی', 'دیگر'].map((t, i) => `<span class="flex h-10 items-center rounded-full border px-3.5 text-sm ${i === 0 ? 'border-2 border-brand-600 bg-brand-50 font-bold text-brand-800' : 'border-neutral-300'}">${t}</span>`).join('')}</div>
  <p class="mt-5 mb-1.5 text-sm font-bold">کجا</p>
  <span class="flex h-12 items-center justify-between rounded-xl border border-neutral-400 px-4 text-base"><span>شارلوتنبورگ، برلین</span>${flag('de', 'h-4 w-6')}</span>
  <label class="mt-3 flex items-center gap-2 text-sm"><span class="flex size-5 items-center justify-center rounded bg-brand-700 text-white">${I('check', 'size-3.5', 3)}</span>آنلاین هم خدمت می‌دهیم</label>
</main>${stepBar('ادامه: تماس و ساعت کار', '')}`);
