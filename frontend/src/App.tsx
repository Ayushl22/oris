import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  ExternalLink,
  Info,
  LoaderCircle,
  Wind,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  ReferenceLine,
} from "recharts";
import {
  get,
  initialSettings,
  type Day,
  type Interval,
  type Month,
  type Provenance,
  type Settings,
  type Summary,
} from "./api";

const fmt = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const num = (v: number | null) => (v === null ? "—" : fmt.format(v));
const signed = (v: number | null) =>
  v === null ? "—" : `${v > 0 ? "+" : ""}${num(v)}`;
const longDate = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
const stamp = (value: string | null) =>
  value ? value.replace("T", " ").slice(0, 16) : "—";
const timeLabel = (value: string) => value.slice(11, 16);

function useResults(settings: Settings, retry: number, defaultReady: boolean) {
  const [state, setState] = useState<{
    loading: boolean;
    error: string;
    day: Day | null;
    month: Month | null;
  }>({ loading: true, error: "", day: null, month: null });
  useEffect(() => {
    if (!defaultReady) {
      setState({ loading: true, error: "", day: null, month: null });
      return;
    }
    const controller = new AbortController();
    let expired = false;
    const timer = window.setTimeout(() => {
      expired = true;
      controller.abort();
    }, 20000);
    setState({ loading: true, error: "", day: null, month: null });
    const query = new URLSearchParams({
      decision_date: settings.date,
      cutoff: settings.cutoff,
    });
    Promise.all([
      get<Day>(`/api/day?${query}`, controller.signal),
      settings.view === "accuracy" && settings.period === "month"
        ? get<Month>(
            `/api/accuracy?cutoff=${settings.cutoff}`,
            controller.signal,
          )
        : Promise.resolve(null),
    ])
      .then(([day, month]) => {
        if (!controller.signal.aborted)
          setState({ loading: false, error: "", day, month });
      })
      .catch((error) => {
        if (!controller.signal.aborted || expired)
          setState({
            loading: false,
            error: expired
              ? "Data request timed out. Check the API connection and retry."
              : String(error.message),
            day: null,
            month: null,
          });
      })
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    settings.date,
    settings.cutoff,
    settings.view,
    settings.period,
    retry,
    defaultReady,
  ]);
  return state;
}

function Metric({
  label,
  value,
  unit,
  note,
}: {
  label: string;
  value: string;
  unit?: string;
  note: string;
}) {
  return (
    <div className="metric">
      <span className="eyebrow">{label}</span>
      <div className="metric-value">
        {value}
        <span>{unit}</span>
      </div>
      <p>{note}</p>
    </div>
  );
}

