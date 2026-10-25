// Settings › Appearance: "automatic" (follow the phone or computer) is the default and selected;
// light and dark are there for people who want one always. Each option shows a small preview of a
// listing card in that look. Signed out, the same choice sits in the footer (a cookie, one year).
const mini = (dark) => `<span class="block overflow-hidden rounded-xl border ${dark ? 'border-[#2c3836] bg-[#16211f]' : 'border-neutral-200 bg-white'}">
  <img src="../img/room1.webp" class="aspect-[4/3] w-full object-cover" alt="">
  <span class="block p-2"><b class="block text-xs ${dark ? 'text-[#5cc0c7]' : 'text-brand-800'}">۸۷۰ €</b><span class="mt-1 block h-1.5 w-4/5 rounded-full ${dark ? 'bg-[#3a4946]' : 'bg-neutral-200'}"></span><span class="mt-1 block h-1.5 w-1/2 rounded-full ${dark ? 'bg-[#2c3836]' : 'bg-neutral-100'}"></span></span></span>`;
const auto = `<span class="relative block">${mini(false)}<span class="absolute inset-0" style="clip-path: inset(0 50% 0 0)">${mini(true)}</span></span>`;
const options = [
  ['devices', 'خودکار', 'مثل گوشی یا کامپیوتر شما', auto, true],
  ['sun', 'روشن', 'همیشه روشن', mini(false)],
  ['moon', 'تیره', 'همیشه تیره، برای شب و نور کم', mini(true)],
];
mount(`${appBar('ظاهر')}
<main class="mx-auto w-full max-w-2xl px-4 pt-5 pb-10">
  <p class="text-[15px] leading-8 text-neutral-700">پیدو را روشن ببینید یا تیره. اگر مطمئن نیستید، «خودکار» را نگه دارید.</p>
  <div class="mt-4 grid grid-cols-3 gap-2.5">${options.map(([ic, t, s, prev, on]) => `<a class="flex flex-col gap-2 rounded-2xl border-2 p-2.5 ${on ? 'border-brand-600 bg-brand-50' : 'border-neutral-200'}">
    ${prev}<span class="flex items-center gap-1.5 text-sm font-extrabold">${I(ic, 'size-4 text-brand-700')}${t}${on ? `<span class="ms-auto flex size-5 items-center justify-center rounded-full bg-brand-700 text-white">${I('check', 'size-3.5', 3)}</span>` : ''}</span>
    <span class="text-xs leading-5 text-neutral-600">${s}</span></a>`).join('')}</div>
  <ul class="mt-6 space-y-2 text-sm leading-7 text-neutral-700">
    <li class="flex gap-2">${I('check', 'size-4 mt-1.5 text-brand-700')}رنگ‌ها و عکس‌ها در هر دو حالت همان‌اند؛ فقط زمینه عوض می‌شود.</li>
    <li class="flex gap-2">${I('check', 'size-4 mt-1.5 text-brand-700')}انتخاب شما روی همین دستگاه می‌ماند.</li>
  </ul>
</main>`);
