// Admin: system status as traffic lights. Problems first and in colour, with what to do; every
// queue column visible (failed in red); healthy parts quiet.
const ok = [['PostgreSQL', '۲ ms'], ['Valkey', '۲ ms'], ['Meilisearch', '۴ ms، ۴ سند برای ۴ آگهی'], ['Worker', '۱ دقیقه پیش'], ['پشتیبان‌گیری', '۱۹ ساعت پیش'], ['نقشهٔ سایت', '۲۲ دقیقه پیش']];
const queues = [['listing-checks', 0, 0, 0], ['media', 0, 0, 0], ['search-sync', 0, 0, 0], ['payments', 0, 0, 2], ['moderation', 0, 1, 0], ['email-send', 0, 0, 0], ['telegram-send', 0, 0, 0], ['seo', 0, 0, 0]];
const body = `
  <h1 class="text-2xl font-extrabold">وضعیت سیستم</h1><p class="text-sm text-neutral-600">هر دقیقه به‌روز می‌شود. آخرین بار: ۱ دقیقه پیش</p>
  <section class="mt-4 rounded-2xl border-2 border-red-300 bg-red-50 p-4">
    <p class="flex items-center gap-2 font-extrabold text-red-800">${I('alert', 'size-5')}۱ مشکل نیاز به رسیدگی دارد</p>
    <div class="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-white p-3"><div class="min-w-0 flex-1"><b class="block">۴ وب‌هوک پرداخت اعمال نشده</b><span class="text-sm text-neutral-700">قدیمی‌ترین: ۲ روز پیش. ممکن است خرید کسی ثبت نشده باشد. صف payments هم ۲ کار ناموفق دارد.</span></div><a class="flex h-10 items-center rounded-lg bg-red-700 px-3 text-sm font-bold text-white">دیدن پرداخت‌ها</a></div>
  </section>
  <section class="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-3">${ok.map(([k, v]) => `<div class="flex items-center gap-2.5 rounded-xl border border-neutral-200 bg-white p-3"><span class="size-2.5 rounded-full bg-green-600"></span><div class="min-w-0"><b class="block text-sm">${k}</b><span class="text-xs text-neutral-600">${v}</span></div></div>`).join('')}</section>
  <section class="mt-4 rounded-2xl border border-neutral-200 bg-white p-4"><h2 class="font-extrabold">صف‌ها</h2>
    <div class="mt-2 overflow-x-auto"><table class="w-full min-w-[28rem] text-sm"><thead><tr class="text-xs text-neutral-600"><th class="py-2 text-start font-bold">صف</th><th class="text-start font-bold">ناموفق</th><th class="text-start font-bold">در حال اجرا</th><th class="text-start font-bold">منتظر</th></tr></thead><tbody class="divide-y divide-neutral-100">${queues.map(([q, w, a, f]) => `<tr><td class="py-2"><bdi dir="ltr" class="font-mono text-[13px]">${q}</bdi></td><td class="${f ? 'font-bold text-red-700' : 'text-neutral-500'}">${fa(f)}</td><td>${fa(a)}</td><td>${fa(w)}</td></tr>`).join('')}</tbody></table></div></section>`;
mount(adminShell('system', body, { counts: { queue: '۳', system: '۱' } }));
