// Round 12: the difference between a private and a business listing, in one page. The big
// difference is visibility. Private stays free for selling one's own things; a business gets a
// page, a place in the city directory and on the city's first page, links and statistics.
const rows = [
  ['برای چه کسی', 'فروش گاه‌به‌گاه وسایل خودتان: فرش، مبل، دوچرخه', 'درآمد مرتب: رستوران، آرایشگاه، مترجم، اسباب‌کشی، فروشگاه'],
  ['دیده شدن', 'فقط در فهرست آگهی‌ها', '<b>صفحهٔ خودتان در فهرست کسب‌وکارهای شهر، بخش «کسب‌وکارهای تأییدشده» در صفحهٔ اول، و در گوگل</b>'],
  ['راه تماس', 'گفت‌وگو در پیدو', 'گفت‌وگو، تلفن، وب‌سایت، اینستاگرام، واتس‌اپ و تلگرام'],
  ['آگهی‌ها', 'رایگان', '۳ آگهی رایگان؛ ۲۵ با پرو، ۱۰۰ با پرو پلاس'],
  ['منو و قیمت‌ها', '—', 'منو یا فهرست قیمت، جدا از آگهی‌ها'],
  ['رویداد و کار', 'رویداد شخصی', 'رویداد، آگهی استخدام'],
  ['آمار بازدید', '—', 'بله'],
  ['نشان', '—', '«تأییدشده»، و برای اولی‌ها «بنیان‌گذار» در سال اول'],
  ['هزینه', 'رایگان', 'صفحه رایگان؛ پرو ۲۴ € در ماه (۶ ماه رایگان برای بنیان‌گذاران)'],
];
mount(`${appBar('آگهی شخصی یا کسب‌وکار؟')}
<main class="mx-auto w-full max-w-3xl px-4 pt-5 pb-24">
  <h1 class="text-2xl font-black leading-[1.5]">فرق اصلی: دیده شدن</h1>
  <p class="mt-1 text-[15px] leading-8 text-neutral-700">آگهی شخصی برای فروش وسایل خودتان است و رایگان می‌ماند. کسب‌وکار یک صفحه و یک تابلو دارد: مشتری‌ها شما را در فهرست شهر، در صفحهٔ اول و در گوگل پیدا می‌کنند.</p>
  <div class="mt-5 grid grid-cols-2 gap-2">
    <div class="rounded-2xl border border-neutral-200 p-3"><p class="flex items-center gap-1.5 text-sm font-extrabold">${I('user', 'size-4 text-neutral-600')}شخص</p><div class="mt-2 rounded-xl bg-neutral-50 p-2"><span class="block h-16 rounded-lg bg-neutral-200"></span><span class="mt-2 block text-xs font-bold">فرش دستباف ۲×۳</span><span class="text-xs text-neutral-600">۴۵۰ €، شنبه</span></div></div>
    <div class="rounded-2xl border-2 border-brand-300 bg-brand-50 p-3"><p class="flex items-center gap-1.5 text-sm font-extrabold text-brand-800">${I('store', 'size-4')}کسب‌وکار</p><div class="mt-2 rounded-xl bg-white p-2"><span class="flex items-center gap-2"><span class="flex size-9 items-center justify-center rounded-lg bg-brand-100 text-xs font-black text-brand-800">فرش</span><span class="text-xs"><b class="block">گالری فرش نمونه</b><span class="text-brand-800">${I('verified', 'size-3 inline')} تأییدشده</span></span></span><span class="mt-2 flex gap-1">${['send', 'phone', 'globe'].map((i) => `<span class="flex size-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700">${I(i, 'size-3.5')}</span>`).join('')}</span><span class="mt-1 block text-xs text-neutral-600">۲۳ آگهی، ۴٫۸ از ۵</span></div></div>
  </div>
  <div class="mt-5 overflow-hidden rounded-2xl border border-neutral-200">
    <table class="w-full text-sm"><thead class="bg-neutral-50 text-xs text-neutral-600"><tr><th class="p-2.5 text-start font-bold"></th><th class="p-2.5 text-start font-bold">شخص</th><th class="p-2.5 text-start font-bold text-brand-800">کسب‌وکار</th></tr></thead>
    <tbody class="divide-y divide-neutral-200">${rows.map(([k, a, b], i) => `<tr class="${i === 1 ? 'bg-brand-50/60' : ''}"><td class="p-2.5 align-top text-xs font-bold text-neutral-700">${k}</td><td class="p-2.5 align-top text-xs leading-6 text-neutral-700">${a}</td><td class="p-2.5 align-top text-xs leading-6">${b}</td></tr>`).join('')}</tbody></table>
  </div>
  <div class="mt-5 rounded-2xl bg-saffron-50 p-4 text-sm leading-7"><b class="text-saffron-800">کدام را انتخاب کنم؟</b> اگر برای درآمد مرتب می‌فروشید یا خدمت می‌دهید، کسب‌وکار. قانون هم همین را می‌خواهد. خدماتی مثل مشاورهٔ حقوقی و مهاجرت، پزشکی، مالیات و مشاور املاک فقط با صفحهٔ کسب‌وکار و مجوز. تدریس خصوصی، پرستاری بچه و کمک در خانه برای همه آزاد است.</div>
  <div class="mt-4 flex items-center gap-3 rounded-2xl bg-neutral-100 p-3.5"><span class="flex size-12 items-center justify-center rounded-xl bg-white text-brand-700">${I('camera', 'size-6')}</span><span class="flex-1"><b class="block text-sm">ویدیوی یک‌دقیقه‌ای: شخصی یا کسب‌وکار؟</b><span class="text-xs text-neutral-600">به‌زودی</span></span></div>
  <div class="mt-5 grid grid-cols-2 gap-2"><a class="flex h-12 items-center justify-center rounded-xl border border-neutral-300 font-bold">آگهی شخصی</a><a class="flex h-12 items-center justify-center rounded-xl bg-brand-700 font-bold text-white">صفحهٔ کسب‌وکار</a></div>
</main>`);
