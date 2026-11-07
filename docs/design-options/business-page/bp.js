// Business page proposals (Nov 7, 2026): shared sample business, extra icons and parts for the three
// designs a.html, b.html, c.html. Loaded after ../mockups/{icons,common}.js and final/{theme,ui}.js.
// Query: ?dark (dark mode, the approved dark.css), ?state=<name> (an open state of that design).
const Q = new URLSearchParams(location.search);
if (Q.has('dark')) document.documentElement.classList.add('dark');
const STATE = Q.get('state') || '';

Object.assign(window.ICONS, {
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".9" fill="currentColor"/>',
  whatsapp: '<path d="M3.5 20.5 5 16a8.5 8.5 0 1 1 3 3Z"/><path d="M9 8.6c0 3.4 3 6.4 6.4 6.4l1-1.6-2-1-1 .9a5 5 0 0 1-2.6-2.6l.9-1-1-2Z"/>',
  thumbUp: '<path d="M7 10v11"/><path d="M15 5.9 14 10h5.8a2 2 0 0 1 1.9 2.6l-2.3 7A2 2 0 0 1 17.5 21H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3l4-8a3 3 0 0 1 4 3.9Z"/>',
  thumbDown: '<path d="M17 14V3"/><path d="M9 18.1 10 14H4.2a2 2 0 0 1-1.9-2.6l2.3-7A2 2 0 0 1 6.5 3H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-3l-4 8a3 3 0 0 1-4-3.9Z"/>',
  menu: '<path d="M3 2v7a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3Zm0 0v7"/>',
  langs: '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
  reply: '<path d="M15 17l5-5-5-5"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  route: '<path d="M3 11 21 3l-8 18-2-8-8-2Z"/>',
  bag: '<path d="M6 7h12l1 14H5L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z"/><path d="M2 21c0-3 1.9-5.4 5.1-6"/>',
  wheel: '<circle cx="10" cy="4" r="1.5"/><path d="M10 7v6h6l2 5"/><path d="M14 17a5 5 0 1 1-6.5-6.2"/>',
});

