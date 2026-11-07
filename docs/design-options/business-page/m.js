// How a business adds its menu or price list: «منو و قیمت‌ها» in the business panel. Groups with
// rows (photo, name, one line, price, «پرطرفدار»), drag to sort, saved as you go; a list type per
// business (menu, services with duration, price list, services without prices); a paper menu can be
// photographed and read in by AI, then checked. Steps (?state=): panel (the new tile in the business
// panel), empty (first visit), kind (list type), photo (menu from a photo), review (the draft it made),
// (none: the list), add (new item), drag (reordering).
const KINDS = [['منوی رستوران', 'غذا، توضیح، قیمت، عکس'], ['خدمات با مدت', 'آرایشگاه، ماساژ: مدت و قیمت'], ['فهرست قیمت', 'مترجم، تعمیرکار، اسباب‌کشی'], ['خدمات بدون قیمت', 'پزشک، وکیل: قیمت اختیاری']];
const handle = `<span class="flex size-8 shrink-0 items-center justify-center text-neutral-400" aria-label="جابه‌جا کردن"><svg viewBox="0 0 24 24" class="size-5" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></span>`;
const itemRow = ([n, d, p, k, pop]) => `<li class="flex items-center gap-2 py-2.5 ${p.startsWith('—') ? '-mx-3 bg-saffron-50 px-3' : ''}">${handle}
  ${k ? `<img src="${img(k)}" alt="" class="size-12 shrink-0 rounded-lg object-cover">` : `<span class="flex size-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-neutral-300 text-neutral-500">${I('camera', 'size-5')}</span>`}
  <div class="min-w-0 flex-1"><p class="truncate text-sm font-bold">${n}</p><p class="truncate text-xs text-neutral-600">${d}</p></div>
  ${p.startsWith('—') ? '<span class="flex h-9 w-16 shrink-0 items-center justify-center rounded-lg border-2 border-saffron-500 bg-white text-xs font-bold text-saffron-800">قیمت؟</span>' : `<b class="shrink-0 text-sm text-brand-800">${p}</b>`}
  <span class="flex size-10 shrink-0 items-center justify-center rounded-full ${pop ? 'text-saffron-700' : 'text-neutral-400'}" aria-label="پرطرفدار">${I('star', `size-5 ${pop ? 'fill-current' : ''}`)}</span>
  <span class="flex size-10 shrink-0 items-center justify-center text-neutral-600">${I('more', 'size-5')}</span></li>`;

const group = (c) => `<section class="rounded-2xl border border-neutral-200 bg-white px-3 pt-2 pb-1">
  <div class="flex items-center gap-2">${handle}<h2 class="flex-1 font-extrabold">${c.cat} <span class="text-sm font-normal text-neutral-600">(${fa(c.items.length)})</span></h2><span class="flex size-10 items-center justify-center text-neutral-600">${I('more', 'size-5')}</span></div>
  <ul class="divide-y divide-neutral-200 border-t border-neutral-200">${c.items.map(itemRow).join('')}</ul>
  <a class="flex min-h-11 items-center gap-1.5 border-t border-neutral-200 text-sm font-bold text-brand-800">${I('plus', 'size-4')}افزودن به «${c.cat}»</a></section>`;

