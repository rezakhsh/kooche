// Legal pieces (Nov 6, 2026), item 4: the order confirmation on a durable medium (§ 312f (2) BGB).
// Kleinanzeigen level: the existing «پرداخت انجام شد» email gets the order line, the last day to
// withdraw, and in German the confirmation, the withdrawal notice and the model form; the terms
// by link, no attachments. Drawn as the mail program shows it (the email frame of mailer.ts).
const p = (t, cls = '') => `<p class="${cls}" style="margin:0 0 12px">${t}</p>`;
mount(`<div class="min-h-screen bg-neutral-100 p-3 lg:p-8">
<div class="mx-auto max-w-[560px]">
  <div class="mb-3 rounded-xl bg-white p-3 text-xs text-neutral-600" dir="ltr" style="text-align:left">
    <b class="text-neutral-900">Peydoo</b> &lt;noreply@peydoo.com&gt;<br>
    <b class="text-neutral-900" dir="rtl">پرداخت انجام شد: نردبان یک‌باره</b>

  </div>
  <div class="rounded-xl bg-white p-6 text-sm leading-7 text-neutral-900">
    ${p('پرداخت «نردبان یک‌باره» برای آگهی «مبل سه‌نفرهٔ طوسی، تمیز» انجام شد (۱٫۹۹ €).')}
    <div class="mb-3 rounded-lg bg-neutral-50 p-3 text-[13px]">
      <b>سفارش شما</b><br>نردبان یک‌باره، یک بار، ۱٫۹۹ € · ۶ نوامبر ۲۰۲۶، ۱۴:۳۲ (به وقت برلین)<br>
      پیش از پرداخت خواستید خدمت همین حالا شروع شود و تأیید کردید که می‌دانید حق انصراف‌تان با انجام کامل آن از بین می‌رود.</div>
    ${p('حق انصراف: تا ۲۰ نوامبر ۲۰۲۶ از «خریدهای من» با دکمهٔ «انصراف از قرارداد». متن رسمی انصراف و فرم نمونه پایین همین ایمیل است.')}
    <p style="margin:0 0 16px"><a class="inline-block rounded-lg bg-brand-700 px-4 py-2 font-bold text-white">دیدن آگهی</a> <a class="ms-3 font-bold text-brand-700">دیدن فاکتور</a></p>
    <div dir="ltr" lang="de" class="border-t border-neutral-200 pt-4 text-[12.5px] leading-6 text-neutral-700" style="text-align:left">
      <b class="text-neutral-900">Bestellbestätigung</b><br>
      Leistung: Hochschieben (einmalig) für die Anzeige „…“, Preis 1,99 € (kein Ausweis der USt. gemäß § 19 UStG), bestellt am 06.11.2026 um 14:32 Uhr.<br>
      Sie haben vor der Zahlung ausdrücklich verlangt, dass wir mit der Leistung vor Ablauf der Widerrufsfrist beginnen, und bestätigt, dass Sie Ihr Widerrufsrecht bei vollständiger Vertragserfüllung verlieren.<br><br>
      <b class="text-neutral-900">Widerrufsbelehrung</b><br>Widerrufsrecht. Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. … <i>(full statutory text)</i><br><br>
      <b class="text-neutral-900">Muster-Widerrufsformular</b><br>An Reza Khodamehri Sheijani, …, E-Mail: support@peydoo.com: Hiermit widerrufe(n) ich/wir (*) … <i>(full form)</i><br><br>
      Nutzungsbedingungen: peydoo.com/terms/de (Fassung vom 3. November 2026).
    </div>
  </div>
</div></div>`);
