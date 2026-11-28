import { groupCandidates, type FoundAd } from "../discovery.ts";
import type { Ad, Offer, Rules } from "../offermind.ts";
import { runCollection } from "./collector.ts";
import type { AdProvider, AdType, Coverage, SortBy } from "./types.ts";

/** Perfil de busca pedido para o feed: igual ao link da Biblioteca de Anúncios. */
export const HUNT_PROFILE: { adType: AdType; sortBy: SortBy; label: string } = {
  adType: "political_and_issue_ads",
  sortBy: "impressions_high_to_low",
  label: "Anúncios políticos e de questões sociais",
};

export type HuntRequest = {
  country: string;
  adType: AdType;
  sortBy: SortBy;
  keyword: string;
};

export type HuntStatus = "ok" | "not_configured" | "rate_limited" | "failed";

export type HuntResponse = {
  status: HuntStatus;
  ads: FoundAd[];
  coverage: Coverage | null;
  calls: number;
  /** Linhas descartadas pelo leitor: sem ID, inativas ou sem data válida. */
  skipped: number;
  error: string | null;
  cached: boolean;
  fetchedAt: string | null;
  retryAfterSec: number | null;
};

type Options = {
  /** null quando o servidor não tem credencial do fornecedor. */
  provider: AdProvider | null;
  ttlMs?: number;
  failureTtlMs?: number;
  /** Teto de chamadas ao fornecedor por hora, somando todos os visitantes. */
  maxCallsPerHour?: number;
  pages?: number;
  maxAds?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

const HOUR = 3600000;

const idle = (over: Partial<HuntResponse>): HuntResponse => ({
  status: "failed",
  ads: [],
  coverage: null,
  calls: 0,
  skipped: 0,
  error: null,
  cached: false,
  fetchedAt: null,
  retryAfterSec: null,
  ...over,
});

const cacheKey = (r: HuntRequest) =>
  [r.country.toUpperCase(), r.adType, r.sortBy, r.keyword.trim().toLowerCase()].join("|");

/**
 * Busca em tempo real para o feed. Usa a credencial central do servidor, guarda
 * resultados em cache e limita o consumo. Os limites vivem na memória do processo:
 * valem por instância do servidor e não substituem um limite no próprio fornecedor.
 */
export function createHunter(options: Options) {
  const ttlMs = options.ttlMs ?? 30 * 60000;
  const failureTtlMs = options.failureTtlMs ?? 60000;
  const maxCallsPerHour = options.maxCallsPerHour ?? 60;
  const pages = options.pages ?? 2;
  const maxAds = options.maxAds ?? 200;
  const now = options.now ?? Date.now;
  const cache = new Map<string, { at: number; ttl: number; value: HuntResponse }>();
  const inflight = new Map<string, Promise<HuntResponse>>();
  const spent: { at: number; calls: number }[] = [];

  const used = () => {
    const cutoff = now() - HOUR;
    while (spent.length && spent[0]!.at <= cutoff) spent.shift();
    return spent.reduce((total, entry) => total + entry.calls, 0);
  };

  async function execute(request: HuntRequest): Promise<HuntResponse> {
    const { provider } = options;
    if (!provider) {
      return idle({
        status: "not_configured",
        error: "A chave do fornecedor de anúncios não está configurada no servidor.",
      });
    }
    const remaining = maxCallsPerHour - used();
    if (remaining <= 0) {
      const oldest = spent[0]?.at ?? now();
      return idle({
        status: "rate_limited",
        error: "O limite de consultas por hora do servidor foi atingido.",
        retryAfterSec: Math.max(1, Math.ceil((oldest + HOUR - now()) / 1000)),
      });
    }
    const run = await runCollection({
      provider,
      country: request.country,
      plan: {
        terms: [{ niche: HUNT_PROFILE.label, keyword: request.keyword.trim() }],
        discoverPages: pages,
        deepenTop: 0,
        deepenPages: 0,
        adType: request.adType,
        sortBy: request.sortBy,
      },
      // Inclui retentativas. Nunca ultrapassa o que resta do orçamento horário.
      maxCalls: Math.min(remaining, pages + 2),
      ...(options.sleep ? { sleep: options.sleep } : {}),
    });
    spent.push({ at: now(), calls: run.calls });
    const skipped = run.queries.reduce((total, q) => total + q.skipped, 0);
    const fetchedAt = new Date(now()).toISOString();
    if (run.coverage === "failed") {
      return idle({
        status: "failed",
        coverage: "failed",
        calls: run.calls,
        skipped,
        error: run.errors[0]?.message ?? "A consulta não obteve resposta do fornecedor.",
        fetchedAt,
      });
    }
    return {
      status: "ok",
      ads: run.ads.slice(0, maxAds),
      coverage: run.coverage,
      calls: run.calls,
      skipped,
      error: run.errors[0]?.message ?? null,
      cached: false,
      fetchedAt,
      retryAfterSec: null,
    };
  }

  return {
    callsUsedLastHour: used,
    async hunt(request: HuntRequest): Promise<HuntResponse> {
      const key = cacheKey(request);
      const hit = cache.get(key);
      if (hit && now() - hit.at < hit.ttl) return { ...hit.value, cached: true };
      // Visitantes simultâneos com a mesma busca compartilham uma única consulta.
      const running = inflight.get(key);
      if (running) return running;
      const task = execute(request)
        .then((value) => {
          if (value.status === "ok") cache.set(key, { at: now(), ttl: ttlMs, value });
          else if (value.status === "failed")
            cache.set(key, { at: now(), ttl: failureTtlMs, value });
          return value;
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, task);
      return task;
    },
  };
}

export type Hunter = ReturnType<typeof createHunter>;

// Hash não criptográfico (cyrb53) só para gerar IDs estáveis.
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

const MAX_ENTRIES = 60;

/**
 * Converte anúncios encontrados em entradas do feed. Anúncios sem um destino único
 * não podem ser agrupados com segurança e ficam de fora; a quantidade é devolvida
 * para a interface informar.
 */
export function entriesFromHunt(ads: FoundAd[], rules: Rules, niche: string, request: HuntRequest) {
  const groups = groupCandidates(ads, rules).slice(0, MAX_ENTRIES);
  const entries: { offer: Offer; ads: Ad[] }[] = [];
  let grouped = 0;
  for (const c of groups) {
    const first = c.ads[0];
    if (!first) continue;
    const id = "hunt:" + rules.country + ":" + hash(c.key);
    grouped += c.ads.length;
    entries.push({
      offer: {
        id,
        name: c.title.slice(0, 140),
        advertiser: c.advertiser,
        niche,
        country: rules.country,
        promise: first.body.slice(0, 350),
        url: c.destination,
        pageTotal: null,
        favorite: false,
        monitored: false,
        notes:
          "Busca automática (" +
          request.adType +
          ", ordenada por " +
          request.sortBy +
          "). Agrupamento candidato por anunciante e destino; não é prova de oferta nem de produto.",
        stage: "Investigação",
      },
      ads: c.ads.map((a) => ({
        id: a.id,
        offerId: id,
        country: a.country,
        status: "active" as const,
        start: a.start,
        observed: a.observed,
        source: "https://www.facebook.com/ads/library/?id=" + a.id,
        headline: (a.title || a.body.slice(0, 200)).slice(0, 180),
        concept: "",
        reviewed: false,
        format: a.format,
        thumbnail: a.thumbnail || "",
        video: a.video || "",
        platforms: a.platforms || [],
      })),
    });
  }
  return { entries, ungrouped: Math.max(0, ads.length - grouped) };
}
