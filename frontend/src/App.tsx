import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Crosshair,
  Database,
  FileDown,
  FileUp,
  FlaskConical,
  Layers3,
  LoaderCircle,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Swords,
  Target,
  Users,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { post, request } from "./api";
import { exportCSV, exportReport, exportTemplate } from "./exports";
import {
  type Analysis,
  type Explanation,
  type Filters,
  type Match,
  type Weapon,
  colors,
  number,
  statusLabels,
} from "./types";

const initialFilters: Filters = { weapon: "", team: "" };
const pages = [
  "Overview",
  "Weapon lab",
  "Team insights",
  "Match data",
] as const;
type Page = (typeof pages)[number];
const pageIcons = [Layers3, Crosshair, Users, Database];
const pageCopy: Record<Page, [string, string]> = {
  Overview: [
    "See the signals. Find the balance.",
    "Turn match data into a more balanced player experience.",
  ],
  "Weapon lab": [
    "Every weapon has a story.",
    "Compare performance, inspect sample sizes, and plan your next playtest.",
  ],
  "Team insights": [
    "Look beyond the leaderboard.",
    "Explore team performance without confusing correlation with causation.",
  ],
  "Match data": [
    "Good decisions start with good data.",
    "Explore the observations behind your balance analysis.",
  ],
};