const addSheet = sheet('غذای تازه', `
  <div class="flex gap-3"><span class="flex size-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-neutral-300 text-xs text-neutral-600">${I('camera', 'size-6')}عکس<br>(اختیاری)</span>
    <div class="flex-1 space-y-3"><label class="block text-sm font-bold">نام<div class="mt-1 flex h-11 items-center rounded-xl border border-brand-600 bg-white px-3 font-normal">کشک بادمجان</div></label></div></div>
  <label class="mt-3 block text-sm font-bold">یک خط توضیح <span class="font-normal text-neutral-600">(اختیاری)</span><div class="mt-1 flex h-11 items-center rounded-xl border border-neutral-300 bg-white px-3 font-normal text-neutral-800">با نعناداغ و نان تازه</div></label>
  <div class="mt-3 grid grid-cols-[1fr_auto] gap-2"><label class="block text-sm font-bold">قیمت<div class="mt-1 flex h-11 items-center justify-between rounded-xl border border-neutral-300 bg-white px-3 font-normal"><span>۷٫۵۰</span><span class="text-neutral-600">€</span></div></label>
    <label class="block text-sm font-bold">&nbsp;<span class="mt-1 flex h-11 items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 font-normal"><i class="size-5 rounded border-2 border-neutral-400"></i>«از»</span></label></div>
  <p class="mt-3 text-sm font-bold">گروه</p><div class="mt-2 flex flex-wrap gap-2">${B.menu.map((c, i) => chip(c.cat, { on: i === 2 })).join('')}${chip('+ گروه تازه')}</div>
  <div class="mt-4 flex items-center justify-between rounded-xl bg-neutral-50 p-3"><span><b class="block text-sm">پرطرفدار</b><span class="text-xs text-neutral-600">اول صفحه نشان داده می‌شود (تا ۵ ردیف)</span></span><span class="flex h-7 w-12 items-center rounded-full bg-neutral-300 p-1"><i class="size-5 rounded-full bg-white"></i></span></div>`,
  `<a class="flex h-12 items-center justify-center rounded-xl bg-brand-700 font-bold text-white">افزودن</a>`);

const photoSheet = sheet('منو از روی عکس', `
  <p class="text-sm leading-7 text-neutral-700">از منوی کاغذی یا تابلوی قیمت‌ها عکس بگیرید. فهرست را برایتان پر می‌کنیم؛ قبل از انتشار همه را می‌بینید و درست می‌کنید.</p>
  <div class="mt-3 grid grid-cols-3 gap-2"><div class="relative aspect-[3/4] overflow-hidden rounded-xl bg-[#f3ead8] p-2 text-[9px] leading-4 text-[#5b4426]"><b class="block text-center text-[11px]">سفرهٔ نیلوفر</b>کوبیده ...... ۱۶٫۵۰<br>جوجه ......... ۱۷٫۹۰<br>قورمه‌سبزی .... ۱۵٫۵۰<br>قیمه ........... ۱۵٫۰۰<br>کشک بادمجان .. ۷٫۵۰<span class="absolute top-1.5 end-1.5 flex size-5 items-center justify-center rounded-full bg-brand-700 text-white">${I('check', 'size-3', 3)}</span></div>
    <span class="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-neutral-300 text-xs text-neutral-600">${I('plus', 'size-5')}صفحهٔ بعد</span></div>
  <div class="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-3"><p class="flex items-center gap-1.5 text-sm font-bold text-brand-800">${I('sparkle', 'size-4')}۶ ردیف پیدا شد، در ۳ گروه</p><p class="mt-1 text-xs leading-6 text-neutral-700">«کباب ۲، خورش ۲، پیش‌غذا ۲». قیمت دو ردیف خوانا نبود؛ زرد نشانشان داده‌ایم.</p></div>`,
  `<a class="flex h-12 items-center justify-center rounded-xl bg-brand-700 font-bold text-white">دیدن و درست کردن فهرست</a>`);


const bar = (label, icon = 'plus') => `<div class="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white px-4 pt-2.5 pb-3 lg:static lg:mx-auto lg:max-w-2xl lg:border-0 lg:bg-transparent"><a class="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-brand-700 font-bold text-white">${I(icon, 'size-5')}${label}</a></div>`;
const topBar = appBar('منو و قیمت‌ها', { sub: B.name, action: `<a class="flex h-10 items-center gap-1 rounded-xl px-3 text-sm font-bold text-brand-800">${I('store', 'size-4')}دیدن صفحه</a>` });
const intro = `<div class="flex items-start gap-2 rounded-2xl bg-brand-50 p-3 text-sm leading-6 text-brand-800">${I('info', 'size-5 mt-0.5')}<span>این فهرست در صفحهٔ شما با عنوان «منو» می‌آید. ردیف‌های ستاره‌دار (پرطرفدار) اول نشان داده می‌شوند. برای جابه‌جا کردن، ردیف را بگیرید و بکشید.</span></div>`;
const kindCard = `<div class="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-3"><span><span class="block text-xs text-neutral-600">نوع فهرست</span><b>${KINDS[0][0]}</b> <span class="text-xs text-neutral-600">(${KINDS[0][1]})</span></span><a class="flex h-10 items-center rounded-xl border border-neutral-300 px-3 text-sm font-bold">عوض کردن</a></div>`;
const photoCta = `<a class="flex items-center gap-3 rounded-2xl border border-dashed border-brand-300 bg-white p-3"><span class="flex size-11 items-center justify-center rounded-full bg-brand-50 text-brand-800">${I('camera', 'size-5')}</span><span class="flex-1"><b class="block text-sm">منوی کاغذی دارید؟ عکسش را بفرستید</b><span class="text-xs text-neutral-600">فهرست را خودکار پر می‌کنیم، شما بررسی می‌کنید</span></span>${I('chevronEnd', 'size-5 text-neutral-500')}</a>`;
const list = (groups) => groups.map(group).join('') + `<a class="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-neutral-300 bg-white font-bold">${I('plus', 'size-4')}گروه تازه</a>`;
const saved = `<p class="flex items-center justify-center gap-1 text-xs text-neutral-600">${I('check', 'size-3.5')}همهٔ تغییرها ذخیره شد</p>`;
const wrap = (inner) => `<main class="mx-auto w-full max-w-2xl space-y-4 px-4 pt-4 pb-28 lg:pb-6">${inner}</main>`;

