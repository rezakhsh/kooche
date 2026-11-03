// The contact page's topics (src/modules/users/contact.ts; docs/kleinanzeigen-study.md, 1.5). On
// their own so the page's form in the browser doesn't pull in the mailer. Help first: each topic
// shows matching answers from the help page before the form opens.

export const CONTACT_TOPICS = ['login', 'listing', 'payment', 'appeal', 'illegal', 'authority', 'privacy', 'other'] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export type TopicRule = {
  /** Open to visitors without an account; the others need a sign-in (the account is attached) */
  guests: boolean;
  /** Guests' messages wait for a click on an emailed link before they reach us */
  confirmGuests: boolean;
  /** A receipt to the sender: DSA notices always (Art. 16 (4)), else only to a signed-in account's own address */
  receipt: 'always' | 'signedIn' | 'never';
  /** In the support mail's subject, for the mailbox's filters */
  tag: string;
  /** Questions from `pages.help` shown before the form (exact texts; a test checks they exist) */
  help: readonly string[];
};

export const TOPIC_RULES: Record<ContactTopic, TopicRule> = {
  login: { guests: true, confirmGuests: false, receipt: 'never', tag: 'Login', help: ['کد ورود نرسید.', 'چطور حساب بسازم؟'] },
  listing: {
    guests: false,
    confirmGuests: false,
    receipt: 'signedIn',
    tag: 'Anzeige',
    help: ['آگهی‌ام برداشته شد. چرا؟', 'چطور آگهی را ویرایش، متوقف یا حذف کنم؟', 'چرا نمی‌توانم لینک بفرستم؟', 'کسی مزاحمم می‌شود.'],
  },
  payment: { guests: false, confirmGuests: false, receipt: 'signedIn', tag: 'Zahlung', help: ['ثبت آگهی هزینه دارد؟', 'چرا از ایران نمی‌توانم پرداخت کنم؟'] },
  appeal: { guests: false, confirmGuests: false, receipt: 'signedIn', tag: 'Widerspruch', help: ['آگهی‌ام برداشته شد. چرا؟'] },
  illegal: { guests: true, confirmGuests: false, receipt: 'always', tag: 'Meldung', help: ['چطور آگهی را گزارش کنم؟', 'پیامی را چطور گزارش کنم؟'] },
  authority: { guests: true, confirmGuests: false, receipt: 'never', tag: 'Behörde', help: [] },
  privacy: { guests: true, confirmGuests: true, receipt: 'never', tag: 'Datenschutz', help: ['چطور داده‌هایم را بگیرم؟', 'چطور حسابم را حذف کنم؟'] },
  other: { guests: true, confirmGuests: true, receipt: 'never', tag: 'Sonstiges', help: ['پیدو چیست؟', 'پیدو طرف معامله است؟'] },
};

export const isContactTopic = (v: unknown): v is ContactTopic => typeof v === 'string' && (CONTACT_TOPICS as readonly string[]).includes(v);

/** The form's hidden trap field: people never see or fill it */
export const HONEYPOT_FIELD = 'website';
/** The signed time the form was drawn */
export const FORM_TIME_FIELD = 'ft';
