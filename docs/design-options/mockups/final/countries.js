// The country chooser (the header's place chip or "کشور دیگر"): open countries with counts, then
// the ones coming soon with their start dates and a waitlist link, then the Turkey guide.
// Iran is not listed: from Iran the site is read-only.
const open = [['de', 'آلمان', 'Deutschland', 1205]];
const soon = [['ca', 'کانادا', 'رویدادها و کسب‌وکارها از ۱۲ ژانویه'], ['au', 'استرالیا', 'از ۱۹ ژانویه'], ['us', 'آمریکا', 'از ۲ فوریه'], ['gb', 'بریتانیا', 'از فوریه'], ['at', 'اتریش', 'از شب یلدا'], ['nl', 'هلند', 'از شب یلدا']];
document.write('<script src="home.js"><\/script>');
setTimeout(() => document.getElementById('app').insertAdjacentHTML('beforeend', sheet('کشورتان را انتخاب کنید', `
  <ul class="divide-y divide-neutral-100">${open.map(([f, fa1, local, n], i) => `<li class="flex min-h-16 items-center gap-3 ${i === 0 ? 'font-bold' : ''}">${flag(f, 'h-5 w-8')}<span class="flex-1"><span class="block text-base">${fa1}</span><span class="text-xs font-normal text-neutral-600" dir="ltr">${local}</span></span><span class="text-sm text-neutral-600">${fa(n)} آگهی</span>${i === 0 ? I('check', 'size-5 text-brand-700') : ''}</li>`).join('')}</ul>
  <p class="mt-4 mb-1 text-sm font-bold text-neutral-600">به‌زودی</p>
  <ul class="divide-y divide-neutral-100">${soon.map(([f, n, s]) => `<li class="flex min-h-14 items-center gap-3">${flag(f, 'h-5 w-8')}<span class="flex-1"><span class="block text-base">${n}</span>${s ? `<span class="text-xs text-saffron-800">${s}</span>` : ''}</span><a class="rounded-full border border-brand-200 bg-brand-50 px-3 text-sm font-bold leading-8 text-brand-800">خبرم کن</a></li>`).join('')}</ul>
  <p class="mt-4 mb-1 text-sm font-bold text-neutral-600">راهنما</p>
  <a class="flex min-h-14 items-center gap-3">${flag('tr', 'h-5 w-8')}<span class="flex-1"><span class="block text-base">ترکیه</span><span class="text-xs text-neutral-600">راهنما، هشدار کلاهبرداری و رویدادهای آنلاین</span></span>${I('chevronEnd', 'size-4 text-neutral-400')}</a>`)), 50);
