import { describe, expect, it, vi } from "vitest";
import type { FoundAd, SearchPage } from "../discovery";
import { runCollection } from "./collector";
import { ProviderError } from "./errors";
import type { AdProvider, CollectionPlan, SearchQuery } from "./types";

// Dados SINTÉTICOS de teste. Nunca são exibidos no produto.
const found = (id: string, pageId: string): FoundAd => ({
  id,
  pageId,
  advertiser: "Anunciante " + pageId,
  destination: "https://example.com/" + pageId,
  title: "Título " + id,
  body: "Texto",
  start: "2026-10-20",
  observed: "2026-11-25",
  country: "US",
  format: "IMAGE",
});
const page = (ads: FoundAd[], next = ""): SearchPage => ({
  ads,
  next,
  total: ads.length,
  observed: "2026-11-25",
  skipped: 0,
});
const provider = (handler: (q: SearchQuery) => SearchPage | Promise<SearchPage>) => {
  const search = vi.fn(async (q: SearchQuery) => handler(q));
  return { provider: { id: "fake", label: "Fake", search } as AdProvider, search };
};
const plan = (over: Partial<CollectionPlan> = {}): CollectionPlan => ({
  terms: [{ niche: "Pets", keyword: "dog" }],
  discoverPages: 2,
  deepenTop: 2,
  deepenPages: 2,
  ...over,
});
const base = { country: "US", sleep: async () => {}, now: () => new Date("2026-11-25T12:00:00Z") };