const IMGS = { kabab: 'img/kabab.jpg', ghormeh: 'img/ghormeh.jpg', gondi: 'img/gondi.jpg', zereshk: 'img/zereshk.jpg', zereshk2: 'img/zereshk2.jpg', samovar: 'img/samovar.jpg' };
const B = {
  name: 'سفرهٔ نیلوفر',
  initial: 'ن',
  type: 'رستوران ایرانی',
  tagline: 'غذای خانگی ایرانی در شونبرگ: کباب، خورش و کترینگ مهمانی',
  about: 'از ۲۰۱۹ در شونبرگ غذای خانگی ایرانی می‌پزیم: برنج ایرانی، زعفران و نان تازه، هر روز. برای مهمانی، تولد و مراسم کترینگ داریم و غذای گیاهی هم سرو می‌کنیم. پنجشنبه‌ها شب شعر و چای داریم.',
  place: 'شونبرگ، برلین',
  address: 'Musterstraße 12, 10827 Berlin',
  phone: '+49 30 1234 5678',
  site: 'sofreh-niloufar.example',
  insta: 'sofreh.niloufar',
  tg: 'sofreh_niloufar',
  langs: 'فارسی، آلمانی، انگلیسی',
  since: 'عضو از اکتبر ۲۰۲۶',
  followers: '۲۴۸',
  openNow: 'باز است، تا ۲۲:۰۰',
  reply: 'معمولاً در کمتر از یک ساعت جواب می‌دهد',
  replyShort: 'جواب در کمتر از ۱ ساعت',
  recLine: '۲۵ نفر از ۲۶ نفر پیشنهاد می‌کنند',
  recPct: '۹۶٪',
  facts: [['leaf', 'غذای گیاهی'], ['bag', 'بیرون‌بر'], ['truck', 'تحویل در محل'], ['calendar', 'رزرو میز'], ['wheel', 'مناسب ویلچر'], ['card', 'پرداخت با کارت']],
  photos: [
    ['kabab', 'چلوکباب کوبیده و جوجه'], ['ghormeh', 'قورمه‌سبزی'], ['zereshk', 'زرشک‌پلو با مرغ'], ['gondi', 'گوندی و سبزی خوردن'],
    ['samovar', 'سماور یلدا'], ['zereshk2', 'برنج زعفرانی'],
  ],
  photoCount: '۱۲',
  hours: [['دوشنبه', null], ['سه‌شنبه', '۱۲:۰۰–۲۲:۰۰'], ['چهارشنبه', '۱۲:۰۰–۲۲:۰۰'], ['پنجشنبه', '۱۲:۰۰–۲۲:۰۰'], ['جمعه', '۱۲:۰۰–۲۳:۰۰'], ['شنبه', '۱۲:۰۰–۲۲:۰۰', true], ['یکشنبه', '۱۲:۰۰–۲۱:۰۰']],
  menu: [
    { cat: 'کباب', items: [['چلوکباب کوبیده', 'دو سیخ کوبیده، برنج زعفرانی، گوجهٔ کبابی', '۱۶٫۵۰ €', 'kabab', true], ['جوجه‌کباب با زرشک‌پلو', 'سینهٔ مرغ زعفرانی، زرشک‌پلو', '۱۷٫۹۰ €', 'zereshk']] },
    { cat: 'خورش', items: [['قورمه‌سبزی', 'با گوشت گوساله و لوبیا قرمز، با چلو', '۱۵٫۵۰ €', 'ghormeh', true], ['قیمه بادمجان', 'با سیب‌زمینی سرخ‌کرده، با چلو', '۱۵٫۰۰ €', null]] },
    { cat: 'پیش‌غذا', items: [['کشک بادمجان', 'با نعناداغ و نان تازه', '۷٫۵۰ €', null], ['سبزی خوردن و پنیر', 'برای دو نفر', '۵٫۵۰ €', 'gondi']] },
    { cat: 'کترینگ', items: [['کترینگ مهمانی', 'از ۲۰ تا ۸۰ نفر، با ظرف و تحویل در برلین', 'از ۱۸ € هر نفر', 'zereshk2']] },
  ],
  menuCount: '۲۴',
  listings: [
    { title: 'کترینگ مهمانی و تولد، از ۲۰ تا ۸۰ نفر', price: 'از ۱۸ €', unit: 'هر نفر', img: 'zereshk2', photos: '۶', ago: 'دیروز' },
    { title: 'غذای نذری و حلوا برای مراسم، سفارش از ۳ روز قبل', price: 'از ۱۲ €', unit: 'هر نفر', img: 'gondi', photos: '۴', ago: '۳ روز پیش' },
    { title: 'استخدام آشپز ایرانی، تمام‌وقت', price: 'حقوق توافقی', unit: '', img: null, tile: 'استخدام', ago: 'هفتهٔ گذشته' },
    { title: 'سینی ناهار اداری، از ۱۰ پرس', price: 'از ۱۱ €', unit: 'هر پرس', img: 'kabab', photos: '۳', ago: '۲ هفته پیش' },
  ],
  events: [
    { title: 'شب یلدا با موسیقی زنده و سفرهٔ یلدایی', day: '۱۹', month: 'دسامبر', when: 'شنبه ۱۹ دسامبر، ۱۹:۰۰', price: '۴۵ € با شام', img: 'samovar', left: '۱۲ جای خالی' },
    { title: 'شب شعر و چای: حافظ‌خوانی', day: '۲۶', month: 'نوامبر', when: 'پنجشنبه ۲۶ نوامبر، ۱۹:۳۰', price: 'رایگان', img: null, left: '' },
  ],
  recs: [
    { name: 'مریم ک.', when: 'اکتبر ۲۰۲۶', yes: true, tags: ['غذای خوشمزه', 'برخورد خوب'], text: 'برای تولد مادرم کترینگ گرفتیم، ۳۵ نفر. همه چیز سر وقت رسید و قورمه‌سبزی‌اش واقعاً مزهٔ خانه می‌داد.', reply: 'ممنون مریم جان، تولد مادرتان مبارک!' },
    { name: 'آرش ن.', when: 'اکتبر ۲۰۲۶', yes: true, tags: ['قیمت منصفانه'], text: 'کوبیده‌اش بهترین کوبیده‌ای بود که در برلین خوردم. جا کم است، شب‌های آخر هفته رزرو کنید.', reply: '' },
    { name: 'سارا م.', when: 'سپتامبر ۲۰۲۶', yes: false, tags: ['دیر جواب داد'], text: 'غذا خوب بود ولی برای سفارش بیرون‌بر ۴۵ دقیقه منتظر ماندم.', reply: 'حق با شماست، آن شب آشپزخانه شلوغ بود. دفعهٔ بعد مهمان ما باشید.' },
  ],
};

