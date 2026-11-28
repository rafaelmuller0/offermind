import { describe, expect, it } from "vitest";
import type { FoundAd } from "../discovery";
import { defaults } from "../offermind";
import { emptyCatalog, mergeCatalog, offersFromRun, parseCatalog, type Catalog } from "./catalog";
import { buildPlan, TERMS } from "./plan";
import type { RunResult } from "./types";

// Dados SINTÉTICOS de teste. Nunca são exibidos no produto.
const ad = (id: string, pageId = "A", destination = "https://example.com/a"): FoundAd => ({
  id,
  pageId,
  advertiser: "Anunciante " + pageId,
  destination,
  title: "Título " + id,
  body: "Texto " + id,
  start: "2026-10-30",
  observed: "2026-11-25",
  country: "US",
  format: "IMAGE",
  thumbnail: "https://scontent.xx.fbcdn.net/v/t/" + id + ".jpg",
});
const run = (over: Partial<RunResult> = {}): RunResult => ({
  provider: "searchapi",
  country: "US",
  startedAt: "2026-11-25T06:00:00.000Z",
  finishedAt: "2026-11-25T06:01:00.000Z",
  calls: 6,
  maxCalls: 18,
  ads: ["1", "2", "3", "4", "5"].map((id) => ad(id)),
  nicheByPage: { A: "Pets" },
  queries: [],
  errors: [],
  advertisersSeen: 1,
  coverage: "partial",
  stoppedBy: null,
  ...over,
});
const options = {
  rules: defaults,
  today: "2026-11-25",
  retentionDays: 30,
  maxAds: 1000,
  terms: ["dog training plan"],
};

describe("offersFromRun", () => {
  it("agrupa por anunciante e destino, gera ID estável e aponta para o anúncio original", () => {
    const first = offersFromRun(run(), defaults);
    const second = offersFromRun(run(), defaults);
    expect(first.offers).toHaveLength(1);
    expect(first.offers[0]?.id).toMatch(/^catalog:[0-9a-f]{14}$/);
    expect(first.offers[0]?.id).toBe(second.offers[0]?.id);
    expect(first.offers[0]?.niche).toBe("Pets");
    expect(first.ads).toHaveLength(5);
    expect(first.ads[0]?.source).toBe("https://www.facebook.com/ads/library/?id=1");
    expect(first.ads[0]?.thumbnail).toContain("fbcdn.net");
    expect(first.ads.every((a) => a.reviewed === false && a.concept === "")).toBe(true);
  });

  it("não declara critérios atendidos sem volume suficiente", () => {
    expect(offersFromRun(run(), defaults).matched).toBe(0);
    expect(offersFromRun(run(), { ...defaults, minAds: 5, minWindow: 5 }).matched).toBe(1);
  });

  it("separa produtos diferentes do mesmo anunciante", () => {
    const ads = [ad("1", "A", "https://example.com/x"), ad("2", "A", "https://example.com/y")];
    expect(offersFromRun(run({ ads }), defaults).offers).toHaveLength(2);
  });
});