function GenerationChart({ day, accuracy }: { day: Day; accuracy: boolean }) {
  if (!day.summary.forecastAvailable)
    return (
      <div className="chart-empty">
        <Wind aria-hidden="true" />
        <h3>No eligible forecast records</h3>
        <p>
          There are no valid forecasts available at this cutoff. Review the
          interval table and data provenance.
        </p>
      </div>
    );
  return (
    <div
      className="chart"
      role="img"
      aria-label={`Wind generation in MW for ${day.deliveryDate}. Forecasts plotted only at exact published delivery timestamps. Full values in the interval table.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={day.intervals}
          margin={{ top: 10, right: 16, bottom: 6, left: 4 }}
        >
          <CartesianGrid
            stroke="var(--border)"
            vertical={false}
            strokeDasharray="3 5"
          />
          <XAxis
            dataKey="startTime"
            tickFormatter={timeLabel}
            interval={7}
            axisLine={false}
            tickLine={false}
            minTickGap={10}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
          />
          <YAxis
            tickFormatter={(v) => `${fmt.format(v / 1000)}k`}
            width={48}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
          />
          <Tooltip
            labelFormatter={(v) =>
              `${String(v).slice(0, 10)} ${timeLabel(String(v))} GMT`
            }
            formatter={(v, name) => [
              `${num(typeof v === "number" ? v : null)} MW`,
              name,
            ]}
            contentStyle={{ borderRadius: 8, borderColor: "var(--border)" }}
          />
          {accuracy && (
            <Line
              name="Actual WIND"
              dataKey="actualMW"
              stroke="var(--actual)"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
          )}
          <Line
            name="Decision forecast"
            dataKey="forecastMW"
            stroke="var(--forecast)"
            strokeWidth={2}
            dot={{ r: 3.5, strokeWidth: 0, fill: "var(--forecast)" }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function MonthlyChart({ month }: { month: Month }) {
  return (
    <div
      className="chart"
      role="img"
      aria-label="Daily mean absolute error and signed bias in MW. Full values in the daily data table."
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={month.days.map((d) => ({
            date: d.decisionDate.slice(8),
            mae: d.summary.maeMW,
            bias: d.summary.biasMW,
          }))}
          margin={{ top: 12, right: 12, left: 0, bottom: 6 }}
        >
          <CartesianGrid
            stroke="var(--border)"
            vertical={false}
            strokeDasharray="3 5"
          />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            interval={4}
          />
          <YAxis
            tickFormatter={(v) => `${fmt.format(v / 1000)}k`}
            width={48}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
          />
          <ReferenceLine y={0} stroke="var(--muted)" />
          <Tooltip
            labelFormatter={(v) => `Decision ${v} Jan 2026`}
            formatter={(v, name) => [
              `${num(typeof v === "number" ? v : null)} MW`,
              name,
            ]}
          />
          <Bar
            name="MAE"
            dataKey="mae"
            fill="var(--forecast)"
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
          <Bar
            name="Signed bias"
            dataKey="bias"
            fill="var(--actual)"
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function IntervalTable({ rows }: { rows: Interval[] }) {
  return (
    <details className="panel disclosure">
      <summary>Interval data and publications</summary>
      <p className="table-note">
        48 expected half-hours. Times are GMT (Europe/London). Missing, invalid
        and conflicting values are excluded from error metrics.
      </p>
      <div
        className="table-scroll"
        tabIndex={0}
        aria-label="Scrollable interval data"
      >
        <table>
          <caption className="sr-only">
            Forecast and actual wind generation by delivery start time
          </caption>
          <thead>
            <tr>
              <th>Delivery start</th>
              <th>Forecast · MW</th>
              <th>Published</th>
              <th>Actual · MW</th>
              <th>Actual published</th>
              <th>Error · MW</th>
              <th>Forecast / actual status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.startTime}>
                <td className="mono">{stamp(r.startTime)}</td>
                <td>{num(r.forecastMW)}</td>
                <td className="mono">{stamp(r.publishTime)}</td>
                <td>{num(r.actualMW)}</td>
                <td className="mono">{stamp(r.actualPublishTime)}</td>
                <td>{signed(r.errorMW)}</td>
                <td>
                  {r.forecastStatus} / {r.actualStatus}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function Coverage({ summary: s }: { summary: Summary }) {
  return (
    <section className="panel coverage">
      <div className="section-heading">
        <h2>Data coverage</h2>
        <span className="tag">Exact timestamp matches</span>
      </div>
      <div className="coverage-top">
        <strong>{num(s.coveragePercent)}%</strong>
        <span>
          {fmt.format(s.matched)} / {fmt.format(s.expected)} valid matches
        </span>
      </div>
      <div className="coverage-track" aria-hidden="true">
        <span style={{ width: `${s.coveragePercent}%` }} />
      </div>
      <dl className="coverage-list">
        <div>
          <dt>Expected half-hours</dt>
          <dd>{fmt.format(s.expected)}</dd>
        </div>
        <div>
          <dt>Missing forecasts</dt>
          <dd>{fmt.format(s.missingForecast)}</dd>
        </div>
        <div>
          <dt>Missing actuals</dt>
          <dd>{fmt.format(s.missingActual)}</dd>
        </div>
        <div>
          <dt>Invalid forecast / actual</dt>
          <dd>
            {s.forecastInvalid} / {s.actualInvalid}
          </dd>
        </div>
        <div>
          <dt>Conflicting forecast / actual</dt>
          <dd>
            {s.forecastConflicts} / {s.actualConflicts}
          </dd>
        </div>
        <div>
          <dt>Unmatched half-hours</dt>
          <dd>{fmt.format(s.unmatched)}</dd>
        </div>
      </dl>
      <p>
        Missing categories can overlap. Only valid matched records contribute to
        metrics.
      </p>
    </section>
  );
}

function ProvenancePanel({ provenance: p }: { provenance: Provenance | null }) {
  if (!p) return null;
  return (
    <details className="panel disclosure provenance">
      <summary>
        <Database size={17} aria-hidden="true" />
        Data provenance and retrieval
      </summary>
      <div className="provenance-body">
        <p>
          Persisted Elexon Insights snapshot. The demonstration reads this file
          without calling Elexon at runtime. Refresh explicitly, then restart or
          redeploy.
        </p>
        <dl>
          <div>
            <dt>Retrieved</dt>
            <dd>{stamp(p.retrievedAt)} UTC</dd>
          </div>
          <div>
            <dt>Source rows</dt>
            <dd>
              {fmt.format(p.records.forecasts)} WINDFOR ·{" "}
              {fmt.format(p.records.actuals)} FUELHH WIND
            </dd>
          </div>
          <div>
            <dt>Snapshot SHA-256</dt>
            <dd className="mono hash">{p.snapshotSha256}</dd>
          </div>
        </dl>
        <p>
          <a
            href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream"
            target="_blank"
            rel="noreferrer"
          >
            WINDFOR documentation <ExternalLink size={12} aria-hidden="true" />
          </a>{" "}
          ·{" "}
          <a
            href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream"
            target="_blank"
            rel="noreferrer"
          >
            FUELHH documentation <ExternalLink size={12} aria-hidden="true" />
          </a>
        </p>
        <div
          className="table-scroll"
          tabIndex={0}
          aria-label="Scrollable retrieval records"
        >
          <table>
            <caption className="sr-only">Elexon retrieval receipts</caption>
            <thead>
              <tr>
                <th>Dataset / request</th>
                <th>Retrieved UTC</th>
                <th>Rows</th>
                <th>Response SHA-256</th>
              </tr>
            </thead>
            <tbody>
              {p.requests.map((r) => (
                <tr key={r.url}>
                  <td>
                    <a href={r.url} target="_blank" rel="noreferrer">
                      {r.dataset} ·{" "}
                      {new URL(r.url).searchParams
                        .get("publishDateTimeFrom")
                        ?.slice(0, 10) || "2 Jan – 1 Feb"}
                    </a>
                  </td>
                  <td className="mono">{stamp(r.retrievedAt)}</td>
                  <td>{fmt.format(r.records)}</td>
                  <td className="mono hash">{r.responseSha256}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="table-note">
          Contains BMRS data © Elexon Limited copyright and database right
          2026. Only operationally metered wind is represented; embedded
          unmetered wind is outside this pilot.
        </p>
      </div>
    </details>
  );
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [draft, setDraft] = useState({
    date: settings.date,
    cutoff: settings.cutoff,
  });
  const [validation, setValidation] = useState("");
  const dateRef = useRef<HTMLInputElement>(null);
  const [retry, setRetry] = useState(0);
  const [provenance, setProvenance] = useState<Provenance | null>(null);
  const [provenanceError, setProvenanceError] = useState("");
  const acceptDefault = useRef(
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(
      new URLSearchParams(location.search).get("cutoff") || "",
    ),
  );
  const [defaultReady, setDefaultReady] = useState(!acceptDefault.current);
  const result = useResults(settings, retry, defaultReady);
  const accuracy = settings.view === "accuracy";

  useEffect(() => {
    const controller = new AbortController();
    let expired = false;
    setProvenanceError("");
    const timer = setTimeout(() => {
      expired = true;
      controller.abort();
    }, 20000);
    get<Provenance>("/api/provenance", controller.signal)
      .then((p) => {
        setProvenance(p);
        setProvenanceError("");
        if (acceptDefault.current) {
          acceptDefault.current = false;
          setSettings((s) => ({ ...s, cutoff: p.defaultCutoff }));
          setDraft((d) => ({ ...d, cutoff: p.defaultCutoff }));
        }
        setDefaultReady(true);
      })
      .catch((e) => {
        if (!controller.signal.aborted || expired)
          setProvenanceError(
            expired
              ? "Provenance request timed out. Retry to load the configured default and source information."
              : e.message,
          );
      })
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [retry]);

  useEffect(() => {
    const p = new URLSearchParams(settings);
    if (!defaultReady) p.delete("cutoff");
    history.replaceState(null, "", `?${p}`);
    document.title = `Wind window · ${accuracy ? "Forecast accuracy" : "Day-ahead outlook"}`;
  }, [settings, accuracy, defaultReady]);

  const day = result.day;
  const month = result.month;
  const s = month?.summary || day?.summary;
  const publications = day
    ? day.intervals
        .map((r) => r.publishTime)
        .filter((r): r is string => Boolean(r))
        .sort()
    : [];
  const values =
    day?.intervals
      .map((r) => r.forecastMW)
      .filter((v): v is number => v !== null) || [];
  const peak = values.length ? Math.max(...values) : null;
  const low = values.length ? Math.min(...values) : null;
  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !/^2026-01-(0[1-9]|[12]\d|3[01])$/.test(draft.date) ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(draft.cutoff)
    ) {
      setValidation(
        "Choose a decision date from 1–31 January 2026 and a cutoff from 00:00–23:59.",
      );
      dateRef.current?.focus();
      return;
    }
    acceptDefault.current = false;
    setDefaultReady(true);
    setValidation("");
    setSettings((s) => ({ ...s, ...draft }));
  };
  const stepDate = (step: number) => {
    const date = new Date(`${settings.date}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + step);
    const next = date.toISOString().slice(0, 10);
    setDraft((d) => ({ ...d, date: next }));
    setSettings((s) => ({ ...s, date: next }));
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="rail">
        <a className="brand" href="?view=forecast">
          <span className="brand-icon">
            <Wind size={25} aria-hidden="true" />
          </span>
          <span>
            wind<span className="brand-light">window</span>
            <small>PROCUREMENT PILOT</small>
          </span>
        </a>
        <div className="rail-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          <button
            className={accuracy ? "" : "selected"}
            aria-pressed={!accuracy}
            onClick={() => setSettings((s) => ({ ...s, view: "forecast" }))}
          >
            <Wind aria-hidden="true" size={18} />
            Decision forecast
          </button>
          <button
            className={accuracy ? "selected" : ""}
            aria-pressed={accuracy}
            onClick={() => setSettings((s) => ({ ...s, view: "accuracy" }))}
          >
            <BarChart3 aria-hidden="true" size={18} />
            Forecast accuracy
          </button>
        </nav>
        <div className="rail-bottom">
          <span className="rail-dot" /> Elexon Insights
          <small>
            Great Britain · WIND only
            <br />
            January 2026 decisions
          </small>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            Wind generation /{" "}
            <strong>
              {accuracy ? "Accuracy review" : "Day-ahead outlook"}
            </strong>
          </span>
          <span className="snapshot-badge">
            <Database size={13} aria-hidden="true" />
            Historical snapshot
          </span>
        </header>
        <main id="main">
          <div className="page-heading">
            <div>
              <span className="eyebrow">GREAT BRITAIN · JANUARY 2026</span>
              <h1>
                {accuracy ? "Forecast accuracy" : "Next-day wind outlook"}
              </h1>
              <p>
                {accuracy
                  ? "Measure the error in what was known when the decision was made."
                  : "See the wind forecast available at your purchase decision time."}
              </p>
            </div>
            <span className="scope-label">Pilot / v1.0</span>
          </div>
          <form className="controls panel" onSubmit={apply} noValidate>
            <div className="field">
              <label htmlFor="date">Decision date</label>
              <input
                ref={dateRef}
                id="date"
                type="date"
                min="2026-01-01"
                max="2026-01-31"
                value={draft.date}
                aria-invalid={!!validation}
                aria-describedby="settings-help"
                onChange={(e) =>
                  setDraft((d) => ({ ...d, date: e.target.value }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="cutoff">Decision cutoff</label>
              <div className="time-field">
                <input
                  id="cutoff"
                  type="time"
                  value={draft.cutoff}
                  aria-invalid={!!validation}
                  aria-describedby="settings-help"
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, cutoff: e.target.value }))
                  }
                />
                <span>GMT</span>
              </div>
            </div>
            <button type="submit" className="button primary">
              Apply settings
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            {accuracy && (
              <div className="field period">
                <label htmlFor="period">Accuracy period</label>
                <select
                  id="period"
                  value={settings.period}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      period: e.target.value as "day" | "month",
                    }))
                  }
                >
                  <option value="day">Selected decision day</option>
                  <option value="month">All January decisions</option>
                </select>
              </div>
            )}
            <div
              id="settings-help"
              className={validation ? "settings-help invalid" : "settings-help"}
            >
              {validation ||
                (provenance
                  ? `Europe/London · default ${provenance.defaultCutoff} is an assumption, not a market deadline.`
                  : "Europe/London · loading the configured default cutoff. You can also select and apply an explicit cutoff.")}
            </div>
          </form>
          {provenanceError && (
            <p className="error-inline" role="alert">
              Provenance unavailable: {provenanceError}{" "}
              <button
                className="text-button"
                onClick={() => setRetry((r) => r + 1)}
              >
                Retry provenance
              </button>
            </p>
          )}
          {result.loading && !(provenanceError && !defaultReady) ? (
            <div className="state-panel panel" role="status">
              <LoaderCircle className="spinner" aria-hidden="true" />
              <h2>Loading decision-time data</h2>
              <p>Reading the persisted Elexon snapshot.</p>
            </div>
          ) : result.error || (provenanceError && !defaultReady) ? (
            <div className="state-panel panel" role="alert">
              <Info aria-hidden="true" />
              <h2>Data could not be loaded</h2>
              <p>{result.error || provenanceError}</p>
              <button className="button" onClick={() => setRetry((r) => r + 1)}>
                Retry
              </button>
            </div>
          ) : (
            day &&
            s && (
              <>
                <div className="decision-strip">
                  <div>
                    <Clock3 size={17} aria-hidden="true" />
                    <span>
                      Decision
                      <strong>
                        {longDate(day.decisionDate)} · {day.cutoff} GMT
                      </strong>
                    </span>
                  </div>
                  <ArrowRight
                    className="strip-arrow"
                    size={20}
                    aria-hidden="true"
                  />
                  <div>
                    <Wind size={18} aria-hidden="true" />
                    <span>
                      Next-day delivery
                      <strong>{longDate(day.deliveryDate)}</strong>
                    </span>
                  </div>
                  <div className="date-arrows">
                    <button
                      className="button icon-button"
                      type="button"
                      aria-label="Previous decision day"
                      disabled={settings.date === "2026-01-01"}
                      onClick={() => stepDate(-1)}
                    >
                      <ChevronLeft size={17} aria-hidden="true" />
                    </button>
                    <button
                      className="button icon-button"
                      type="button"
                      aria-label="Next decision day"
                      disabled={settings.date === "2026-01-31"}
                      onClick={() => stepDate(1)}
                    >
                      <ChevronRight size={17} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div className="metrics">
                  {accuracy ? (
                    <>
                      <Metric
                        label="Mean absolute error"
                        value={num(s.maeMW)}
                        unit="MW"
                        note="Typical absolute forecast miss"
                      />
                      <Metric
                        label="Root mean squared error"
                        value={num(s.rmseMW)}
                        unit="MW"
                        note="More weight on larger errors"
                      />
                      <Metric
                        label="Signed bias"
                        value={signed(s.biasMW)}
                        unit="MW"
                        note="Forecast − actual; positive = overforecast"
                      />
                      <Metric
                        label="Matched records"
                        value={`${fmt.format(s.matched)} / ${fmt.format(s.expected)}`}
                        note={`${num(s.coveragePercent)}% of expected half-hours`}
                      />
                    </>
                  ) : (
                    <>
                      <Metric
                        label="Forecast peak"
                        value={num(peak)}
                        unit="MW"
                        note="Maximum of available forecast points"
                      />
                      <Metric
                        label="Forecast low"
                        value={num(low)}
                        unit="MW"
                        note="Minimum of available forecast points"
                      />
                      <Metric
                        label="Forecast availability"
                        value={`${day.summary.forecastAvailable} of 48`}
                        note="Expected half-hour delivery timestamps"
                      />
                      <Metric
                        label="Latest publication used"
                        value={
                          publications.length
                            ? timeLabel(publications[publications.length - 1])
                            : "—"
                        }
                        unit="GMT"
                        note={
                          publications.length
                            ? stamp(
                                publications[publications.length - 1],
                              ).slice(0, 10)
                            : "No eligible publication"
                        }
                      />
                    </>
                  )}
                </div>
                <div className="content-grid">
                  <section className="panel plot-panel">
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">
                          {month
                            ? "ALL 31 JANUARY DECISIONS"
                            : "NEXT-DAY DELIVERY"}
                        </span>
                        <h2>
                          {month
                            ? "January error profile"
                            : `Wind generation · ${longDate(day.deliveryDate).replace(", 2026", "")}`}
                        </h2>
                      </div>
                      <span className="tag">MW</span>
                    </div>
                    <div className="legend">
                      <span>
                        <i className="forecast-dot" />
                        {month ? "Daily MAE" : "Decision forecast"}
                      </span>
                      {accuracy && (
                        <span>
                          <i className="actual-line" />
                          {month ? "Daily signed bias" : "Actual WIND"}
                        </span>
                      )}
                    </div>
                    {month ? (
                      <MonthlyChart month={month} />
                    ) : (
                      <GenerationChart day={day} accuracy={accuracy} />
                    )}
                    <div className="chart-footnote">
                      <Info size={15} aria-hidden="true" />
                      <span>
                        {month
                          ? "Pooled metrics use all valid pairs, not an average of daily metrics. Delivery extends through 1 February."
                          : "Forecast dots are hourly in this snapshot. Half-hour gaps stay empty; no interpolation. All times GMT."}
                      </span>
                    </div>
                  </section>
                  <div className="side-stack">
                    {accuracy ? (
                      <Coverage summary={s} />
                    ) : (
                      <section className="panel publication-panel">
                        <span className="eyebrow">PUBLICATION CHECK</span>
                        <h2>Known at the decision</h2>
                        <div className="publication-check">
                          <Check size={19} aria-hidden="true" />
                          <span>
                            Published on or before
                            <br />
                            <strong>{stamp(day.decisionTime)} GMT</strong>
                          </span>
                        </div>
                        <dl>
                          <div>
                            <dt>Earliest publication used</dt>
                            <dd className="mono">
                              {stamp(publications[0] || null)}
                            </dd>
                          </div>
                          <div>
                            <dt>Latest publication used</dt>
                            <dd className="mono">
                              {stamp(
                                publications[publications.length - 1] || null,
                              )}
                            </dd>
                          </div>
                        </dl>
                        <p>
                          The latest eligible publication is selected separately
                          for each delivery timestamp.
                        </p>
                      </section>
                    )}
                    <div className="note-card">
                      <Info size={17} aria-hidden="true" />
                      <div>
                        <strong>Read the gaps</strong>
                        <p>
                          The January snapshot supplies hourly forecasts and
                          half-hourly actuals. The :30 targets have no forecast.
                          Earlier cutoffs can also lack later delivery targets.
                          Missing values are never treated as zero.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                {accuracy && (
                  <section className="panel interpretation">
                    <span className="eyebrow">PROCUREMENT CONTEXT</span>
                    <h2>What does this mean for the decision?</h2>
                    {s.matched ? (
                      <p>
                        At this cutoff, wind was{" "}
                        {s.biasMW! > 0
                          ? "overforecast"
                          : s.biasMW! < 0
                            ? "underforecast"
                            : "unbiased on average"}{" "}
                        by <strong>{num(Math.abs(s.biasMW!))} MW</strong> on
                        average across {fmt.format(s.matched)} matched records.{" "}
                        {s.biasMW! > 0
                          ? "If demand were fixed, relying on this forecast alone could understate the need for other supply."
                          : s.biasMW! < 0
                            ? "If demand were fixed, relying on this forecast alone could overstate the need for other supply."
                            : "Errors in either direction can still be substantial."}{" "}
                        MAE describes the typical miss; a larger RMSE highlights
                        larger misses. These are historical descriptive errors,
                        not a procurement safety margin.
                      </p>
                    ) : (
                      <p>
                        No valid matched records are available for these
                        settings.
                      </p>
                    )}
                    <p>
                      Both series refer to operationally metered wind in MW.
                      WINDFOR is time-indexed; FUELHH is a half-hour mean. These
                      are indicative timestamp comparisons, not hourly-average
                      errors. Coverage and timestamp resolution limit the
                      comparison. National generation is not this utility’s
                      contracted wind; demand and portfolio data would be needed
                      to calculate purchase quantities.
                    </p>
                  </section>
                )}
                {month && (
                  <details className="panel disclosure">
                    <summary>Daily accuracy data</summary>
                    <div
                      className="table-scroll"
                      tabIndex={0}
                      aria-label="Scrollable daily metrics"
                    >
                      <table>
                        <caption className="sr-only">
                          January decision-date metrics in MW
                        </caption>
                        <thead>
                          <tr>
                            <th>Decision</th>
                            <th>Delivery</th>
                            <th>MAE · MW</th>
                            <th>RMSE · MW</th>
                            <th>Bias · MW</th>
                            <th>Matches / expected</th>
                          </tr>
                        </thead>
                        <tbody>
                          {month.days.map((d) => (
                            <tr key={d.decisionDate}>
                              <td>{d.decisionDate}</td>
                              <td>{d.deliveryDate}</td>
                              <td>{num(d.summary.maeMW)}</td>
                              <td>{num(d.summary.rmseMW)}</td>
                              <td>{signed(d.summary.biasMW)}</td>
                              <td>
                                {d.summary.matched} / {d.summary.expected}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}
                <IntervalTable rows={day.intervals} />
                <details className="panel disclosure">
                  <summary>Selection diagnostics for the selected day</summary>
                  <p className="table-note">
                    Equal duplicates collapse. Conflicting values at the latest
                    timestamp are excluded. Invalid timestamp counts refer to
                    rows inspected across the snapshot. Off-grid counts cover
                    this delivery day; duplicate counts cover eligible records
                    for this day.
                  </p>
                  <dl className="diagnostics">
                    {Object.entries(day.diagnostics).map(([key, value]) => (
                      <div key={key}>
                        <dt>{key.replace(/([A-Z])/g, " $1")}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              </>
            )
          )}
          <ProvenancePanel provenance={provenance} />
          <footer>
            <span>Wind window · historical decision support</span>
            <span>Elexon only · no demand or purchase quantities</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
