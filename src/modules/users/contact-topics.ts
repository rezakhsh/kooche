// The contact form's topics (src/modules/users/contact.ts), on their own so the form in the
// browser doesn't pull in the mailer
export const CONTACT_TOPICS = ['support', 'illegal', 'appeal', 'authority', 'other'] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];