function Badge({ weapon }: { weapon: Weapon }) {
  return (
    <span className={`badge ${weapon.status}`}>
      <span />
      {statusLabels[weapon.status]}
    </span>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("Overview");
  const [rows, setRows] = useState<Match[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [source, setSource] = useState("");
  const [synthetic, setSynthetic] = useState(false);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [tolerance, setTolerance] = useState(0.75);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [search, setSearch] = useState("");
  const [tablePage, setTablePage] = useState(0);
  const [weaponPage, setWeaponPage] = useState(0);
  const [methodOpen, setMethodOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const generation = useRef(0);
  const explanationGeneration = useRef(0);

  useEffect(() => {
    if (methodOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [methodOpen]);

  async function run(
    data: Match[] | File,
    name: string,
    isDemo: boolean,
    nextFilters = filters,
    nextTolerance = tolerance,
  ) {
    const current = ++generation.current;
    ++explanationGeneration.current;
    setExplaining(false);
    setExplanation(null);
    setBusy(true);
    setError("");
    try {
      let init: RequestInit;
      if (data instanceof File) {
        if (data.size > 10 * 1024 * 1024)
          throw new Error(
            "This CSV exceeds the 10 MB limit. Choose a smaller file.",
          );
        const form = new FormData();
        form.append("file", data);
        form.append("tolerance", String(nextTolerance));
        form.append("filters", JSON.stringify(nextFilters));
        init = { method: "POST", body: form };
      } else
        init = post({ data, tolerance: nextTolerance, filters: nextFilters });
      const result = await request<{ analysis: Analysis; records: Match[] }>(
        "/api/v1/analyze",
        init,
      );
      if (current !== generation.current) return;
      setRows(result.records);
      setAnalysis(result.analysis);
      setSource(name);
      setSynthetic(isDemo);
      setFilters(nextFilters);
      setTolerance(nextTolerance);
      setTablePage(0);
      setWeaponPage(0);
      setSearch("");
    } catch (e) {
      if (current === generation.current) {
        setError((e as Error).message);
        setTolerance(analysis?.tolerance ?? 0.75);
      }
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }

  async function loadDemo() {
    const current = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const data = await request<{ records: Match[]; name: string }>(
        "/api/v1/demo",
      );
      if (current === generation.current)
        await run(data.records, data.name, true, initialFilters, 0.75);
    } catch (e) {
      if (current === generation.current) {
        setError((e as Error).message);
        setBusy(false);
      }
    }
  }

  async function explain() {
    const current = ++explanationGeneration.current;
    setExplaining(true);
    try {
      const value = await request<Explanation>(
        "/api/v1/explanations",
        post({ data: rows, filters, tolerance }),
      );
      if (current === explanationGeneration.current) setExplanation(value);
    } catch (e) {
      if (current === explanationGeneration.current)
        setError((e as Error).message);
    } finally {
      if (current === explanationGeneration.current) setExplaining(false);
    }
  }

  function upload(file?: File) {
    if (file) void run(file, file.name, false, initialFilters, 0.75);
  }
  const visibleRows = useMemo(
    () =>
      rows
        .filter(
          (r) =>
            (!filters.weapon || r.weapon === filters.weapon) &&
            (!filters.team || r.team === filters.team),
        )
        .filter(
          (r) =>
            !search ||
            Object.values(r).some((v) =>
              String(v).toLowerCase().includes(search.toLowerCase()),
            ),
        ),
    [rows, filters, search],
  );
  const sorted = useMemo(
    () =>
      analysis
        ? [...analysis.weapons].sort((a, b) => (b.kd ?? -1) - (a.kd ?? -1))
        : [],
    [analysis],
  );
  const signals = sorted.filter((w) => w.status.startsWith("potential_"));
  const sampleIssues = sorted.filter(
    (w) => w.status === "insufficient_data" || w.status === "unavailable",
  );
  const [title, subtitle] = pageCopy[page];

  function weaponTable() {
    return (
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Scrollable data table"
      >
        <table>
          <thead>
            <tr>
              <th>Weapon</th>
              <th>K/D ratio</th>
              <th>Records</th>
              <th>Record share</th>
              <th>Avg. damage</th>
              <th>Balance signal</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(weaponPage * 20, weaponPage * 20 + 20).map((w) => (
              <tr key={w.weapon}>
                <td>
                  <span className="weapon-icon">
                    <Crosshair size={15} />
                  </span>
                  <strong>{w.weapon}</strong>
                </td>
                <td className="numeric">{number(w.kd, 2)}</td>
                <td className="numeric muted">{number(w.records)}</td>
                <td>
                  <div className="share">
                    <span style={{ width: `${w.usage_share * 100}%` }} />
                  </div>
                  <span className="muted tiny">
                    {number(w.usage_share * 100, 1)}%
                  </span>
                </td>
                <td className="numeric muted">{number(w.average_damage)}</td>
                <td>
                  <Badge weapon={w} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!sorted.length && (
          <div className="empty-inline">No weapons match these filters.</div>
        )}
        {sorted.length > 20 && (
          <div className="pagination">
            <span>
              {number(sorted.length)} weapons · Page {weaponPage + 1} of{" "}
              {Math.ceil(sorted.length / 20)}
            </span>
            <button
              className="icon-button"
              aria-label="Previous weapons"
              disabled={weaponPage === 0}
              onClick={() => setWeaponPage((p) => p - 1)}
            >
              <ChevronLeft size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Next weapons"
              disabled={(weaponPage + 1) * 20 >= sorted.length}
              onClick={() => setWeaponPage((p) => p + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        )}
      </div>
    );
  }

  function teamsPanel() {
    return (
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Team performance</h2>
            <p>Descriptive totals across the current selection</p>
          </div>
          <Users size={19} className="muted" />
        </div>
        {analysis!.teams.length ? (
          <div className="team-grid">
            {analysis!.teams.map((t, i) => (
              <div className="team-card" key={t.team}>
                <div className="team-name">
                  <span className={`team-mark team-${i % 2}`}>
                    <ShieldCheck size={22} />
                  </span>
                  <div>
                    <h3>{t.team}</h3>
                    <p>{number(t.records)} records</p>
                  </div>
                </div>
                <div className="team-stats">
                  <div>
                    <small>Aggregate K/D</small>
                    <strong>{number(t.kd, 2)}</strong>
                  </div>
                  <div>
                    <small>Total kills</small>
                    <strong>{number(t.kills)}</strong>
                  </div>
                  <div>
                    <small>Avg. damage</small>
                    <strong>{number(t.average_damage)}</strong>
                  </div>
                </div>
                <p className="tiny muted">
                  Damage coverage: {number(t.damage_records)} of{" "}
                  {number(t.records)} records
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-inline">
            <Users size={28} />
            <h3>No team data supplied</h3>
            <p>Add an optional team column to compare team performance.</p>
          </div>
        )}
        <div className="panel-foot">
          <CircleHelp size={14} />
          Team K/D does not measure win rate or prove a matchmaking imbalance.
          Records without a team are excluded here.
        </div>
      </section>
    );
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <aside className="sidebar">
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            setPage("Overview");
          }}
          aria-label="AI Game Balancer home"
        >
          <span className="brand-symbol">
            <BarChart3 size={23} />
          </span>
          <span>
            GAME BALANCER<small>THE BALANCE STUDIO</small>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-icon">
            <Swords size={18} />
          </span>
          <span>
            My workspace<small>Personal studio</small>
          </span>
          <span className="version">01</span>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {pages.map((name, i) => {
            const Icon = pageIcons[i];
            return (
              <button
                key={name}
                className={page === name ? "nav-item active" : "nav-item"}
                onClick={() => setPage(name)}
                aria-current={page === name ? "page" : undefined}
              >
                <Icon size={18} />
                {name}
                {name === "Overview" && <span className="nav-dot" />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="studio-note">
            <FlaskConical size={20} />
            <h3>
              Better games.
              <br />
              Backed by evidence.
            </h3>
            <p>Your next balance decision starts with a good question.</p>
            <button onClick={() => setMethodOpen(true)}>
              How analysis works <ArrowUpRight size={14} />
            </button>
          </div>
          <a
            className="repo-link"
            href="https://github.com/Vizzaq23/ai-game-balancer-"
            target="_blank"
            rel="noreferrer"
          >
            <span className="avatar">QV</span>
            <span>
              Built by Quintin Vizza<small>View the project on GitHub</small>
            </span>
            <ArrowUpRight size={14} />
          </a>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <span>{page}</span>
          </div>
          <span className="topbar-label">
            <span className="green-dot" />
            Evidence-led game design
          </span>
        </header>
        <main id="main" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                BALANCE STUDIO <span>/</span> {page.toUpperCase()}
              </div>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
            <div className="heading-actions">
              {analysis && (
                <button
                  className="button secondary"
                  onClick={() => exportReport(analysis, source, explanation)}
                  disabled={busy}
                >
                  <FileDown size={16} />
                  Export report
                </button>
              )}
              <button
                className="button primary"
                onClick={() => input.current?.click()}
                disabled={busy}
              >
                <FileUp size={16} />
                Upload CSV
              </button>
            </div>
          </div>
          <input
            ref={input}
            className="sr-only"
            type="file"
            accept=".csv,text/csv"
            aria-label="Upload match CSV"
            onChange={(e) => {
              upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {error && (
            <div className="error-banner" role="alert">
              <div>
                <strong>We couldn’t complete that request</strong>
                <p>{error}</p>
                {analysis && (
                  <small>
                    Your previous analysis is still available below.
                  </small>
                )}
              </div>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={18} />
              </button>
            </div>
          )}
          <div className="sr-only" role="status">
            {busy
              ? "Analyzing data. Please wait."
              : analysis
                ? `Analysis ready: ${analysis.summary.records} records and ${analysis.summary.signals} potential imbalance signals.`
                : "Choose demo data or upload a CSV to begin."}
          </div>
          {!analysis ? (
            <>
              <section className="welcome panel">
                <div className="welcome-copy">
                  <span className="pill">
                    <FlaskConical size={13} />
                    YOUR NEXT PLAYTEST, INFORMED
                  </span>
                  <h2>
                    A fair fight
                    <br />
                    starts here<span>.</span>
                  </h2>
                  <p>
                    See how your weapons perform. Find the outliers. Turn match
                    data into a clear plan for your next balance pass.
                  </p>
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={loadDemo}
                  >
                    {busy ? (
                      <LoaderCircle size={17} className="spin" />
                    ) : (
                      <Activity size={17} />
                    )}
                    Explore demo data <ArrowRight size={17} />
                  </button>
                  <small>607 synthetic records · 6 weapons · No sign-up</small>
                </div>
                <div className="welcome-visual" aria-hidden="true">
                  <div className="visual-top">
                    <span>PERFORMANCE SNAPSHOT</span>
                    <span className="green-dot" />
                  </div>
                  <div className="radar-rings">
                    <div className="radar-ring inner" />
                    <div className="radar-cross horizontal" />
                    <div className="radar-cross vertical" />
                    <Crosshair size={52} />
                    <span className="orbit-dot one" />
                    <span className="orbit-dot two" />
                    <span className="orbit-dot three" />
                  </div>
                  <div className="visual-label">
                    <span className="green-dot" />
                    Find your competitive equilibrium
                  </div>
                  <div className="mini-bars">
                    {[34, 55, 46, 90, 52, 28, 63, 45, 59, 36, 72, 48].map(
                      (h, i) => (
                        <span key={i} style={{ height: `${h}%` }} />
                      ),
                    )}
                  </div>
                </div>
              </section>
              <div className="onboarding-grid">
                <section
                  className={`upload-zone ${dragging ? "dragging" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    if (!busy) upload(e.dataTransfer.files[0]);
                  }}
                >
                  <span className="upload-icon">
                    <FileUp size={23} />
                  </span>
                  <h2>Bring your own match data</h2>
                  <p>Drop a CSV here, or choose a file to get started.</p>
                  <button
                    className="button secondary"
                    onClick={() => input.current?.click()}
                    disabled={busy}
                  >
                    Choose CSV file <ArrowRight size={15} />
                  </button>
                  <small>UTF-8 CSV · Up to 10 MB / 50,000 records</small>
                  <button className="text-button" onClick={exportTemplate}>
                    <ArrowDownToLine size={14} />
                    Download CSV template
                  </button>
                </section>
                <section className="getting-started panel">
                  <span className="eyebrow">FROM DATA TO DECISIONS</span>
                  {[
                    [
                      "01",
                      "Bring in your observations",
                      "Upload player-weapon records from your playtests.",
                    ],
                    [
                      "02",
                      "Explore the balance signals",
                      "Compare K/D, record share, and damage with context.",
                    ],
                    [
                      "03",
                      "Make your next test count",
                      "Export findings and validate changes in a playtest.",
                    ],
                  ].map(([n, t, d]) => (
                    <div className="step" key={n}>
                      <span>{n}</span>
                      <div>
                        <h3>{t}</h3>
                        <p>{d}</p>
                      </div>
                    </div>
                  ))}
                  <div className="privacy-note">
                    <ShieldCheck size={16} />
                    Uploads are processed in memory, never saved.
                  </div>
                </section>
              </div>
            </>
          ) : (
            <div
              className={busy ? "results updating" : "results"}
              aria-busy={busy}
            >
              <div className="dataset-bar">
                <div className="dataset-name">
                  <span className="dataset-icon">
                    <Database size={17} />
                  </span>
                  <div>
                    <strong>{source}</strong>
                    <small>
                      {number(analysis.total_records)} records loaded{" "}
                      <span>·</span>{" "}
                      {synthetic
                        ? "Synthetic sample data"
                        : "Uploaded CSV · processed in memory"}
                    </small>
                  </div>
                  {synthetic && <span className="pill demo-pill">DEMO</span>}
                </div>
                <button
                  className="text-button"
                  onClick={loadDemo}
                  disabled={busy}
                >
                  {busy ? (
                    <LoaderCircle className="spin" size={14} />
                  ) : (
                    <Activity size={14} />
                  )}
                  Reload demo
                </button>
              </div>
              <div className="filters">
                <div className="filter-label">
                  <SlidersHorizontal size={16} />
                  <span>Analysis filters</span>
                </div>
                <label>
                  <span className="sr-only">Weapon filter</span>
                  <select
                    aria-label="Weapon filter"
                    value={filters.weapon}
                    disabled={busy}
                    onChange={(e) =>
                      run(rows, source, synthetic, {
                        ...filters,
                        weapon: e.target.value,
                      })
                    }
                  >
                    <option value="">All weapons</option>
                    {analysis.options.weapons.map((w) => (
                      <option key={w}>{w}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="sr-only">Team filter</span>
                  <select
                    aria-label="Team filter"
                    value={filters.team}
                    disabled={busy}
                    onChange={(e) =>
                      run(rows, source, synthetic, {
                        ...filters,
                        team: e.target.value,
                      })
                    }
                  >
                    <option value="">All teams</option>
                    {analysis.options.teams.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label className="tolerance">
                  <span>Balance tolerance</span>
                  <input
                    aria-label="Balance tolerance"
                    type="range"
                    min="0"
                    max="5"
                    step="0.05"
                    value={tolerance}
                    disabled={busy}
                    onChange={(e) => setTolerance(Number(e.target.value))}
                    onPointerUp={(e) =>
                      run(
                        rows,
                        source,
                        synthetic,
                        filters,
                        Number(e.currentTarget.value),
                      )
                    }
                    onKeyUp={(e) => {
                      if (
                        [
                          "ArrowLeft",
                          "ArrowRight",
                          "Home",
                          "End",
                          "PageUp",
                          "PageDown",
                        ].includes(e.key)
                      )
                        void run(
                          rows,
                          source,
                          synthetic,
                          filters,
                          Number(e.currentTarget.value),
                        );
                    }}
                    onBlur={() => {
                      if (!busy && tolerance !== analysis.tolerance)
                        void run(rows, source, synthetic);
                    }}
                  />
                  <output>{number(tolerance, 2)}</output>
                </label>
                {(filters.weapon || filters.team) && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => run(rows, source, synthetic, initialFilters)}
                  >
                    Reset filters
                  </button>
                )}
                <button
                  className="icon-button help-button"
                  aria-label="Explain methodology"
                  onClick={() => setMethodOpen(true)}
                >
                  <CircleHelp size={17} />
                </button>
              </div>
              {analysis.warnings.map((w) => (
                <div className="warning" key={w}>
                  <CircleHelp size={15} />
                  <span>{w}</span>
                </div>
              ))}
              <div className="stats-grid">
                {[
                  {
                    label: "Records analyzed",
                    value: number(analysis.summary.records),
                    note: "Player-weapon observations",
                    Icon: Database,
                  },
                  {
                    label: "Weapons in play",
                    value: number(analysis.summary.weapons).padStart(2, "0"),
                    note: "Unique weapons in selection",
                    Icon: Crosshair,
                  },
                  {
                    label: "Aggregate K/D",
                    value: number(analysis.summary.kd, 2),
                    note: "Total kills ÷ total deaths",
                    Icon: Activity,
                  },
                  {
                    label: "Balance signals",
                    value: number(analysis.summary.signals).padStart(2, "0"),
                    note: "Potential imbalances to review",
                    Icon: Target,
                  },
                ].map(({ label, value, note, Icon }, i) => (
                  <div className={`stat-card stat-${i}`} key={label}>
                    <div className="stat-top">
                      <span>{label}</span>
                      <Icon size={17} />
                    </div>
                    <strong>{value}</strong>
                    <small>
                      {i === 3 && analysis.summary.signals > 0 && (
                        <span className="amber-dot" />
                      )}
                      {note}
                    </small>
                  </div>
                ))}
              </div>
              {(page === "Overview" || page === "Weapon lab") && (
                <>
                  <div className="analysis-grid">
                    <section className="panel chart-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>
                            Weapon performance{" "}
                            <span className="count">{sorted.length}</span>
                          </h2>
                          <p>
                            Aggregate K/D compared with the selection baseline
                          </p>
                        </div>
                        <span className="chart-unit">K/D RATIO</span>
                      </div>
                      <div
                        className="chart"
                        role="img"
                        aria-label="Weapon K/D bar chart. Exact values and balance signals are available in the weapon breakdown table below."
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={sorted.slice(0, 20)}
                            layout="vertical"
                            margin={{ top: 8, right: 30, bottom: 8, left: 0 }}
                          >
                            <CartesianGrid
                              stroke="#283039"
                              horizontal={false}
                              strokeDasharray="3 5"
                            />
                            <XAxis
                              type="number"
                              tick={{ fill: "#99a6b3", fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              type="category"
                              dataKey="weapon"
                              width={110}
                              tick={{ fill: "#bdc5cd", fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip
                              cursor={{ fill: "#ffffff05" }}
                              contentStyle={{
                                background: "#1a222b",
                                border: "1px solid #3c4752",
                                borderRadius: 8,
                                color: "#ecf0f3",
                              }}
                              formatter={(value) => [
                                number(Number(value), 2),
                                "K/D",
                              ]}
                            />
                            <Bar
                              dataKey="kd"
                              barSize={18}
                              radius={[0, 4, 4, 0]}
                              isAnimationActive={false}
                            >
                              {sorted.slice(0, 20).map((w) => (
                                <Cell key={w.weapon} fill={colors[w.status]} />
                              ))}
                            </Bar>
                            {analysis.summary.kd !== null && (
                              <ReferenceLine
                                x={analysis.summary.kd}
                                stroke="#dae1e7"
                                strokeDasharray="4 4"
                              />
                            )}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="chart-legend">
                        <span>
                          <i style={{ background: "#b8e67b" }} />
                          Within tolerance
                        </span>
                        <span>
                          <i style={{ background: "#f0b878" }} />
                          Above
                        </span>
                        <span>
                          <i style={{ background: "#9ba7ff" }} />
                          Below
                        </span>
                        <span>
                          <i style={{ background: "#80909f" }} />
                          Limited data
                        </span>
                        <span className="baseline-key">
                          ┄ Baseline {number(analysis.summary.kd, 2)}
                        </span>
                      </div>
                      {sorted.length > 20 && (
                        <div className="panel-foot">
                          Chart shows the top 20 by K/D. The table includes all
                          weapons.
                        </div>
                      )}
                    </section>
                    <section className="panel signals-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>
                            <span className="signal-icon">
                              <Sparkles size={15} />
                            </span>
                            Worth a closer look
                          </h2>
                          <p>Signals, with the context that matters</p>
                        </div>
                      </div>
                      <div className="signal-list">
                        {signals.slice(0, 3).map((w) => (
                          <article className="signal-card" key={w.weapon}>
                            <div className="signal-title">
                              <strong>{w.weapon}</strong>
                              <span style={{ color: colors[w.status] }}>
                                {w.delta !== null && w.delta > 0 ? "+" : ""}
                                {number(w.delta, 2)} K/D
                              </span>
                            </div>
                            <Badge weapon={w} />
                            <p>{w.suggestion}</p>
                            <small>
                              {number(w.records)} records · {number(w.kd, 2)}{" "}
                              aggregate K/D
                            </small>
                          </article>
                        ))}
                        {signals.length === 0 && (
                          <div className="quiet-state">
                            <Check size={25} />
                            <h3>No potential imbalance signals</h3>
                            <p>
                              Nothing exceeds this tolerance with enough data.
                              This is not proof of perfect balance.
                            </p>
                          </div>
                        )}
                        {signals.length > 3 && (
                          <p className="tiny muted">
                            {signals.length - 3} more signals in the weapon
                            breakdown.
                          </p>
                        )}
                        {sampleIssues.length > 0 && (
                          <div className="sample-note">
                            <CircleHelp size={16} />
                            <span>
                              <strong>
                                {sampleIssues.length} weapon
                                {sampleIssues.length > 1 ? "s need" : " needs"}{" "}
                                more evidence
                              </strong>
                              <small>
                                Review sample sizes and unavailable ratios
                                below.
                              </small>
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="panel-foot">
                        <ShieldCheck size={14} />
                        Descriptive analysis · No causal claims
                      </div>
                    </section>
                  </div>
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Weapon breakdown</h2>
                        <p>
                          {filters.weapon || filters.team
                            ? "Record share uses the filtered selection"
                            : "Record share is share of uploaded records"}{" "}
                          · Minimum {analysis.minimum_sample} records per
                          finding
                        </p>
                      </div>
                      <button
                        className="button compact secondary"
                        onClick={() => exportCSV(analysis)}
                        disabled={busy}
                      >
                        <ArrowDownToLine size={14} />
                        Export CSV
                      </button>
                    </div>
                    {weaponTable()}
                  </section>
                </>
              )}
              {(page === "Overview" || page === "Team insights") &&
                teamsPanel()}
              {(page === "Overview" || page === "Weapon lab") && (
                <section className="explanation-panel">
                  <div className="explanation-heading">
                    <span className="ai-icon">
                      <Sparkles size={21} />
                    </span>
                    <div>
                      <h2>A clearer next step</h2>
                      <p>
                        Get an interpretation grounded in your current analysis.
                      </p>
                    </div>
                    <button
                      className="button secondary"
                      onClick={explain}
                      disabled={busy || explaining || !analysis.summary.records}
                    >
                      {explaining ? (
                        <LoaderCircle size={16} className="spin" />
                      ) : (
                        <Sparkles size={16} />
                      )}
                      Explain findings
                    </button>
                  </div>
                  {explanation ? (
                    <div className="explanation-copy">
                      <span className="pill">
                        {explanation.source === "openai"
                          ? "AI-GENERATED EXPLANATION"
                          : "BUILT-IN EXPLANATION"}
                      </span>
                      <p>{explanation.text}</p>
                      {explanation.notice && (
                        <small>{explanation.notice}</small>
                      )}
                    </div>
                  ) : (
                    <p className="explanation-hint">
                      Built-in explanations work without an API key. Live AI is
                      optional and only runs when configured and requested.
                    </p>
                  )}
                </section>
              )}
              {page === "Match data" && (
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Match observations</h2>
                      <p>
                        Each row is one player-weapon observation, not
                        necessarily a unique match.
                      </p>
                    </div>
                    <label className="search">
                      <Search size={16} />
                      <input
                        aria-label="Search match data"
                        placeholder="Search records…"
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setTablePage(0);
                        }}
                      />
                    </label>
                  </div>
                  <div
                    className="table-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label="Scrollable data table"
                  >
                    <table>
                      <thead>
                        <tr>
                          {[
                            "Player",
                            "Team",
                            "Weapon",
                            "Kills",
                            "Deaths",
                            "Damage",
                          ].map((h) => (
                            <th key={h}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRows
                          .slice(tablePage * 20, tablePage * 20 + 20)
                          .map((r, i) => (
                            <tr key={i}>
                              <td>{r.player_id || "—"}</td>
                              <td>{r.team || "—"}</td>
                              <td>{r.weapon}</td>
                              <td>{number(r.kills)}</td>
                              <td>{number(r.deaths)}</td>
                              <td>{number(r.damage_done)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {!visibleRows.length && (
                      <div className="empty-inline">
                        No records match your search.
                      </div>
                    )}
                  </div>
                  <div className="pagination">
                    <span>
                      {number(visibleRows.length)} records · Page{" "}
                      {tablePage + 1} of{" "}
                      {Math.max(1, Math.ceil(visibleRows.length / 20))}
                    </span>
                    <button
                      className="icon-button"
                      aria-label="Previous page"
                      disabled={tablePage === 0}
                      onClick={() => setTablePage((p) => p - 1)}
                    >
                      <ChevronLeft size={17} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Next page"
                      disabled={(tablePage + 1) * 20 >= visibleRows.length}
                      onClick={() => setTablePage((p) => p + 1)}
                    >
                      <ChevronRight size={17} />
                    </button>
                  </div>
                </section>
              )}
            </div>
          )}
          <footer>
            <span>
              <span className="brand-dot" />
              AI Game Balancer <span className="footer-divider">/</span>{" "}
              Designed for better play.
            </span>
            <button className="text-button" onClick={() => setMethodOpen(true)}>
              Methodology & limitations <ArrowUpRight size={13} />
            </button>
          </footer>
        </main>
      </div>
      <dialog
        ref={dialog}
        onCancel={() => setMethodOpen(false)}
        onClose={() => setMethodOpen(false)}
        aria-labelledby="method-title"
      >
        <div className="dialog-heading">
          <span className="eyebrow">UNDER THE HOOD</span>
          <button
            className="icon-button"
            aria-label="Close methodology"
            onClick={() => setMethodOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <h2 id="method-title">Evidence before adjustments.</h2>
        <p>
          Upload a UTF-8 CSV with <code>weapon</code>, <code>kills</code>, and{" "}
          <code>deaths</code>. Optional columns: <code>player_id</code>,{" "}
          <code>team</code>, and <code>damage_done</code>. Kills and deaths must
          be non-negative whole numbers.
        </p>
        <h3>How the signals work</h3>
        <p>
          {analysis?.methodology ||
            "We compare aggregate weapon K/D (total kills ÷ total deaths) against the dataset baseline. A weapon needs at least 20 records to receive a potential imbalance signal, and its difference must exceed the absolute tolerance. Zero-death ratios are unavailable."}
        </p>
        <h3>What the data cannot tell us</h3>
        <p>
          Repeated rows can come from the same player. Skill, map, mode, weapon
          role, and selection bias can affect results. We do not infer win
          rates, statistical significance, or exact damage changes. Team totals
          are descriptive, not a matchmaking verdict.
        </p>
        <h3>Your data stays temporary</h3>
        <p>
          Uploads are processed in memory and are not saved. Optional AI
          explanations send aggregate weapon findings, never player identifiers
          or raw records. Refreshing the page clears your session.
        </p>
        <button className="button secondary" onClick={exportTemplate}>
          <FileDown size={16} />
          Download CSV template
        </button>
      </dialog>
    </div>
  );
}
