import { describe, expect, it } from 'vitest';
import { detectRisks, isValidIban } from './risk';

describe('detectRisks', () => {
  const cases: Array<[string, string[]]> = [
    // Nothing to flag: prices, postal codes, years, sizes, times
    ['سلام، هنوز موجوده؟', []],
    ['قیمت آخر ۲۵۰ یورو، تحویل در 12045 برلین', []],
    ['مدل ۲۰۲۲ است، ۱٫۵ لیتر، ساعت ۱۸:۳۰ می‌آیم', []],
    ['Preis 1.200,50 € VB', []],
    ['سایز 42 و 43 دارم', []],
    // Links
    ['اینجا ببینید https://example.com/x', ['link']],
    ['www.kleinanzeigen.de را ببین', ['link']],
    ['عکس‌ها در bit.ly/3abc', ['link']],
    ['بیا t.me/someone', ['link', 'off_platform_contact']],
    // IBAN, with and without spaces, Persian digits too
    ['به این حساب بزن DE89 3704 0044 0532 0130 00', ['iban']],
    ['AT611904300234573201', ['iban']],
    ['DE۸۹۳۷۰۴۰۰۴۴۰۵۳۲۰۱۳۰۰۰', ['iban']],
    // Payment requests
    ['لطفاً اول بیعانه بفرستید', ['payment_request']],
    ['پیش‌پرداخت با PayPal friends and family', ['payment_request']],
    ['کارت به کارت کنید', ['payment_request']],
    ['6037 9918 9999 9993', ['payment_request']],
    // Off-platform contact
    ['در واتس‌اپ پیام بدهید', ['off_platform_contact']],
    ['Schreib mir auf WhatsApp', ['off_platform_contact']],
    ['ایمیلم ali.r@example.org', ['off_platform_contact']],
    ['آیدی تلگرامم @ali_seller', ['off_platform_contact']],
    // Phone numbers in DE, AT, IR and international form
    ['شماره‌ام ۰۱۷۶ ۱۲۳۴۵۶۷۸', ['phone_number']],
    ['+43 664 1234567 زنگ بزن', ['phone_number']],
    ['0049 176 12345678', ['phone_number']],
    ['۰۹۱۲۳۴۵۶۷۸۹', ['phone_number']],
  ];
  it.each(cases)('%s', (body, flags) => {
    expect(detectRisks(body)).toEqual(flags);
  });

  it('does not take an IBAN that fails the check for one', () => {
    expect(detectRisks('DE89 3704 0044 0532 0130 01')).not.toContain('iban');
  });

  it('does not flag a 16-digit number that fails Luhn as a card', () => {
    expect(detectRisks('1234 5678 9012 3456')).not.toContain('payment_request');
  });
});

describe('isValidIban', () => {
  it('accepts valid German and Austrian IBANs and refuses a changed digit', () => {
    expect(isValidIban('DE89370400440532013000')).toBe(true);
    expect(isValidIban('AT611904300234573201')).toBe(true);
    expect(isValidIban('AT611904300234573202')).toBe(false);
  });
});