// Step 1: the business panel, with the new tile
const tile = (ic, l, isNew) => `<a class="relative flex flex-col items-center justify-center gap-2 rounded-2xl border ${isNew ? 'border-2 border-saffron-500 bg-saffron-50' : 'border-neutral-200 bg-white'} py-5 text-sm font-bold">${I(ic, `size-6 ${isNew ? 'text-saffron-700' : 'text-brand-700'}`)}${l}${isNew ? '<span class="absolute top-2 start-2 rounded-full bg-saffron-500 px-2 text-xs leading-5 text-neutral-900">تازه</span>' : ''}</a>`;
const panel = `${header()}<main class="mx-auto w-full max-w-3xl space-y-4 px-4 pt-5 pb-24">
  <div class="flex items-center gap-3">${logoBox('size-12 rounded-2xl ring-0')}<div><h1 class="text-xl font-extrabold">${B.name}</h1><p class="text-sm text-neutral-600">پنل کسب‌وکار، ${B.place}</p></div></div>
  <section class="rounded-3xl border border-neutral-200 bg-white p-4"><div class="mb-3 flex items-center justify-between"><h2 class="font-extrabold">اشتراک: <span class="rounded-full bg-saffron-50 px-2 text-sm text-saffron-800">پرو</span></h2><span class="text-sm text-neutral-600">${fa(4)} از ${fa(25)} آگهی فعال</span></div>
    <a class="mb-2 flex items-center gap-3 rounded-2xl border-2 border-saffron-500 bg-saffron-50 p-4"><span class="flex size-12 items-center justify-center rounded-full bg-white text-saffron-700">${I('menu', 'size-6')}</span><span class="flex-1"><b class="flex items-center gap-2">منو و قیمت‌ها<span class="rounded-full bg-saffron-500 px-2 text-xs leading-5 text-neutral-900">تازه</span></b><span class="text-sm text-neutral-700">غذاها و قیمت‌ها را اضافه کنید تا در صفحهٔ شما دیده شوند</span></span>${I('chevronEnd', 'size-5 text-neutral-500')}</a>
    <div class="grid grid-cols-3 gap-2">${tile('plus', 'آگهی تازه')}${tile('calendar', 'رویداد تازه')}${tile('store', 'صفحهٔ عمومی')}${tile('gear', 'ویرایش اطلاعات')}${tile('people', 'همکاران')}${tile('card', 'اشتراک و فاکتورها')}</div></section>
</main>${bottomNav(3)}`;

// Step 2: first visit, nothing yet
const empty = `${topBar}${wrap(`<div class="flex flex-col items-center rounded-3xl border border-neutral-200 bg-white px-5 py-8 text-center">
  <span class="flex size-16 items-center justify-center rounded-full bg-brand-50 text-brand-800">${I('menu', 'size-8')}</span>
  <h2 class="mt-3 text-lg font-extrabold">هنوز منویی ندارید</h2><p class="mt-1 max-w-sm text-sm leading-7 text-neutral-600">غذاها و قیمت‌ها را اضافه کنید تا در صفحهٔ شما زیر «منو» دیده شوند. مشتری‌ها قبل از پیام دادن قیمت را می‌بینند.</p>
  <a class="mt-5 flex h-12 w-full max-w-sm items-center justify-center gap-1.5 rounded-xl bg-brand-700 font-bold text-white">${I('camera', 'size-5')}از روی عکس منو</a>
  <a class="mt-2 flex h-12 w-full max-w-sm items-center justify-center gap-1.5 rounded-xl border border-neutral-300 font-bold">${I('plus', 'size-5')}دستی اضافه می‌کنم</a></div>${kindCard}`)}`;