describe("mergeCatalog", () => {
  it("falha total não apaga nada e deixa o erro registrado", () => {
    const good = mergeCatalog(emptyCatalog(), run(), options);
    const failed = mergeCatalog(
      good,
      run({
        ads: [],
        coverage: "failed",
        finishedAt: "2026-11-26T06:01:00.000Z",
        errors: [
          { kind: "auth", message: "Chave inválida ou sem permissão.", keyword: "x", pageId: null },
        ],
      }),
      { ...options, today: "2026-11-26" },
    );
    expect(failed.coverage).toBe("failed");
    expect(failed.lastError).toBe("Chave inválida ou sem permissão.");
    expect(failed.lastAttempt).toBe("2026-11-26T06:01:00.000Z");
    expect(failed.generatedAt).toBe(good.generatedAt);
    expect(failed.offers).toEqual(good.offers);
    expect(failed.ads).toEqual(good.ads);
  });

  it("falha na primeira coleta aparece como falha, não como 'não configurado'", () => {
    const failed = mergeCatalog(emptyCatalog(), run({ ads: [], coverage: "failed" }), options);
    expect(failed.generatedAt).toBeNull();
    expect(failed.coverage).toBe("failed");
    expect(failed.lastError).toBeTruthy();
  });

  it("oferta ausente da amostra de hoje continua no catálogo dentro da retenção", () => {
    const monday = mergeCatalog(emptyCatalog(), run(), options);
    const other = [ad("9", "B", "https://example.com/b")].map((a) => ({
      ...a,
      observed: "2026-11-26",
    }));
    const tuesday = mergeCatalog(
      monday,
      run({ ads: other, finishedAt: "2026-11-26T06:00:00.000Z" }),
      {
        ...options,
        today: "2026-11-26",
      },
    );
    expect(tuesday.offers).toHaveLength(2);
    expect(tuesday.ads.filter((a) => a.observed === "2026-11-25")).toHaveLength(5);
  });

  it("aplica a política de retenção às observações antigas", () => {
    const old = mergeCatalog(emptyCatalog(), run(), options);
    const later = mergeCatalog(
      old,
      run({
        ads: [ad("9", "B", "https://example.com/b")].map((a) => ({
          ...a,
          observed: "2026-12-30",
          start: "2026-12-10",
        })),
      }),
      { ...options, today: "2026-12-30" },
    );
    expect(later.ads.map((a) => a.id)).toEqual(["9"]);
    expect(later.offers).toHaveLength(1);
  });

  it("respeita o teto de anúncios mantendo os mais recentes", () => {
    const first = mergeCatalog(emptyCatalog(), run(), options);
    const next = mergeCatalog(
      first,
      run({ ads: ["6", "7"].map((id) => ({ ...ad(id), observed: "2026-11-26" })) }),
      { ...options, today: "2026-11-26", maxAds: 3 },
    );
    expect(next.ads).toHaveLength(3);
    expect(next.ads.filter((a) => a.observed === "2026-11-26")).toHaveLength(2);
  });

  it("guarda o resumo da coleta sem credenciais", () => {
    const merged = mergeCatalog(emptyCatalog(), run(), options);
    expect(merged.run?.calls).toBe(6);
    expect(merged.run?.maxCalls).toBe(18);
    expect(merged.provider).toBe("SearchAPI");
    expect(JSON.stringify(merged)).not.toMatch(/api[_-]?key|bearer/i);
  });
});

describe("parseCatalog", () => {
  it("aceita o catálogo vazio publicado no repositório", () => {
    const published = {
      version: 1,
      generatedAt: null,
      provider: "SearchAPI",
      coverage: "not_configured",
      calls: 0,
      offers: [],
      ads: [],
      matched: 0,
      terms: [],
    };
    const parsed = parseCatalog(published) as Catalog;
    expect(parsed.coverage).toBe("not_configured");
    expect(parsed.lastError).toBeNull();
  });

  it("rejeita formatos desconhecidos", () => {
    expect(parseCatalog(null)).toBeNull();
    expect(parseCatalog({ version: 2, offers: [], ads: [] })).toBeNull();
    expect(parseCatalog({ version: 1, offers: {}, ads: [] })).toBeNull();
  });
});

describe("buildPlan", () => {
  it("define a janela de datas a partir da idade configurada", () => {
    const plan = buildPlan("2026-11-25");
    expect(plan.window).toEqual({ start: "2026-10-26", end: "2026-11-11" });
    expect(plan.terms).toHaveLength(3);
  });

  it("é determinística no dia e cobre todos os termos em poucos dias", () => {
    expect(buildPlan("2026-11-25")).toEqual(buildPlan("2026-11-25"));
    const covered = new Set<string>();
    for (const day of ["2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28"]) {
      for (const t of buildPlan(day).terms) covered.add(t.keyword);
    }
    expect(covered.size).toBe(TERMS.length);
  });
});