describe("runCollection", () => {
  it("descobre por palavra-chave e aprofunda os anunciantes com mais anúncios", async () => {
    const { provider: p, search } = provider((q) => {
      if (q.pageId === "A") return page([found("a1", "A"), found("a2", "A"), found("a9", "A")]);
      if (q.pageId === "B") return page([found("b1", "B")]);
      if (q.cursor === "c2") return page([found("a2", "A")]);
      return page([found("a1", "A"), found("b1", "B")], "c2");
    });
    const run = await runCollection({ ...base, provider: p, plan: plan(), maxCalls: 10 });
    expect(search).toHaveBeenCalledTimes(4);
    expect(run.calls).toBe(4);
    expect(run.queries.map((q) => q.phase)).toEqual(["discover", "deepen", "deepen"]);
    expect(run.queries[1]?.pageId).toBe("A");
    // a1, a2, a9, b1: o mesmo anúncio visto em consultas diferentes conta uma vez
    expect(run.ads.map((a) => a.id).sort()).toEqual(["a1", "a2", "a9", "b1"]);
    expect(run.advertisersSeen).toBe(2);
    expect(run.nicheByPage).toEqual({ A: "Pets", B: "Pets" });
    expect(run.coverage).toBe("complete");
    expect(run.stoppedBy).toBeNull();
  });

  it("nunca ultrapassa o orçamento de chamadas e marca cobertura parcial", async () => {
    const { provider: p, search } = provider((q) =>
      page([found(q.cursor || "x1", "A")], q.cursor ? "" : "c2"),
    );
    const run = await runCollection({ ...base, provider: p, plan: plan(), maxCalls: 2 });
    expect(search.mock.calls.length).toBeLessThanOrEqual(2);
    expect(run.calls).toBe(2);
    expect(run.stoppedBy).toBe("budget");
    expect(run.coverage).toBe("partial");
  });

  it("repete erro temporário com backoff exponencial e conta cada tentativa", async () => {
    let n = 0;
    const sleep = vi.fn(async (_ms: number) => {});
    const { provider: p } = provider(() => {
      if (n++ === 0) throw new ProviderError("rate_limit", "Limite do provedor atingido.", 429);
      return page([found("a1", "A")]);
    });
    const run = await runCollection({
      ...base,
      sleep,
      provider: p,
      plan: plan({ discoverPages: 1, deepenTop: 0 }),
      maxCalls: 10,
    });
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(run.calls).toBe(2);
    expect(run.queries[0]?.attempts).toBe(2);
    expect(run.errors).toEqual([]);
    expect(run.ads).toHaveLength(1);
  });

  it("registra o erro quando as retentativas se esgotam", async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    const { provider: p } = provider(() => {
      throw new ProviderError("server", "O provedor retornou erro HTTP 500.", 500);
    });
    const run = await runCollection({ ...base, sleep, provider: p, plan: plan(), maxCalls: 10 });
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000]);
    expect(run.calls).toBe(3);
    expect(run.errors).toHaveLength(1);
    expect(run.errors[0]?.kind).toBe("server");
    expect(run.coverage).toBe("failed");
  });

  it("não perde o erro quando o orçamento acaba durante as retentativas", async () => {
    const { provider: p } = provider(() => {
      throw new ProviderError("rate_limit", "Limite do provedor atingido.", 429);
    });
    const run = await runCollection({ ...base, provider: p, plan: plan(), maxCalls: 2 });
    expect(run.calls).toBe(2);
    expect(run.stoppedBy).toBe("budget");
    expect(run.errors.map((e) => e.kind)).toEqual(["rate_limit"]);
  });

  it("credencial inválida interrompe a rodada na primeira chamada", async () => {
    const { provider: p, search } = provider(() => {
      throw new ProviderError("auth", "Chave inválida ou sem permissão.", 401);
    });
    const run = await runCollection({
      ...base,
      provider: p,
      plan: plan({
        terms: [
          { niche: "Pets", keyword: "dog" },
          { niche: "Hobbies", keyword: "knit" },
        ],
      }),
      maxCalls: 10,
    });
    expect(search).toHaveBeenCalledTimes(1);
    expect(run.stoppedBy).toBe("auth");
    expect(run.coverage).toBe("failed");
    expect(run.errors[0]?.kind).toBe("auth");
  });

  it("aborta depois de falhas seguidas, sem gastar o orçamento inteiro", async () => {
    const { provider: p, search } = provider(() => {
      throw new ProviderError("request", "O provedor recusou a consulta (HTTP 400).", 400);
    });
    const terms = ["a", "b", "c", "d", "e"].map((keyword) => ({ niche: "N", keyword }));
    const run = await runCollection({ ...base, provider: p, plan: plan({ terms }), maxCalls: 50 });
    expect(search).toHaveBeenCalledTimes(3);
    expect(run.stoppedBy).toBe("failures");
    expect(run.coverage).toBe("failed");
  });

  it("marca resultados não lidos como truncados e a cobertura como parcial", async () => {
    const { provider: p } = provider(() => page([found("a1", "A")], "mais"));
    const run = await runCollection({
      ...base,
      provider: p,
      plan: plan({ discoverPages: 1, deepenTop: 0 }),
      maxCalls: 10,
    });
    expect(run.queries[0]?.truncated).toBe(true);
    expect(run.coverage).toBe("partial");
  });

  it("não entra em laço quando o provedor repete o mesmo cursor", async () => {
    const { provider: p, search } = provider(() => page([found("a1", "A")], "igual"));
    const run = await runCollection({
      ...base,
      provider: p,
      plan: plan({ discoverPages: 10, deepenTop: 0 }),
      maxCalls: 50,
    });
    expect(search).toHaveBeenCalledTimes(2);
    expect(run.queries[0]?.truncated).toBe(true);
    expect(run.coverage).toBe("partial");
  });

  it("anunciantes além do limite de aprofundamento tornam a cobertura parcial", async () => {
    const { provider: p } = provider((q) =>
      q.pageId ? page([found("x", q.pageId)]) : page([found("a1", "A"), found("b1", "B")]),
    );
    const run = await runCollection({
      ...base,
      provider: p,
      plan: plan({ discoverPages: 1, deepenTop: 1 }),
      maxCalls: 10,
    });
    expect(run.queries.filter((q) => q.phase === "deepen")).toHaveLength(1);
    expect(run.coverage).toBe("partial");
  });
});
