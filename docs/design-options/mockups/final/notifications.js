// Round 12: notification settings. Telegram and email only: WhatsApp messages we start cost money,
// so Peydoo never sends WhatsApp notifications (owner's decision). City openings are announced by
// the owner to everyone by email, not through these settings. Behind it: one queue that respects
// each channel's limits, quiet hours and bundling.
const rows = [['پیام تازه در گفت‌وگو', true, true], ['جواب به آگهی شما', true, true], ['آگهی تازه در جستجوی ذخیره‌شده', true, false], ['رویدادهای این هفته در شهر', false, true]];
const sw = (on) => `<span class="inline-flex h-6 w-10 items-center rounded-full ${on ? 'bg-brand-700 justify-end' : 'bg-neutral-300 justify-start'} px-0.5"><i class="block size-5 rounded-full bg-white shadow"></i></span>`;
mount(`${appBar('اعلان‌ها')}
<main class="mx-auto w-full max-w-xl px-4 pt-5 pb-10">
  <div class="overflow-hidden rounded-2xl border border-neutral-200"><table class="w-full text-sm"><thead class="bg-neutral-50 text-xs text-neutral-600"><tr><th class="p-3 text-start"></th><th class="p-2">تلگرام</th><th class="p-2">ایمیل</th></tr></thead>
  <tbody class="divide-y divide-neutral-200">${rows.map(([t, a, b]) => `<tr><td class="p-3 text-[13px] leading-6">${t}</td><td class="p-2 text-center">${sw(a)}</td><td class="p-2 text-center">${sw(b)}</td></tr>`).join('')}</tbody></table></div>
  <div class="mt-4 rounded-2xl border border-neutral-200 p-4"><p class="flex items-center justify-between text-sm"><b>ساعت آرام</b><span>${sw(true)}</span></p><p class="mt-1 text-xs leading-6 text-neutral-600">از ۲۲ تا ۸ به وقت تورنتو چیزی نمی‌فرستیم؛ صبح یک‌جا می‌رسد.</p></div>
  <div class="mt-4 rounded-2xl border border-neutral-200 p-4"><p class="flex items-center justify-between text-sm"><b>یک‌جا بفرست</b><span>${sw(true)}</span></p><p class="mt-1 text-xs leading-6 text-neutral-600">آگهی‌های تازهٔ جستجوهای شما، روزی یک بار در یک پیام.</p></div>
  <p class="mt-4 text-xs leading-6 text-neutral-600">ربات تلگرام پیدو: متصل.</p>
</main>`);
