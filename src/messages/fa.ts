// Every piece of interface text lives here (CLAUDE.md). Keys are grouped by page or component.
// A second language later is a second file with the same shape.

export const messages = {
  site: {
    name: 'نیازمندی‌های ایرانیان اروپا',
    description: 'خرید و فروش، خانه، کار و خدمات برای ایرانیان در اروپا',
  },
  home: {
    badge: 'به‌زودی',
    title: 'نیازمندی‌های ایرانیان اروپا',
    intro:
      'این‌جا به‌زودی جایی است برای خرید و فروش، پیدا کردن خانه و کار، و خدماتی که هم‌زبان‌هایتان در شهر شما ارائه می‌دهند.',
    today: (date: string) => `امروز: ${date}`,
  },
  notFound: {
    title: 'صفحه پیدا نشد',
    body: 'صفحه‌ای که دنبالش هستید وجود ندارد یا جابه‌جا شده است.',
    home: 'بازگشت به صفحه اصلی',
  },
} as const;

export type Messages = typeof messages;
