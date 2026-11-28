import { describe, expect, it, vi } from "vitest";
import type { FoundAd, SearchPage } from "../discovery";
import { defaults } from "../offermind";
import { ProviderError } from "./errors";
import { createHunter, entriesFromHunt, HUNT_PROFILE, type HuntRequest } from "./hunt";
import { buildSearchParams } from "./searchapi";
import type { AdProvider, SearchQuery } from "./types";

// Dados SINTÉTICOS de teste. Nunca são exibidos no produto.
const found = (id: string, pageId = "A", destination = "https://example.com/a"): FoundAd => ({
  id,
  pageId,
  advertiser: "Anunciante " + pageId,
  destination,
  title: "Título " + id,
  body: "Texto " + id,
  start: "2026-11-01",
  observed: "2026-11-28",
  country: "BR",
  format: "IMAGE",
});
const page = (ads: FoundAd[], next = ""): SearchPage => ({
  ads,
  next,
  total: ads.length,
  observed: "2026-11-28",
  skipped: 0,
});
const provider = (handler: (q: SearchQuery) => SearchPage | Promise<SearchPage>) => {
  const search = vi.fn(async (q: SearchQuery) => handler(q));
  return { provider: { id: "fake", label: "Fake", search } as AdProvider, search };
};
const request: HuntRequest = {
  country: "BR",
  adType: HUNT_PROFILE.adType,
  sortBy: HUNT_PROFILE.sortBy,
  keyword: "",
};
const sleep = async (_ms: number) => {};

describe("perfil de busca do feed", () => {
  it("espelha o link da Biblioteca de Anúncios: políticos e de questões sociais, mais impressões", () => {
    expect(HUNT_PROFILE.adType).toBe("political_and_issue_ads");
    expect(HUNT_PROFILE.sortBy).toBe("impressions_high_to_low");
  });

  it("envia tipo de anúncio e ordenação ao fornecedor, sem palavra-chave quando vazia", () => {
    const params = buildSearchParams({
      country: "br",
      adType: HUNT_PROFILE.adType,
      sortBy: HUNT_PROFILE.sortBy,
      keyword: "",
    });
    expect(params.get("country")).toBe("BR");
    expect(params.get("ad_type")).toBe("political_and_issue_ads");
    expect(params.get("sort_by")).toBe("impressions_high_to_low");
    expect(params.get("active_status")).toBe("active");
    expect(params.has("q")).toBe(false);
  });

  it("sem tipo nem ordenação, mantém o comportamento anterior (all, sem sort_by)", () => {
    const params = buildSearchParams({ country: "US", keyword: "x" });
    expect(params.get("ad_type")).toBe("all");
    expect(params.has("sort_by")).toBe(false);
  });
});

