import type { FoundAd, SearchPage } from "../discovery.ts";
import { ProviderError } from "./errors.ts";
import type {
  AdProvider,
  CollectionPlan,
  QueryLog,
  RunError,
  RunResult,
  SearchQuery,
} from "./types.ts";

type Options = {
  provider: AdProvider;
  country: string;
  plan: CollectionPlan;
  /** Teto de chamadas HTTP, contando retentativas. Nunca é ultrapassado. */
  maxCalls: number;
  /** Tentativas extras por requisição em erros temporários. */
  retries?: number;
  baseDelayMs?: number;
  /** Requisições seguidas que falharam de vez antes de abortar a rodada. */
  maxConsecutiveFailures?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function runCollection(options: Options): Promise<RunResult> {
  const { provider, country, plan, maxCalls } = options;
  const retries = options.retries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 1000;
  const maxFailures = options.maxConsecutiveFailures ?? 3;
  const sleep = options.sleep ?? wait;
  const now = options.now ?? (() => new Date());

  const startedAt = now().toISOString();
  const ads = new Map<string, FoundAd>();
  const advertisers = new Map<string, Set<string>>();
  const nicheByPage: Record<string, string> = {};
  const queries: QueryLog[] = [];
  const errors: RunError[] = [];
  let calls = 0;
  let successes = 0;
  let consecutiveFailures = 0;
  let deepenSkipped = false;
  let stoppedBy: RunResult["stoppedBy"] = null;

  const halted = () => stoppedBy === "auth" || stoppedBy === "failures";

  /** Uma requisição com retentativas. Retorna null se falhou ou faltou orçamento. */
  async function request(query: SearchQuery, log: QueryLog): Promise<SearchPage | null> {
    const fail = (error: ProviderError) => {
      log.error = error.message;
      errors.push({
        kind: error.kind,
        message: error.message,
        keyword: query.keyword ?? null,
        pageId: query.pageId ?? null,
      });
      consecutiveFailures++;
      if (!halted() && consecutiveFailures >= maxFailures) stoppedBy = "failures";
    };
    let last: ProviderError | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (calls >= maxCalls) {
        stoppedBy = stoppedBy ?? "budget";
        // O orçamento acabou no meio das retentativas: não perder o erro anterior.
        if (last) fail(last);
        return null;
      }
      calls++;
      log.attempts++;
      try {
        const page = await provider.search(query);
        successes++;
        consecutiveFailures = 0;
        return page;
      } catch (cause) {
        last =
          cause instanceof ProviderError
            ? cause
            : new ProviderError("network", "Falha inesperada ao consultar o provedor.");
        if (last.kind === "auth") stoppedBy = "auth";
        if (!last.retryable || attempt === retries) {
          fail(last);
          return null;
        }
        await sleep(baseDelayMs * 2 ** attempt);
      }
    }
    return null;
  }

  async function paginate(
    base: Omit<SearchQuery, "cursor">,
    maxPages: number,
    log: QueryLog,
    onAd: (ad: FoundAd) => void,
  ) {
    let cursor = "";
    for (let i = 0; i < maxPages; i++) {
      const page = await request({ ...base, cursor }, log);
      if (!page) {
        log.truncated = true;
        return;
      }
      log.pages++;
      log.adsReturned += page.ads.length;
      log.skipped += page.skipped;
      log.totalReported = page.total ?? log.totalReported;
      for (const ad of page.ads) {
        const key = ad.country + "|" + ad.id;
        if (!ads.has(key)) ads.set(key, ad);
        onAd(ad);
      }
      if (!page.next) return;
      // Proteção contra provedor que devolve o mesmo cursor para sempre.
      if (page.next === cursor) {
        log.truncated = true;
        return;
      }
      cursor = page.next;
    }
    // Esgotou o limite de páginas com cursor ainda disponível.
    log.truncated = cursor !== "";
  }

  const newLog = (
    phase: QueryLog["phase"],
    niche: string,
    keyword: string | null,
    pageId: string | null,
  ): QueryLog => {
    const log: QueryLog = {
      phase,
      niche,
      keyword,
      pageId,
      attempts: 0,
      pages: 0,
      adsReturned: 0,
      skipped: 0,
      totalReported: null,
      truncated: false,
      error: null,
    };
    queries.push(log);
    return log;
  };

  // Fase 1: descoberta por palavra-chave.
  for (const term of plan.terms) {
    if (halted() || stoppedBy === "budget") break;
    const log = newLog("discover", term.niche, term.keyword, null);
    await paginate(
      {
        country,
        keyword: term.keyword,
        startDate: plan.window?.start,
        endDate: plan.window?.end,
      },
      plan.discoverPages,
      log,
      (ad) => {
        if (!ad.destination) return;
        const seen = advertisers.get(ad.pageId) ?? new Set<string>();
        seen.add(ad.id);
        advertisers.set(ad.pageId, seen);
        nicheByPage[ad.pageId] ??= term.niche;
      },
    );
  }

  // Fase 2: aprofundar os anunciantes com mais anúncios observados.
  const ranked = [...advertisers]
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
    .slice(0, plan.deepenTop);
  if (advertisers.size > ranked.length) deepenSkipped = true;
  for (const [pageId] of ranked) {
    if (halted()) break;
    if (calls >= maxCalls) {
      stoppedBy = stoppedBy ?? "budget";
      break;
    }
    const log = newLog("deepen", nicheByPage[pageId] ?? "", null, pageId);
    await paginate({ country, pageId }, plan.deepenPages, log, () => {});
  }

  const incomplete =
    errors.length > 0 || stoppedBy !== null || deepenSkipped || queries.some((q) => q.truncated);
  return {
    provider: provider.id,
    country,
    startedAt,
    finishedAt: now().toISOString(),
    calls,
    maxCalls,
    ads: [...ads.values()],
    nicheByPage,
    queries,
    errors,
    advertisersSeen: advertisers.size,
    coverage: successes === 0 ? "failed" : incomplete ? "partial" : "complete",
    stoppedBy,
  };
}
