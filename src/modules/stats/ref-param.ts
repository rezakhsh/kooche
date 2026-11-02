// The owner's links (`?ref=<code>`, admin › «آمار بازدید») are read by the visit beacon on the
// tab's first page (src/components/visit-beacon.tsx). A redirect on the way there (a returning
// visitor sent to their country, a browse address put in order) keeps the code, or the visit
// counts as direct.

/** A ref code's shape (the `ref_codes_code_check` constraint) */
export const REF_CODE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

/** `?query` with `ref=<code>` added when the address had a well-formed one */
export function withRef(query: string, value: string | string[] | undefined): string {
  const code = Array.isArray(value) ? value[0] : value;
  if (!code || !REF_CODE.test(code)) return query;
  return `${query ? `${query}&` : '?'}ref=${code}`;
}
