import { type Analysis, type Explanation, number, statusLabels } from "./types";

function download(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const csvCell = (value: unknown) => {
  let text = String(value ?? "");
  if (typeof value === "string" && /^[\s]*[=+\-@]/.test(text))
    text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
};
export function exportCSV(analysis: Analysis) {
  const fields = [
    "weapon",
    "records",
    "kills",
    "deaths",
    "kd",
    "usage_share",
    "damage",
    "damage_records",
    "average_damage",
    "delta",
    "status",
    "suggestion",
  ] as const;
  const rows = [
    fields.join(","),
    ...analysis.weapons.map((w) => fields.map((f) => csvCell(w[f])).join(",")),
  ];
  download(
    "\uFEFF" + rows.join("\r\n"),
    "balance-metrics.csv",
    "text/csv;charset=utf-8",
  );
}
export function exportReport(
  a: Analysis,
  source: string,
  explanation: Explanation | null,
) {
  const table = a.weapons
    .map(
      (w) =>
        `<tr><td>${escape(w.weapon)}</td><td>${w.records}</td><td>${number(w.kd, 2)}</td><td>${number(w.usage_share * 100, 1)}%</td><td>${escape(statusLabels[w.status])}</td><td>${escape(w.suggestion)}</td></tr>`,
    )
    .join("");
  const teams = a.teams
    .map(
      (t) =>
        `<tr><td>${escape(t.team)}</td><td>${t.records}</td><td>${number(t.kd, 2)}</td><td>${number(t.average_damage, 1)}</td></tr>`,
    )
    .join("");
  const content = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Game Balance Report</title><style>body{font:16px/1.6 system-ui,sans-serif;color:#18222e;max-width:1100px;margin:40px auto;padding:24px}h1{font-size:36px}h2{margin-top:36px}table{border-collapse:collapse;width:100%;font-size:14px}td,th{text-align:left;border-bottom:1px solid #ccd5dc;padding:12px}small{color:#4b5967}.summary{background:#edf4e5;padding:20px;border-radius:12px}p{white-space:pre-line}@media print{body{margin:0}table{font-size:11px}}</style></head><body><small>AI GAME BALANCER / ANALYSIS REPORT</small><h1>Better balance starts with evidence.</h1><p>Dataset: ${escape(source)}<br>Generated: ${escape(new Date().toISOString())}<br>Filters: weapon = ${escape(a.filters.weapon || "All")}; team = ${escape(a.filters.team || "All")}<br>Absolute tolerance: ${a.tolerance}; minimum sample: ${a.minimum_sample} records.</p><div class="summary">${a.summary.records} of ${a.total_records} records · ${a.summary.weapons} weapons · ${number(a.summary.kd, 2)} aggregate K/D · ${a.summary.signals} potential imbalance signals</div><h2>Weapon findings</h2><table><thead><tr><th>Weapon</th><th>Records</th><th>K/D</th><th>Record share</th><th>Signal</th><th>Next step</th></tr></thead><tbody>${table}</tbody></table><h2>Team performance</h2>${teams ? `<table><thead><tr><th>Team</th><th>Records</th><th>K/D</th><th>Average damage</th></tr></thead><tbody>${teams}</tbody></table>` : "<p>No team data supplied.</p>"}<h2>Interpretation</h2><small>${explanation?.source === "openai" ? "AI-generated explanation — verify against the evidence" : "Built-in explanation"}</small><p>${escape(explanation?.text || "Review the findings above and test potential changes in a controlled playtest. No live AI explanation was requested.")}</p><h2>Methodology and limitations</h2><p>${escape(a.methodology)}</p>${a.warnings.map((w) => `<p>${escape(w)}</p>`).join("")}<p>Repeated observations may include the same player. No causal effect, significance, win rate or exact patch percentage is inferred.</p></body></html>`;
  download(content, "game-balance-report.html", "text/html;charset=utf-8");
}
export function exportTemplate() {
  download(
    "player_id,team,weapon,kills,deaths,damage_done\r\nP001,Atlas,Rifle,12,10,1450\r\nP002,Ember,SMG,10,12,1220\r\n",
    "match-data-template.csv",
    "text/csv;charset=utf-8",
  );
}
