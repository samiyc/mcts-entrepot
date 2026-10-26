/** What the measuring scripts share to print their lines (26/10/2026: `fixed` was written in each). */

/** A number the French way, with `digits` decimals. */
export const fixed = (value, digits = 1) => value.toFixed(digits).replace(".", ",");

/** A paired gain and its interval: "2,9 (2,8 à 3,1)". */
export const interval = (gain) => `${fixed(gain.mean)} (${fixed(gain.low)} à ${fixed(gain.high)})`;

/** The mean of `key` over the days' measures. */
export const meanOf = (measures, key) => measures.reduce((sum, one) => sum + one[key], 0) / measures.length;
