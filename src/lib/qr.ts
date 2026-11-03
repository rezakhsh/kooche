import qrcode from 'qrcode-generator';

// A QR code as one SVG path, made on the server (the WhatsApp link on the phone page, for computers).
// The page draws it itself, so no markup from a library goes into the page. ASCII text only (a
// percent-encoded link); dark modules on a white tile in both themes, as scanners expect.

export type QrPath = { size: number; d: string };

export function qrPath(text: string): QrPath {
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  const size = qr.getModuleCount();
  let d = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!qr.isDark(y, x)) continue;
      // One rectangle per run of dark modules in a row
      let run = 1;
      while (x + run < size && qr.isDark(y, x + run)) run++;
      d += `M${x} ${y}h${run}v1h-${run}z`;
      x += run - 1;
    }
  }
  return { size, d };
}
