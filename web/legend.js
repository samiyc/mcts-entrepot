import { el } from "./dom.js";

/**
 * What tells the tabs apart (Sami, 29/10/2026: "we don't see the difference between the three tabs"): at the top of a
 * tab, what it shows, what it measures and how long it plays; under a board, the key to its cells.
 */

/** The facts of a tab, `[[term, text], …]`, in one row of cards. */
export const facts = (items) => el("dl", { class: "tab-facts" }, ...items.map(([term, text]) => el("div", {}, el("dt", {}, term), el("dd", {}, text))));

/** A key item: a swatch of the board's own class, or a symbol, and its words. */
const item = ([swatch, text]) => el("li", {}, /^[a-z ]+$/.test(swatch) ? el("span", { class: `key-swatch ${swatch}` }) : el("span", { class: "key-symbol" }, swatch), text);

/** The key to a board: `[[class or symbol, text], …]`. */
export const legend = (items) => el("ul", { class: "legend" }, ...items.map(item));

/** The warehouse's key; the assembly station only on a plan that has one. */
export function warehouseKey(day) {
  return legend([
    ["block", "A à L : les rayons, où les robots prennent les palettes"],
    ["dock", "le quai, où vient le camion"],
    ["bay", "les cases où une palette attend son camion"],
    ["blockable", "une allée qui peut se bloquer"],
    ["⚡", "une borne, d'où part un robot"],
    ...(day.warehouse.stations?.length ? [["assembly", "le poste d'assemblage et son spécialiste"]] : []),
  ]);
}

/** The line's key. */
export const lineKey = () =>
  legend([
    ["block shelf", "A à L : le supermarché, où les robots prennent les bacs pleins"],
    ["slot", "le bord de ligne : les bacs de chaque poste"],
    ["station", "P1 à P5 : les postes"],
    ["🚗", "les véhicules, qui avancent d'un poste à chaque takt"],
    ["blockable", "une allée qui peut se bloquer"],
  ]);
