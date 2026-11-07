// What «منو و قیمت‌ها» becomes for other businesses: the same list, with a type per business
// (title, columns and wording change; event organisers have none, their events lead instead).
const TYPES = [
  { who: 'رستوران', kind: 'منوی رستوران', title: 'پرطرفدارهای منو', rows: [['چلوکباب کوبیده', 'دو سیخ کوبیده، برنج زعفرانی', '۱۶٫۵۰ €', 'kabab', true], ['قورمه‌سبزی', 'با گوشت گوساله و لوبیا قرمز', '۱۵٫۵۰ €', 'ghormeh'], ['کشک بادمجان', 'با نعناداغ و نان تازه', '۷٫۵۰ €', null]] },
  { who: 'آرایشگاه', kind: 'خدمات با مدت', title: 'خدمات و قیمت‌ها', rows: [['کوتاهی مو، زنانه', '۴۵ دقیقه، با شست‌وشو و سشوار', 'از ۳۵ €', null, true], ['رنگ مو', '۲ ساعت، ریشه یا کامل', 'از ۸۵ €', null], ['بالیاژ', '۳ ساعت', 'از ۱۶۰ €', null], ['اصلاح ابرو با نخ', '۱۵ دقیقه', '۱۲ €', null]] },
  { who: 'مترجم رسمی', kind: 'فهرست قیمت', title: 'خدمات و قیمت‌ها', rows: [['ترجمهٔ رسمی شناسنامه', 'فارسی به آلمانی، تحویل ۳ روزه', 'از ۳۵ €', null, true], ['مدرک تحصیلی و ریزنمرات', 'هر صفحه', 'از ۴۵ €', null], ['گواهینامهٔ رانندگی', 'برای تعویض در Bürgeramt', '۴۵ €', null], ['ترجمهٔ فوری', '۲۴ ساعته', '۵۰٪ بیشتر', null]] },
  { who: 'پزشک', kind: 'خدمات بدون قیمت', title: 'خدمات', chips: ['بیمهٔ دولتی (Kasse)', 'بیمهٔ خصوصی', 'بدون بیمه'], rows: [['معاینهٔ عمومی و چکاپ', 'هر سه سال، با بیمه رایگان', '', null, true], ['واکسن و آزمایش خون', 'با وقت قبلی', '', null], ['مشاوره به فارسی', 'برای تازه‌واردها، بیمه و نامه‌ها', '', null]] },
  { who: 'وکیل', kind: 'خدمات بدون قیمت', title: 'زمینه‌ها و مشاوره', chips: ['اقامت و پناهندگی', 'کار و قرارداد', 'خانواده و طلاق'], rows: [['مشاورهٔ اول', '۳۰ دقیقه، حضوری یا تلفنی', '۹۰ €', null, true], ['پروندهٔ اقامت', 'طبق تعرفهٔ وکلا (RVG)', '', null], ['نامه به اداره', 'Widerspruch و پاسخ به نامه', 'از ۱۵۰ €', null]] },
  { who: 'برگزارکنندهٔ رویداد', none: true },
];
const rowsHtml = (rows) => `<ul class="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white px-3">${rows.map(([n, d, p, k, pop]) => `<li class="flex items-center gap-3 py-3">${k ? `<img src="${img(k)}" alt="" class="size-14 shrink-0 rounded-xl object-cover">` : ''}<div class="min-w-0 flex-1"><p class="flex flex-wrap items-center gap-1.5 text-sm font-bold">${n}${pop ? '<span class="rounded-full bg-saffron-50 px-2 text-xs leading-5 text-saffron-800">پرطرفدار</span>' : ''}</p><p class="text-xs leading-6 text-neutral-600">${d}</p></div>${p ? `<p class="shrink-0 font-extrabold text-brand-800">${p}</p>` : ''}</li>`).join('')}</ul>`;
const card = (t) => `<article class="rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
  <p class="text-xs font-bold text-brand-800">${t.who}${t.kind ? `، نوع فهرست: ${t.kind}` : ''}</p>
  ${t.none ? `<h2 class="mt-2 text-lg font-extrabold">این بخش نیست</h2><p class="mt-1 text-sm leading-7 text-neutral-700">به جای منو، «رویدادهای پیش رو» اول صفحه می‌آید.</p><div class="mt-3 space-y-2">${B.events.map((e) => bpEvent(e)).join('')}</div>`
    : `<div class="mt-2 mb-3 flex items-center justify-between"><h2 class="text-lg font-extrabold">${t.title}</h2><span class="text-sm font-bold text-brand-800">همه</span></div>${t.chips ? `<div class="mb-3 flex flex-wrap gap-1.5">${t.chips.map((c) => `<span class="rounded-full bg-white px-2.5 text-xs leading-7 ring-1 ring-neutral-200">${c}</span>`).join('')}</div>` : ''}${rowsHtml(t.rows)}`}
</article>`;
mount(`${header()}<main class="mx-auto w-full max-w-6xl px-4 pt-5 pb-12 lg:px-6">
  <h1 class="text-2xl font-extrabold">منو و قیمت‌ها برای هر نوع کسب‌وکار</h1>
  <p class="mt-1 max-w-2xl text-sm leading-7 text-neutral-600">همان فهرست است؛ عنوان، ستون‌ها و الگوی آماده با نوع کسب‌وکار عوض می‌شود. قیمت همیشه اختیاری است. اگر فهرست خالی باشد، این بخش در صفحه نشان داده نمی‌شود.</p>
  <div class="mt-5 grid gap-4 lg:grid-cols-3">${TYPES.map(card).join('')}</div></main>${footer()}`);