describe("createHunter", () => {
  it("sem credencial devolve not_configured e não consulta ninguém", async () => {
    const hunter = createHunter({ provider: null });
    const result = await hunter.hunt(request);
    expect(result.status).toBe("not_configured");
    expect(result.ads).toEqual([]);
    expect(result.error).toMatch(/chave/i);
  });

  it("consulta o fornecedor com o perfil pedido e devolve os anúncios", async () => {
    const { provider: p, search } = provider(() => page([found("1"), found("2")]));
    const result = await createHunter({ provider: p, sleep }).hunt({
      ...request,
      keyword: " saúde ",
    });
    const query = search.mock.calls[0]![0];
    expect(query.adType).toBe("political_and_issue_ads");
    expect(query.sortBy).toBe("impressions_high_to_low");
    expect(query.country).toBe("BR");
    expect(query.keyword).toBe("saúde");
    expect(query.startDate).toBeUndefined();
    expect(result.status).toBe("ok");
    expect(result.ads.map((a) => a.id)).toEqual(["1", "2"]);
    expect(result.cached).toBe(false);
    expect(result.fetchedAt).toBeTruthy();
  });

  it("lê no máximo duas páginas e marca a cobertura como parcial se sobrou resultado", async () => {
    const { provider: p, search } = provider((q) =>
      page([found(q.cursor || "p1")], "mais-" + (q.cursor || "0")),
    );
    const result = await createHunter({ provider: p, sleep }).hunt(request);
    expect(search).toHaveBeenCalledTimes(2);
    expect(result.coverage).toBe("partial");
  });

  it("repete a mesma busca a partir da cache, sem gastar chamadas", async () => {
    const { provider: p, search } = provider(() => page([found("1")]));
    let clock = 1_000;
    const hunter = createHunter({ provider: p, sleep, now: () => clock });
    await hunter.hunt(request);
    clock += 60_000;
    const again = await hunter.hunt({ ...request, keyword: "  " });
    expect(search).toHaveBeenCalledTimes(1);
    expect(again.cached).toBe(true);
    expect(again.ads).toHaveLength(1);
    // depois do TTL consulta de novo
    clock += 31 * 60_000;
    await hunter.hunt(request);
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("buscas diferentes não compartilham cache", async () => {
    const { provider: p, search } = provider(() => page([found("1")]));
    const hunter = createHunter({ provider: p, sleep });
    await hunter.hunt(request);
    await hunter.hunt({ ...request, country: "US" });
    await hunter.hunt({ ...request, keyword: "educação" });
    expect(search).toHaveBeenCalledTimes(3);
  });

  it("visitantes simultâneos com a mesma busca compartilham uma única consulta", async () => {
    const { provider: p, search } = provider(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return page([found("1")]);
    });
    const hunter = createHunter({ provider: p, sleep });
    const [a, b, c] = await Promise.all([
      hunter.hunt(request),
      hunter.hunt(request),
      hunter.hunt(request),
    ]);
    expect(search).toHaveBeenCalledTimes(1);
    expect([a.status, b.status, c.status]).toEqual(["ok", "ok", "ok"]);
  });

  it("respeita o limite de chamadas por hora e informa quando tentar de novo", async () => {
    const { provider: p, search } = provider(() => page([found("1")]));
    let clock = 0;
    const hunter = createHunter({ provider: p, sleep, maxCallsPerHour: 2, now: () => clock });
    await hunter.hunt({ ...request, keyword: "a" });
    expect(hunter.callsUsedLastHour()).toBe(1);
    await hunter.hunt({ ...request, keyword: "b" });
    clock += 1000;
    const blocked = await hunter.hunt({ ...request, keyword: "c" });
    expect(search).toHaveBeenCalledTimes(2);
    expect(blocked.status).toBe("rate_limited");
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(3600);
    // passada a hora, volta a consultar
    clock += 3_600_000;
    const later = await hunter.hunt({ ...request, keyword: "c" });
    expect(later.status).toBe("ok");
  });

  it("nunca gasta mais do que resta do orçamento horário, nem com retentativas", async () => {
    const { provider: p, search } = provider(() => {
      throw new ProviderError("server", "O provedor retornou erro HTTP 500.", 500);
    });
    const hunter = createHunter({ provider: p, sleep, maxCallsPerHour: 2 });
    const result = await hunter.hunt(request);
    expect(search).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("failed");
    expect(hunter.callsUsedLastHour()).toBe(2);
  });

  it("chave inválida vira falha com a mensagem do provedor e para na primeira chamada", async () => {
    const { provider: p, search } = provider(() => {
      throw new ProviderError("auth", "Chave inválida ou sem permissão.", 401);
    });
    const result = await createHunter({ provider: p, sleep }).hunt(request);
    expect(search).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("failed");
    expect(result.error).toBe("Chave inválida ou sem permissão.");
    expect(result.ads).toEqual([]);
  });

  it("guarda a falha por pouco tempo para não martelar o fornecedor a cada visita", async () => {
    const { provider: p, search } = provider(() => {
      throw new ProviderError("auth", "Chave inválida ou sem permissão.", 401);
    });
    let clock = 0;
    const hunter = createHunter({ provider: p, sleep, now: () => clock });
    await hunter.hunt(request);
    clock += 10_000;
    const again = await hunter.hunt(request);
    expect(search).toHaveBeenCalledTimes(1);
    expect(again.cached).toBe(true);
    expect(again.status).toBe("failed");
    clock += 61_000;
    await hunter.hunt(request);
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("não vaza credencial na resposta", async () => {
    const { provider: p } = provider(() => {
      throw new ProviderError("auth", "Chave inválida ou sem permissão.", 401);
    });
    const result = await createHunter({ provider: p, sleep }).hunt(request);
    expect(JSON.stringify(result)).not.toMatch(/bearer|api[_-]?key=/i);
  });
});

describe("entriesFromHunt", () => {
  const rules = { ...defaults, country: "BR" };

  it("agrupa por anunciante e destino, rotula o tipo e aponta para o anúncio original", () => {
    const ads = [found("1"), found("2"), found("3", "B", "https://example.com/b")];
    const { entries, ungrouped } = entriesFromHunt(ads, rules, HUNT_PROFILE.label, request);
    expect(entries).toHaveLength(2);
    expect(ungrouped).toBe(0);
    const first = entries[0]!;
    expect(first.offer.id).toMatch(/^hunt:BR:[0-9a-f]{14}$/);
    expect(first.offer.niche).toBe("Anúncios políticos e de questões sociais");
    expect(first.offer.notes).toContain("political_and_issue_ads");
    expect(first.ads[0]?.source).toMatch(/^https:\/\/www\.facebook\.com\/ads\/library\/\?id=/);
    expect(first.ads.every((a) => a.reviewed === false && a.concept === "")).toBe(true);
  });

  it("gera IDs estáveis entre execuções, para não duplicar no feed", () => {
    const a = entriesFromHunt([found("1")], rules, "x", request).entries[0]!.offer.id;
    const b = entriesFromHunt([found("1"), found("2")], rules, "x", request).entries[0]!.offer.id;
    expect(a).toBe(b);
  });

  it("informa quantos anúncios ficaram de fora por não terem destino único", () => {
    const ads = [
      found("1"),
      { ...found("2", "C"), destination: "" },
      { ...found("3", "D"), destination: "" },
    ];
    const { entries, ungrouped } = entriesFromHunt(ads, rules, "x", request);
    expect(entries).toHaveLength(1);
    expect(ungrouped).toBe(2);
  });

  it("ignora anúncios de outro país", () => {
    const ads = [{ ...found("1"), country: "US" }];
    expect(entriesFromHunt(ads, rules, "x", request).entries).toEqual([]);
  });
});
