import { RULE_LABELS } from "../src/rules.js";
import { el, svg } from "./dom.js";
import { pairedDays } from "./view.js";

/**
 * The days of the last comparison, by pairs (Sami, 26/10/2026, the stats tab): a row per rule, a dot per day at the
 * turns of truck waiting gained on the list order (right of 0, a gain), the mean and its interval over them. One axis,
 * one hue, the zero line marked; each dot tells its day on hover; the table of the Comparaisons tab is the same in
 * figures.
 */
const WIDTH = 760;
const ROW = 40;
const LEFT = 190;
const RIGHT = 16;
const fixed = (value, digits = 1) => value.toFixed(digits).replace(".", ",");

function rowMarks(row, i, { x, summary }) {
  const y = ROW * i + ROW / 2;
  const gain = summary[row.name]?.gain;
  const marks = [svg("text", { x: LEFT - 10, y: y + 4, class: "strip-label" }, RULE_LABELS[row.name] ?? row.name)];
  if (gain) marks.push(svg("rect", { x: x(gain.low), y: y - 7, width: Math.max(2, x(gain.high) - x(gain.low)), height: 14, rx: 4, class: "strip-interval" }));
  // Days often share a value: each dot a little up or down, by its day, so that they stay apart.
  for (const [k, day] of row.diffs.entries()) {
    const dot = svg("circle", { cx: x(day.gain), cy: y + ((k % 5) - 2) * 2.5, r: 4, class: "strip-dot" });
    dot.append(svg("title", {}, `Journée ${day.seed} : ${fixed(day.gain, 0)} tours à quai gagnés sur la liste`));
    marks.push(dot);
  }
  if (gain) marks.push(svg("rect", { x: x(gain.mean) - 1.5, y: y - 10, width: 3, height: 20, rx: 1.5, class: "strip-mean" }));
  return marks;
}

/** The strip chart of `compared` (`runs`, `rows`, `seed`), or nothing before a comparison that kept its days. */
export function pairedStrip(compared) {
  if (!compared?.runs) return [];
  const { rows, low, high } = pairedDays(compared.runs, compared.seed);
  const height = ROW * rows.length + 26;
  const x = (value) => LEFT + ((value - low) / (high - low || 1)) * (WIDTH - LEFT - RIGHT);
  const chart = svg("svg", { viewBox: `0 0 ${WIDTH} ${height}`, class: "strip", role: "img", "aria-label": "Le temps à quai gagné sur la liste, journée par journée" });
  chart.append(svg("line", { x1: x(0), x2: x(0), y1: 0, y2: ROW * rows.length, class: "strip-zero" }));
  rows.forEach((row, i) => chart.append(...rowMarks(row, i, { x, summary: compared.rows })));
  const axisY = ROW * rows.length + 18;
  chart.append(svg("text", { x: x(low), y: axisY, class: "strip-axis" }, fixed(low, 0)), svg("text", { x: x(0), y: axisY, class: "strip-axis" }, "0"), svg("text", { x: x(high), y: axisY, class: "strip-axis end" }, fixed(high, 0)));
  const caption = `Tours à quai gagnés sur la liste, sur les mêmes ${compared.days} journées : un point par journée, à droite de 0 un gain ; la barre claire, l'intervalle à 95 % ; le trait, la moyenne.`;
  return [el("h2", {}, "Journée par journée"), el("figure", { class: "chart" }, el("figcaption", {}, caption), chart)];
}