// Step 3: the list type (chosen from the business type, changeable)
const kindSheet = sheet('نوع فهرست', `<p class="mb-2 text-sm text-neutral-600">از نوع کسب‌وکار شما انتخاب شده؛ اگر لازم است عوضش کنید.</p><ul class="space-y-2">${KINDS.map(([k, d], i) => `<li><a class="flex items-center gap-3 rounded-xl border ${i === 0 ? 'border-2 border-brand-600 bg-brand-50' : 'border-neutral-300 bg-white'} p-3"><span class="flex size-5 items-center justify-center rounded-full border-2 ${i === 0 ? 'border-brand-700' : 'border-neutral-400'}">${i === 0 ? '<i class="size-2.5 rounded-full bg-brand-700"></i>' : ''}</span><span><b class="block text-sm">${k}</b><span class="text-xs text-neutral-600">${d}</span></span></a></li>`).join('')}</ul>`, `<a class="flex h-12 items-center justify-center rounded-xl bg-brand-700 font-bold text-white">انتخاب</a>`);

// Step 5: the draft read from the photo, two prices to check
const reviewRows = B.menu.slice(0, 3).map((c, gi) => ({ ...c, items: c.items.map((it, ii) => [it[0], it[1], gi === 1 && ii === 1 ? '— €' : gi === 2 && ii === 0 ? '— €' : it[2], null, false]) }));
const review = `${topBar}${wrap(`<div class="rounded-2xl border border-saffron-300 bg-saffron-50 p-3"><p class="flex items-center gap-1.5 text-sm font-bold text-saffron-800">${I('sparkle', 'size-4')}پیش‌نویس از روی عکس: ۶ ردیف در ۳ گروه</p><p class="mt-1 text-xs leading-6 text-neutral-700">قیمت دو ردیف خوانا نبود (زرد). آن‌ها را بنویسید، بقیه را نگاه کنید و منتشر کنید. تا انتشار، مشتری‌ها چیزی نمی‌بینند.</p></div>
  ${reviewRows.map(group).join('')}`)}${bar('انتشار در صفحه', 'check')}`;

// Step 7: reordering, one row lifted
const dragGroups = [{ cat: 'کباب', items: B.menu[0].items }];
const drag = `${topBar}${wrap(`${intro}<section class="rounded-2xl border border-neutral-200 bg-white px-3 pt-2 pb-1"><div class="flex items-center gap-2">${handle}<h2 class="flex-1 font-extrabold">کباب <span class="text-sm font-normal text-neutral-600">(${fa(3)})</span></h2></div>
  <ul class="border-t border-neutral-200">${itemRow(B.menu[0].items[0])}
    <li class="relative z-10 -mx-2 my-1 rotate-[-1deg] rounded-xl bg-white px-2 shadow-lg ring-2 ring-brand-600"><ul>${itemRow(B.menu[1].items[0])}</ul></li>
    <li class="my-1 h-14 rounded-xl border-2 border-dashed border-brand-300 bg-brand-50"></li>${itemRow(B.menu[0].items[1])}</ul></section>
  <p class="text-center text-xs text-neutral-600">«قورمه‌سبزی» را از گروه خورش به کباب می‌کشید؛ رها کنید تا جایش ثبت شود.</p>`)}`;

const listPage = `${topBar}${wrap(`${intro}${kindCard}${photoCta}${list(B.menu)}${saved}`)}${bar('افزودن غذا')}`;

mount({
  panel, empty,
  kind: `${empty}${kindSheet}`,
  photo: `${empty}${photoSheet}`,
  review,
  add: `${listPage}${addSheet}`,
  drag,
}[STATE] ?? listPage);