const img = (k) => IMGS[k];
const verifiedMark = (cls = 'size-6') => `<span class="inline-flex text-brand-700" title="${VERIFIED_WHAT}">${I('verified', cls)}</span>`;
const founding = () => `<span class="inline-flex items-center gap-1 rounded-full bg-saffron-50 px-2.5 text-xs font-bold leading-6 text-saffron-800">${I('star', 'size-3.5')}بنیان‌گذار</span>`;
const LOTUS = '<svg viewBox="0 0 64 64" class="size-full" aria-hidden="true"><rect width="64" height="64" fill="#8c2f39"/><g fill="#f0b53f"><path d="M32 13c6.5 8 6.5 19 0 27-6.5-8-6.5-19 0-27Z"/><path d="M31 41c-3-8.5-10.5-13.5-20-13.5 2 9 9.5 14.5 20 13.5Z"/><path d="M33 41c3-8.5 10.5-13.5 20-13.5-2 9-9.5 14.5-20 13.5Z"/><rect x="17" y="45" width="30" height="3.4" rx="1.7"/></g></svg>';
const logoBox = (cls = 'size-20 rounded-2xl') => `<span class="flex ${cls} shrink-0 overflow-hidden ${cls.includes('ring-0') ? '' : 'shadow-md ring-4 ring-white'}">${LOTUS}</span>`;
const VERIFIED_WHAT = 'تأییدشده: مدارک ثبت کسب‌وکار (Gewerbeanmeldung) را پیدو در نوامبر ۲۰۲۶ دیده است';
const proposal = (t = 'پیشنهاد: اگر تأیید شود') => `<span class="rounded-full border border-dashed border-saffron-300 bg-saffron-50 px-2 text-xs font-bold leading-6 text-saffron-800">${t}</span>`;
const openDot = (cls = '') => `<span class="inline-flex items-center gap-1.5 font-bold text-green-800 ${cls}"><i class="size-2 rounded-full bg-green-600"></i>${B.openNow}</span>`;

/** Listing card on a business page: photo or tile, price, title, when */
function bpCard(l, cls = '') {
  return `<a class="relative flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white ${cls}">
    <div class="relative aspect-[4/3] overflow-hidden bg-neutral-100">${l.img ? `<img src="${img(l.img)}" alt="" class="size-full object-cover">` : `<div class="flex size-full flex-col items-center justify-center gap-1 bg-brand-50 text-brand-800">${I(l.tileIcon || 'briefcase', 'size-7')}<span class="text-sm font-bold">${l.tile}</span></div>`}
      ${l.photos ? `<span class="absolute bottom-1.5 start-1.5 flex items-center gap-1 rounded-md bg-black/60 px-1.5 text-xs leading-5 text-white">${I('camera', 'size-3')}${l.photos}</span>` : ''}
      <span class="absolute top-2 end-2 flex size-9 items-center justify-center rounded-full bg-white/95 text-neutral-700 shadow-sm">${I('heart', 'size-[18px]')}</span></div>
    <div class="flex flex-1 flex-col gap-1 p-3">
      <p class="text-[15px] font-extrabold text-brand-800">${l.price}${l.unit ? `<span class="ms-1 text-xs font-medium text-neutral-600">${l.unit}</span>` : ''}</p>
      <p class="line-clamp-2 text-sm font-bold leading-6">${l.title}</p>
      <p class="mt-auto pt-1 text-xs text-neutral-600">${l.ago}</p></div></a>`;
}

