// Legal forms the business form suggests (free text is allowed too): Germany, then Austria's own.
// A separate file so the client form doesn't pull in server code.
export const LEGAL_FORMS = ['Einzelunternehmen', 'Freiberufler', 'GbR', 'e.K.', 'OHG', 'KG', 'GmbH', 'UG (haftungsbeschränkt)', 'GmbH & Co. KG', 'AG', 'e.V.', 'e.U.', 'OG'] as const;
