import { groupCandidates } from "../discovery.ts";
import { mergeAds, type Ad, type Offer, type Rules } from "../offermind.ts";
import { daysAgo } from "./plan.ts";
import type { QueryLog, RunError, RunResult } from "./types.ts";

export type CatalogCoverage = "not_configured" | "complete" | "partial" | "failed";

export type CatalogRun = {
  provider: string;
  startedAt: string;
  finishedAt: string;
  calls: number;
  maxCalls: number;
  coverage: RunResult["coverage"];
  stoppedBy: RunResult["stoppedBy"];
  advertisersSeen: number;
  queries: QueryLog[];
  errors: RunError[];
};

export type Catalog = {
  version: 1;
  /** Data da última coleta que gravou dados. Não muda quando uma coleta falha. */
  generatedAt: string | null;
  provider: string;
  coverage: CatalogCoverage;
  calls: number;
  offers: Offer[];
  ads: Ad[];
  matched: number;
  terms: string[];
  /** Última tentativa de coleta, bem-sucedida ou não. */
  lastAttempt?: string | null;
  lastError?: string | null;
  run?: CatalogRun | null;
};

export const emptyCatalog = (): Catalog => ({
  version: 1,
  generatedAt: null,
  provider: "SearchAPI",
  coverage: "not_configured",
  calls: 0,
  offers: [],
  ads: [],
  matched: 0,
  terms: [],
  lastAttempt: null,
  lastError: null,
  run: null,
});

export function parseCatalog(value: unknown): Catalog | null {
  if (!value || typeof value !== "object") return null;
  const c = value as Partial<Catalog>;
  if (c.version !== 1 || !Array.isArray(c.offers) || !Array.isArray(c.ads)) return null;
  return { ...emptyCatalog(), ...c } as Catalog;
}

// Hash não criptográfico (cyrb53) só para gerar IDs estáveis, sem depender de node:crypto.
function hash(input: string) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

const MAX_OFFERS_PER_RUN = 60;

export function offersFromRun(run: RunResult, rules: Rules) {
  const groups = groupCandidates(run.ads, rules)
    .filter((c) => c.windowAds.length >= 1)
    .slice(0, MAX_OFFERS_PER_RUN);
  const offers: Offer[] = [];
  const ads: Ad[] = [];
  for (const c of groups) {
    const first = c.ads[0];
    if (!first) continue;
    const id = "catalog:" + hash(run.country + "|" + c.key);
    offers.push({
      id,
      name: c.title.slice(0, 140),
      advertiser: c.advertiser,
      niche: run.nicheByPage[first.pageId] || "Produtos digitais (candidato)",
      country: run.country,
      promise: first.body.slice(0, 350),
      url: c.destination,
      pageTotal: null,
      favorite: false,
      monitored: false,
      notes:
        "Catálogo automático. Associação candidata por anunciante e destino. Nicho sugerido pela pesquisa; conceitos visuais não verificados.",
      stage: "Investigação",
    });
    for (const a of c.ads) {
      ads.push({
        id: a.id,
        offerId: id,
        country: run.country,
        status: "active",
        start: a.start,
        observed: a.observed,
        source: "https://www.facebook.com/ads/library/?id=" + a.id,
        headline: a.title.slice(0, 180),
        concept: "",
        reviewed: false,
        format: a.format,
        thumbnail: a.thumbnail || "",
        video: a.video || "",
        platforms: a.platforms || [],
      });
    }
  }
  return {
    offers,
    ads,
    matched: groups.filter((c) => c.meetsVolume && c.meetsWindow).length,
  };
}

type MergeOptions = {
  rules: Rules;
  today: string;
  /** Observações mais antigas que isso saem do catálogo (política de retenção). */
  retentionDays: number;
  maxAds: number;
  terms: string[];
};

const LABELS: Record<string, string> = { searchapi: "SearchAPI" };

/**
 * Incorpora o resultado de uma coleta ao catálogo anterior.
 * - Falha total: nada é apagado; a falha fica registrada no catálogo.
 * - Sucesso: ofertas e observações anteriores continuam, mesmo ausentes da amostra
 *   atual, até saírem da janela de retenção.
 */
export function mergeCatalog(previous: Catalog, run: RunResult, options: MergeOptions): Catalog {
  const summary: CatalogRun = {
    provider: run.provider,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    calls: run.calls,
    maxCalls: run.maxCalls,
    coverage: run.coverage,
    stoppedBy: run.stoppedBy,
    advertisersSeen: run.advertisersSeen,
    queries: run.queries,
    errors: run.errors,
  };
  const lastError = run.errors[0]?.message ?? null;

  if (run.coverage === "failed") {
    return {
      ...previous,
      coverage: "failed",
      lastAttempt: run.finishedAt,
      lastError: lastError ?? "A coleta não obteve resposta do provedor.",
      run: summary,
    };
  }

  const fresh = offersFromRun(run, options.rules);
  const cutoff = daysAgo(options.today, options.retentionDays);
  let ads = mergeAds(previous.ads, fresh.ads).filter((a) => a.observed >= cutoff);
  if (ads.length > options.maxAds) {
    ads = [...ads].sort((a, b) => b.observed.localeCompare(a.observed)).slice(0, options.maxAds);
  }
  const alive = new Set(ads.map((a) => a.offerId));
  const offers = new Map(previous.offers.map((o) => [o.id, o]));
  for (const offer of fresh.offers) offers.set(offer.id, offer);

  return {
    version: 1,
    generatedAt: run.finishedAt,
    provider: LABELS[run.provider] ?? run.provider,
    coverage: run.coverage,
    calls: run.calls,
    offers: [...offers.values()].filter((o) => alive.has(o.id)),
    ads,
    matched: fresh.matched,
    terms: options.terms,
    lastAttempt: run.finishedAt,
    lastError,
    run: summary,
  };
}