/** Event row: date block (or poster), title, when, price */
function bpEvent(e, { poster = true } = {}) {
  return `<a class="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-2.5">
    ${poster && e.img ? `<div class="relative aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-xl"><img src="${img(e.img)}" class="size-full object-cover" alt=""><span class="absolute inset-x-1 bottom-1 rounded-md bg-white/95 text-center text-xs font-black leading-5 text-brand-800">${e.day} ${e.month}</span></div>`
      : `<div class="flex w-20 shrink-0 flex-col items-center justify-center self-stretch rounded-xl bg-saffron-50 text-saffron-800"><span class="text-2xl font-black leading-none">${e.day}</span><span class="mt-1 text-xs font-bold">${e.month}</span></div>`}
    <div class="min-w-0 flex-1"><p class="line-clamp-2 text-[15px] font-bold leading-6">${e.title}</p><p class="mt-1 flex items-center gap-1 text-xs text-neutral-600">${I('calendar', 'size-3.5')}${e.when}</p>
      <p class="mt-1 text-sm font-extrabold text-brand-800">${e.price}${e.left ? `<span class="ms-2 text-xs font-bold text-saffron-700">${e.left}</span>` : ''}</p></div></a>`;
}

/** Hours table, today's row marked */
function hoursTable() {
  return `<dl class="divide-y divide-neutral-100 text-sm">${B.hours.map(([d, h, today]) => `<div class="flex justify-between py-2 ${today ? 'font-extrabold' : ''}"><dt>${d}${today ? '<span class="ms-1.5 rounded-full bg-green-50 px-2 text-xs leading-5 text-green-800">امروز</span>' : ''}</dt><dd class="${h ? '' : 'text-neutral-500'}">${h || 'بسته'}</dd></div>`).join('')}</dl>`;
}

/** A drawn street map (no tiles in mockups) with the shop's pin */
function miniMap(cls = 'aspect-[16/9]') {
  return `<div class="relative ${cls} overflow-hidden rounded-xl bg-[#e9efe9] dark-map">
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" class="absolute inset-0 size-full"><g stroke="#fff" stroke-linecap="round"><path d="M-10 60 330 40" stroke-width="10"/><path d="M-10 140 330 120" stroke-width="7"/><path d="M90 -10 120 200" stroke-width="8"/><path d="M230 -10 210 200" stroke-width="6"/><path d="M-10 100 330 95" stroke-width="4"/><path d="M160 -10 170 200" stroke-width="4"/></g><path d="M250 130h60v40h-60z" fill="#cfe5cf"/><path d="M10 0h60v30H10z" fill="#cfe5cf"/></svg>
    <span class="absolute start-1/2 top-1/2 -translate-y-full translate-x-1/2 text-brand-700">${I('pin', 'size-9 fill-white', 2.2)}</span>
    <span class="absolute bottom-2 end-2 flex h-8 items-center gap-1 rounded-lg bg-white px-2.5 text-xs font-bold text-neutral-800 shadow">${I('expand', 'size-3.5')}نقشهٔ بزرگ</span></div>`;
}

/** Contact links: Instagram, Telegram, WhatsApp, website */
const LINKS = [['instagram', 'اینستاگرام', '@' + B.insta], ['send', 'تلگرام', '@' + B.tg], ['whatsapp', 'واتس‌اپ', B.phone], ['globe', 'وب‌سایت', B.site]];
const linkPills = () => `<div class="flex flex-wrap gap-2">${LINKS.map(([ic, l]) => `<a class="flex h-10 items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3.5 text-sm font-medium">${I(ic, 'size-4 text-brand-700')}${l}</a>`).join('')}</div>`;

/** One recommendation card */
function recCard(r) {
  return `<article class="rounded-2xl border border-neutral-200 bg-white p-4">
    <div class="flex items-center gap-2.5"><span class="flex size-9 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-800">${r.name[0]}</span>
      <div class="min-w-0 flex-1"><p class="text-sm font-bold">${r.name}</p><p class="text-xs text-neutral-600">${r.when}، بعد از گفتگو در پیدو</p></div>
      <span class="flex items-center gap-1 rounded-full px-2.5 text-xs font-bold leading-7 ${r.yes ? 'bg-green-50 text-green-800' : 'bg-neutral-100 text-neutral-700'}">${I(r.yes ? 'thumbUp' : 'thumbDown', 'size-3.5')}${r.yes ? 'پیشنهاد می‌کند' : 'پیشنهاد نمی‌کند'}</span></div>
    <p class="mt-3 text-sm leading-7 text-neutral-800">${r.text}</p>
    <div class="mt-2 flex flex-wrap gap-1.5">${r.tags.map((t) => `<span class="rounded-full bg-neutral-100 px-2.5 text-xs leading-6 text-neutral-700">${t}</span>`).join('')}</div>
    ${r.reply ? `<div class="mt-3 rounded-xl bg-neutral-50 p-3 text-sm leading-7"><p class="flex items-center gap-1 text-xs font-bold text-brand-800">${I('reply', 'size-3.5')}پاسخ ${B.name}</p><p class="text-neutral-800">${r.reply}</p></div>` : ''}
  </article>`;
}

