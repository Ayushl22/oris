export type Summary = {
  expected: number;
  matched: number;
  unmatched: number;
  coveragePercent: number;
  maeMW: number | null;
  rmseMW: number | null;
  biasMW: number | null;
  missingForecast: number;
  missingActual: number;
  forecastInvalid: number;
  actualInvalid: number;
  forecastConflicts: number;
  actualConflicts: number;
  forecastAvailable: number;
  actualAvailable: number;
};
export type Interval = {
  startTime: string;
  forecastMW: number | null;
  actualMW: number | null;
  publishTime: string | null;
  actualPublishTime: string | null;
  errorMW: number | null;
  forecastStatus: string;
  actualStatus: string;
};
export type Day = {
  decisionDate: string;
  deliveryDate: string;
  decisionTime: string;
  cutoff: string;
  intervals: Interval[];
  summary: Summary;
  diagnostics: Record<string, number>;
};
export type Month = { summary: Summary; days: Omit<Day, "intervals">[] };
export type Provenance = {
  retrievedAt: string;
  defaultCutoff: string;
  snapshotSha256: string;
  records: { forecasts: number; actuals: number };
  requests: {
    dataset: string;
    url: string;
    records: number;
    retrievedAt: string;
    responseSha256: string;
  }[];
};
export type Settings = {
  date: string;
  cutoff: string;
  view: "forecast" | "accuracy";
  period: "day" | "month";
};

export async function get<T>(path: string, signal: AbortSignal): Promise<T> {
  const base = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  const response = await fetch(base + path, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      typeof body?.detail === "string"
        ? body.detail
        : `Data request failed (${response.status}). Check settings or retry.`,
    );
  }
  return response.json();
}

export function initialSettings(): Settings {
  const p = new URLSearchParams(location.search);
  const date = p.get("date") || "2026-01-15";
  const cutoff = p.get("cutoff") || "10:00";
  return {
    date: /^2026-01-(0[1-9]|[12]\d|3[01])$/.test(date) ? date : "2026-01-15",
    cutoff: /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(cutoff) ? cutoff : "10:00",
    view: p.get("view") === "accuracy" ? "accuracy" : "forecast",
    period: p.get("period") === "month" ? "month" : "day",
  };
}
