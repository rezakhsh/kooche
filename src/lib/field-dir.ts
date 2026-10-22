/**
 * The `dir` of a field that takes Persian or Latin text: "auto" once it holds something, "rtl"
 * while empty (an empty dir="auto" field would start on the left). See
 * src/components/auto-direction.tsx.
 */
export const fieldDir = (value: string | null | undefined): 'auto' | 'rtl' => (value ? 'auto' : 'rtl');
