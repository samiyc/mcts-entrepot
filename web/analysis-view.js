import { LINE_RULE_LABELS } from "../src/line-rules.js";
import { el, svg } from "./dom.js";

/**
 * The analysis of an hour played with the driver, drawn (Sami, 26/10/2026, step 3; src/line-analysis.js): the line's
 * stop by slices of 5 minutes, with the driver and without, side by side; then the same figures in a table, and what the
 * driver did. One axis, two series in the colours checked for both themes (--series-with, --series-without), a legend,
 * each bar telling its figure on hover.
 */
const WIDTH = 760;
const HEIGHT = 180;
const LEFT = 34;
const BOTTOM = 22;
const fixed = (value, digits = 0) => value.toFixed(digits).replace(".", ",");
const seconds = (turns, turnSeconds) => `${fixed((turns * turnSeconds) / 60, 1)} min`;

function bars(report, turnSeconds) {
  const high = Math.max(1, ...report.slices.flatMap((one) => [one.with, one.without]));
  const band = (WIDTH - LEFT) / report.slices.length;
  const y = (value) => HEIGHT - BOTTOM - (value / high) * (HEIGHT - BOTTOM - 8);
  const chart = svg("svg", { viewBox: `0 0 ${WIDTH} ${HEIGHT}`, class: "analysis-chart", role: "img", "aria-label": "L'arrêt de la ligne par tranches de 5 minutes, avec et sans le cariste" });
  chart.append(svg("line", { x1: LEFT, x2: WIDTH, y1: y(0), y2: y(0), class: "axis-line" }), svg("text", { x: LEFT - 6, y: y(high) + 4, class: "axis-label end" }, String(high)), svg("text", { x: LEFT - 6, y: y(0), class: "axis-label end" }, "0"));
  report.slices.forEach((slice, i) => {
    const x = LEFT + i * band;
    const width = band / 2 - 3;
    const mark = (value, offset, kind, who) => {
      const rect = svg("rect", { x: x + offset, y: y(value), width, height: Math.max(0, y(0) - y(value)), rx: 2, class: `bar ${kind}` });
      rect.append(svg("title", {}, `${who}, de ${i * report.sliceMinutes} à ${(i + 1) * report.sliceMinutes} min : ${value} tours d'arrêt (${seconds(value, turnSeconds)})`));
      return rect;
    };
    chart.append(mark(slice.with, 2, "with", "Avec vous"), mark(slice.without, band / 2 + 1, "without", "Sans vous"), svg("text", { x: x + band / 2, y: HEIGHT - 6, class: "axis-label" }, `${i * report.sliceMinutes}`));
  });
  return chart;
}

function table(report, turnSeconds) {
  const head = ["", "avec vous", "sans vous (les robots seuls)"].map((text, i) => el("th", { class: i > 0 ? "num" : null }, text));
  const row = (label, a, b) => el("tr", {}, el("td", {}, label), el("td", { class: "num" }, a), el("td", { class: "num" }, b));
  const { with: one, without: other } = report;
  return el(
    "div",
    { class: "scroll" },
    el(
      "table",
      {},
      el("thead", {}, el("tr", {}, ...head)),
      el(
        "tbody",
        {},
        row("arrêt de la ligne", `${one.stopped} tours (${seconds(one.stopped, turnSeconds)})`, `${other.stopped} tours (${seconds(other.stopped, turnSeconds)})`),
        row("véhicules", String(one.produced), String(other.produced)),
        row("plus long arrêt", `${one.longestStop} tours`, `${other.longestStop} tours`),
        row("bacs portés par le cariste", String(one.humanDelivered), "—"),
        row("ralentissements des robots près de vous", String(one.cautions ?? 0), "—"),
      ),
    ),
  );
}

/** The section of an analysis: the chart, its legend, the table, what the driver did. */
export function analysisView(report, turnSeconds) {
  const legend = el("p", { class: "legend hint" }, el("span", { class: "swatch with" }), " avec vous ", el("span", { class: "swatch without" }), ` sans vous, les robots seuls (règle : ${LINE_RULE_LABELS[report.rule]}) · en abscisse, les minutes`);
  const done = `Vous avez fait ${report.actions.steps} pas, ${report.actions.act} fois E, attendu ${report.actions.wait} tours.`;
  return el("section", { class: "player" }, el("h2", {}, `L'heure ${report.seed} analysée : l'arrêt de la ligne, toutes les 5 minutes`), el("figure", { class: "chart" }, bars(report, turnSeconds), legend), table(report, turnSeconds), el("p", { class: "hint" }, done));
}
