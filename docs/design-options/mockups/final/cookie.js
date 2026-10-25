// Only if Peydoo ever adds something that needs consent (analytics with cookies, ads, embeds):
// the two choices with the same weight, settings one tap away, nothing pre-ticked, no wall.
document.write('<script src="browse.js"><\/script>');
setTimeout(() => document.getElementById('app').insertAdjacentHTML('beforeend', `
<div class="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-200 bg-white px-4 pt-4 pb-5 shadow-2xl lg:inset-x-auto lg:bottom-6 lg:start-6 lg:w-[26rem] lg:rounded-2xl lg:border">
  <p class="text-base font-extrabold">کوکی‌ها</p>
  <p class="mt-1 text-sm leading-7 text-neutral-700">برای کار سایت فقط کوکی‌های ضروری لازم است. اگر اجازه بدهید، آمار بازدید را هم برای بهتر کردن پیدو می‌سنجیم. <a class="font-bold text-brand-800 underline">جزئیات</a></p>
  <div class="mt-3 grid grid-cols-2 gap-2"><a class="flex h-12 items-center justify-center rounded-xl border-2 border-brand-700 font-bold text-brand-800">فقط ضروری</a><a class="flex h-12 items-center justify-center rounded-xl border-2 border-brand-700 font-bold text-brand-800">قبول همه</a></div>
  <a class="mt-2 flex h-10 items-center justify-center text-sm font-bold text-neutral-700">انتخاب دقیق‌تر</a>
</div>`), 80);
