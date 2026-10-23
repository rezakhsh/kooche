import { encode } from 'uqr';

/** A QR code as one SVG path (one 1×1 square per dark module), for an inline <svg> under our CSP */
export function qrPath(text: string): { size: number; d: string } {
  const { data } = encode(text, { ecc: 'M', border: 2 });
  const size = data.length;
  let d = '';
  data.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) d += `M${x} ${y}h1v1h-1z`;
  }));
  return { size, d };
}
