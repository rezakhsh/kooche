// C: city hub: a tiled band with the search pill, six intents from the launch strategy, then
// rooms with Anmeldung, this week's events and the newest listings
const intents = [['building', 'اتاق و خانه', 142], ['briefcase', 'کار', 27], ['wrench', 'خدمات فارسی‌زبان', 64], ['sofa', 'خرید و فروش', 302], ['book', 'آموزش و کلاس', 31], ['calendar', 'رویدادها', 9]];
const rooms = [L.wg, { ...L.wg, title: 'اتاق ۱۸ متری در WG سه‌نفره', price: 640, place: 'فریدریش‌هاین', ago: 'دیروز', img: '../img/room4.webp' }, { ...L.room, price: 870 }];
mount(`${deskHeader()}
<div class="min-h-screen bg-page pb-28">
<div class="girih rounded-b-[28px] px-4 pt-3 pb-16 text-white lg:rounded-none lg:pb-20 lg:pt-10">
  <div class="mx-auto max-w-6xl lg:px-6">
    <div class="flex items-center gap-2 lg:hidden">${LOGO('size-9', true)}<span class="text-xl font-black">پیدو</span>
      <a class="ms-auto flex h-10 items-center gap-1 rounded-full bg-white/15 px-3 text-sm font-semibold">${I('pin', 'size-4')}برلین${I('chevronDown', 'size-3.5')}</a>
      <a class="flex size-10 items-center justify-center rounded-full bg-white/15">${I('bell', 'size-5')}</a></div>
    <h1 class="mt-6 text-[26px] font-black leading-[1.4] lg:mt-0 lg:text-4xl">ایرانی‌های برلین اینجا<br class="lg:hidden"> خانه، کار و خدمات پیدا می‌کنند</h1>
    <p class="mt-2 text-sm text-brand-100 lg:text-base">${fa(648)} آگهی فعال، همه با شماره تأیید شده</p>
    <div class="mt-5 flex h-14 items-center gap-3 rounded-full bg-white px-5 text-[15px] text-neutral-500 shadow-lg lg:hidden">${I('search', 'size-5 text-brand-700')}دنبال چی می‌گردی؟</div>
  </div>
</div>
<main class="mx-auto max-w-6xl lg:px-6">
  <div class="-mt-10 grid grid-cols-3 gap-2.5 px-4 lg:grid-cols-6 lg:px-0">${intents.map(([ic, t, n]) => `<a class="flex flex-col items-start gap-2 rounded-[20px] bg-white p-3 shadow-sm ring-1 ring-neutral-200/70"><span class="flex size-10 items-center justify-center rounded-xl ${ic === 'calendar' ? 'bg-saffron-100 text-saffron-800' : 'bg-brand-50 text-brand-700'}">${I(ic, 'size-6', 1.75)}</span><span class="text-sm font-extrabold leading-5">${t}</span><span class="text-xs text-neutral-500">${fa(n)} آگهی</span></a>`).join('')}</div>
  ${section('اتاق‌های تازه با Anmeldung', 'همه', `<div class="no-scrollbar flex gap-3 overflow-x-auto px-4 lg:grid lg:grid-cols-4 lg:px-0">${rooms.map((l) => card(l, 'w-[62%] shrink-0 lg:w-auto')).join('')}${card({ ...L.wg, title: 'اتاق موقت ۳ ماهه، مبله', price: 520, place: 'پانکوف', ago: '۳ روز پیش', img: '../img/room7.webp', anmeldung: false }, 'hidden lg:block')}</div>`)}
  ${section('این هفته در برلین', 'همه رویدادها', `<a class="mx-4 flex gap-3 rounded-[20px] bg-white p-3 ring-1 ring-neutral-200/70 lg:mx-0 lg:w-1/2"><img src="${EVENT.img}" class="size-24 rounded-2xl object-cover" alt=""><span class="flex flex-col"><span class="text-xs font-bold text-saffron-700">${EVENT.date}، ${EVENT.time}</span><b class="mt-1 text-[15px] leading-6">${EVENT.title}</b><span class="mt-auto text-xs text-neutral-600">${EVENT.place}، ${EVENT.price}</span></span></a>`)}
  ${section('تازه‌ترین‌ها در برلین', 'همه', `<div class="grid grid-cols-2 gap-x-3 gap-y-5 px-4 lg:grid-cols-4 lg:px-0">${['car', 'translate', 'phone', 'setar'].map((k) => card(L[k])).join('')}</div>`)}
</main></div>${bottomNav(0)}`);