/** Recommendations block: summary, the honesty note the law asks for (UWG §5b(3)), cards */
function recsBlock({ cards = 2, title = true } = {}) {
  return `<section id="recs">
    ${title ? `<div class="mb-3 flex flex-wrap items-center gap-2"><h2 class="text-lg font-extrabold">نظر مشتری‌ها</h2>${proposal()}</div>` : ''}
    <div class="flex items-center gap-4 rounded-2xl bg-green-50 p-4">
      <span class="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white text-green-800 shadow-sm">${I('thumbUp', 'size-7')}</span>
      <div class="min-w-0 flex-1"><p class="text-xl font-black text-green-800">${B.recPct} پیشنهاد می‌کنند</p><p class="text-sm text-neutral-700">${B.recLine}</p></div>
      <a class="hidden h-10 items-center rounded-xl border border-neutral-300 bg-white px-3 text-sm font-bold sm:flex">نظر بدهید</a></div>
    <div class="mt-3 flex flex-wrap gap-1.5">${[['غذای خوشمزه', '۱۹'], ['برخورد خوب', '۱۴'], ['قیمت منصفانه', '۹'], ['سر وقت', '۷']].map(([t, n]) => `<span class="rounded-full border border-neutral-200 bg-white px-3 text-xs leading-7">${t} <b class="text-brand-800">${n}</b></span>`).join('')}</div>
    <div class="mt-3 grid gap-3 lg:grid-cols-2">${B.recs.slice(0, cards).map(recCard).join('')}</div>
    <p class="mt-3 flex items-start gap-1.5 text-xs leading-6 text-neutral-600">${I('info', 'size-4 mt-1')}<span>فقط کسانی که در پیدو با این کسب‌وکار گفتگو کرده‌اند می‌توانند نظر بدهند. نظرهای مثبت و منفی هر دو منتشر می‌شوند و کسب‌وکار نمی‌تواند برای حذف آن‌ها پول بدهد. <a class="font-bold text-brand-800 underline">بیشتر بدانید</a></span></p>
  </section>`;
}

/** Folded Impressum (German, as today) and the report link */
const legalFold = () => `<details class="rounded-2xl border border-neutral-200 bg-white p-4"><summary class="cursor-pointer text-sm font-bold">اطلاعات حقوقی (<bdi>Impressum</bdi>)</summary></details>
  <a class="mt-3 flex min-h-11 items-center gap-1.5 text-sm text-neutral-600">${I('flag', 'size-4')}گزارش این کسب‌وکار</a>`;

/** Contact sheet: Peydoo chat first (number stays private), then the business's own channels */
function contactSheet() {
  const rows = [
    ['phone', 'تماس تلفنی', B.phone, true], ['whatsapp', 'واتس‌اپ', B.phone, true], ['send', 'تلگرام', '@' + B.tg, true], ['instagram', 'اینستاگرام', '@' + B.insta, true], ['globe', 'وب‌سایت', B.site, true], ['mail', 'ایمیل', 'hallo@' + B.site, true],
  ];
  return sheet(`تماس با ${B.name}`, `
    <a class="flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-3">
      <span class="flex size-11 items-center justify-center rounded-full bg-brand-700 text-white">${I('chat', 'size-5')}</span>
      <span class="min-w-0 flex-1"><b class="block">پیام در پیدو</b><span class="text-xs text-neutral-700">${B.reply}. شمارهٔ شما دیده نمی‌شود.</span></span>${I('chevronEnd', 'size-5 text-neutral-500')}</a>
    <ul class="mt-2 divide-y divide-neutral-200">${rows.map(([ic, l, v]) => `<li><a class="flex min-h-14 items-center gap-3"><span class="flex size-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-800">${I(ic, 'size-5')}</span><span class="flex-1 text-sm font-bold">${l}</span><bdi dir="ltr" class="text-sm text-neutral-600">${v}</bdi></a></li>`).join('')}</ul>
    <p class="mt-2 text-xs leading-6 text-neutral-600">تماس، واتس‌اپ و تلگرام بیرون از پیدو انجام می‌شوند؛ پیدو آن‌ها را نمی‌بیند.</p>`);
}

