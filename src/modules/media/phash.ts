// 64-bit perceptual hash (pHash) for spotting reused or stolen photos (docs/schema.md,
// listing_images.phash). The classic DCT variant: greyscale 32×32, 2-D DCT-II, the 8×8 lowest
// frequencies without the DC term compared with their median. Re-compressed, resized or slightly
// recoloured copies land within a few bits.

const N = 32;
const K = 8;

// cos((2x+1)uπ / 2N), computed once
const COS: Float64Array[] = Array.from({ length: K }, (_, u) =>
  Float64Array.from({ length: N }, (_, x) => Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N))),
);

/** `pixels`: 32×32 greyscale bytes, row by row. Returns a signed 64-bit value for a bigint column. */
export function phash64(pixels: Uint8Array): bigint {
  if (pixels.length !== N * N) throw new Error(`phash64 needs ${N * N} greyscale pixels`);
  // DCT along rows, keeping only the first K frequencies
  const rows: Float64Array[] = [];
  for (let y = 0; y < N; y++) {
    const r = new Float64Array(K);
    for (let u = 0; u < K; u++) {
      let s = 0;
      for (let x = 0; x < N; x++) s += pixels[y * N + x]! * COS[u]![x]!;
      r[u] = s;
    }
    rows.push(r);
  }
  // Then along columns
  const coeffs: number[] = [];
  for (let v = 0; v < K; v++) {
    for (let u = 0; u < K; u++) {
      let s = 0;
      for (let y = 0; y < N; y++) s += rows[y]![u]! * COS[v]![y]!;
      coeffs.push(s);
    }
  }
  // The DC term is the average brightness: it says nothing about the picture's structure
  const ac = coeffs.slice(1);
  const median = [...ac].sort((a, b) => a - b)[Math.floor(ac.length / 2)]!;
  let hash = 0n;
  for (const c of coeffs) hash = (hash << 1n) | (c > median ? 1n : 0n);
  return BigInt.asIntN(64, hash);
}

/** Number of differing bits */
export function hammingDistance(a: bigint, b: bigint): number {
  let x = BigInt.asUintN(64, a ^ b);
  let n = 0;
  while (x) {
    x &= x - 1n;
    n++;
  }
  return n;
}