/** Write a recommendation: yes / no, tags, a few words; the label the law allows us to show */
function recSheet() {
  return sheet(`${B.name} را پیشنهاد می‌کنید؟`, `
    <div class="grid grid-cols-2 gap-2"><a class="flex h-14 items-center justify-center gap-2 rounded-xl border-2 border-brand-600 bg-brand-50 font-bold text-brand-800">${I('thumbUp', 'size-5')}بله</a><a class="flex h-14 items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white font-bold">${I('thumbDown', 'size-5')}نه</a></div>
    <p class="mt-4 text-sm font-bold">چه چیزی خوب بود؟ <span class="font-normal text-neutral-600">(اختیاری)</span></p>
    <div class="mt-2 flex flex-wrap gap-2">${['غذای خوشمزه', 'برخورد خوب', 'قیمت منصفانه', 'سر وقت', 'تمیز', 'جواب سریع'].map((t, i) => chip(t, { on: i < 2 })).join('')}</div>
    <p class="mt-4 text-sm font-bold">چند کلمه برای دیگران <span class="font-normal text-neutral-600">(اختیاری)</span></p>
    <div class="mt-2 h-28 rounded-xl border border-neutral-300 bg-white p-3 text-sm leading-7 text-neutral-500">از تجربهٔ خودتان بنویسید: چه سفارش دادید و چطور بود.</div>
    <p class="mt-3 text-xs leading-6 text-neutral-600">با نام «مریم ک.» منتشر می‌شود، با برچسب «بعد از گفتگو در پیدو». کسب‌وکار می‌تواند یک بار جواب بدهد. توهین و اطلاعات شخصی منتشر نمی‌شود.</p>`,
    `<a class="flex h-12 items-center justify-center rounded-xl bg-brand-700 font-bold text-white">انتشار نظر</a>`);
}

/** Full-screen photo viewer (always dark): counter, caption, thumbnails; arrows on computers */
function viewer(at = 1) {
  const [k, cap] = B.photos[at];
  return `<div class="fixed inset-0 z-50 flex flex-col bg-black text-white">
    <div class="flex items-center gap-2 px-2 py-2"><span class="flex size-11 items-center justify-center rounded-full">${I('close', 'size-6')}</span><span class="flex-1 text-center text-sm">${fa(at + 1)} از ${B.photoCount}</span><span class="flex size-11 items-center justify-center rounded-full">${I('share', 'size-5')}</span></div>
    <div class="relative flex min-h-0 flex-1 items-center justify-center px-0 lg:px-20"><img src="${img(k)}" alt="" class="max-h-full w-full object-contain lg:w-auto">
      <span class="absolute start-4 top-1/2 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 lg:flex">${I('chevronStart', 'size-6')}</span><span class="absolute end-4 top-1/2 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 lg:flex">${I('chevronEnd', 'size-6')}</span></div>
    <p class="px-4 pt-3 text-center text-sm">${cap}</p>
    <div class="no-scrollbar flex justify-start gap-2 overflow-x-auto px-4 pt-3 pb-6 lg:justify-center">${B.photos.map(([p], i) => `<img src="${img(p)}" alt="" class="size-14 shrink-0 rounded-lg object-cover ${i === at ? 'ring-2 ring-white' : 'opacity-50'}">`).join('')}</div></div>`;
}

const section = (id, title, body, more = '') => `<section id="${id}" class="scroll-mt-32"><div class="mb-3 flex items-center justify-between gap-2"><h2 class="text-lg font-extrabold">${title}</h2>${more ? `<a class="flex min-h-11 items-center gap-0.5 text-sm font-bold text-brand-800">${more}${I('chevronEnd', 'size-4')}</a>` : ''}</div>${body}</section>`;
