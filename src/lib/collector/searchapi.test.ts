import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ProviderError } from "./errors";
import { buildSearchParams, createSearchApiProvider, SEARCHAPI_ENDPOINT } from "./searchapi";

// Dados SINTÉTICOS de teste, no formato documentado pelo fornecedor.
// Nunca são exibidos no produto.
const row = (id: number, pageId = "100") => ({
  ad_archive_id: String(id),
  page_id: pageId,
  is_active: true,
  start_date: "2026-10-20",
  publisher_platform: ["FACEBOOK"],
  snapshot: {
    page_name: "Anunciante de teste",
    link_url: "https://example.com/oferta?utm_source=x",
    title: "Título " + id,
    body: { text: "Texto " + id },
    display_format: "IMAGE",
    images: [{ resized_image_url: "https://scontent.xx.fbcdn.net/v/t/teste.jpg" }],
  },
});
const body = (ads: unknown[], next = "") => ({
  search_information: { total_results: ads.length },
  ads,
  pagination: next ? { next_page_token: next } : {},
});
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const make = (fetchImpl: unknown, apiKey = "chave-secreta-123") =>
  createSearchApiProvider({
    apiKey,
    fetchImpl: fetchImpl as typeof fetch,
    today: () => "2026-11-25",
  });
const query = { country: "US", keyword: "digital guide" };
/** Espera que a promessa seja rejeitada e devolve o erro tipado. */
const fails = async (promise: Promise<unknown>) =>
  (await promise.then(
    () => {
      throw new Error("a chamada deveria ter falhado");
    },
    (error: unknown) => error,
  )) as ProviderError;

describe("endpoint", () => {
  it("usa o domínio oficial documentado do fornecedor", () => {
    expect(new URL(SEARCHAPI_ENDPOINT).hostname).toBe("www.searchapi.io");
  });

  it("nenhum arquivo do projeto aponta para o domínio errado que já causou falhas", () => {
    const wrong = "searchapi" + ".org";
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (["node_modules", ".git", ".output", "dist", ".wrangler"].includes(name)) continue;
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(ts|tsx|mjs|md|yml|json)$/.test(name) && name !== "bun.lock") {
          if (readFileSync(path, "utf8").includes(wrong)) hits.push(path);
        }
      }
    };
    for (const dir of ["src", "scripts", "docs", ".github"]) {
      try {
        walk(join(process.cwd(), dir));
      } catch {
        // pasta inexistente nesta branch
      }
    }
    expect(hits).toEqual([]);
  });
});

describe("buildSearchParams", () => {
  it("envia o país em maiúsculas, como na lista oficial de países", () => {
    expect(buildSearchParams({ country: "us", keyword: "x" }).get("country")).toBe("US");
  });

  it("busca por anunciante ignora a palavra-chave", () => {
    const params = buildSearchParams({ country: "US", keyword: "x", pageId: "123" });
    expect(params.get("page_id")).toBe("123");
    expect(params.has("q")).toBe(false);
  });

  it("inclui cursor e datas apenas quando informados", () => {
    const bare = buildSearchParams({ country: "US", keyword: "x" });
    expect(bare.has("next_page_token")).toBe(false);
    expect(bare.has("start_date")).toBe(false);
    const full = buildSearchParams({
      country: "US",
      keyword: "x",
      cursor: "abc",
      startDate: "2026-10-26",
      endDate: "2026-11-11",
    });
    expect(full.get("next_page_token")).toBe("abc");
    expect(full.get("start_date")).toBe("2026-10-26");
    expect(full.get("end_date")).toBe("2026-11-11");
  });
});

describe("provider", () => {
  it("consulta com GET, Bearer, sem seguir redirecionamentos, e interpreta os anúncios", async () => {
    const fetchImpl = vi.fn(async () => json(body([row(1), row(2)], "next-token")));
    const page = await make(fetchImpl).search(query);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url.startsWith(SEARCHAPI_ENDPOINT + "?")).toBe(true);
    expect(url).not.toContain("chave-secreta-123");
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer chave-secreta-123",
    );
    expect(init.redirect).toBe("error");
    expect(page.ads.map((a) => a.id)).toEqual(["1", "2"]);
    expect(page.ads[0]?.country).toBe("US");
    expect(page.ads[0]?.thumbnail).toBe("https://scontent.xx.fbcdn.net/v/t/teste.jpg");
    expect(page.next).toBe("next-token");
  });

  it("usa POST quando o cursor é grande", async () => {
    const fetchImpl = vi.fn(async () => json(body([row(1)])));
    await make(fetchImpl).search({ ...query, cursor: "x".repeat(4000) });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(SEARCHAPI_ENDPOINT);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body)).next_page_token).toHaveLength(4000);
  });

  it.each([
    [401, "auth", false],
    [403, "auth", false],
    [429, "rate_limit", true],
    [500, "server", true],
    [503, "server", true],
    [400, "request", false],
  ])("HTTP %i vira erro %s (retentável: %s) sem vazar a chave", async (status, kind, retryable) => {
    const provider = make(async () => json({ error: "chave-secreta-123 inválida" }, status));
    const error = await provider.search(query).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    const failure = error as ProviderError;
    expect(failure.kind).toBe(kind);
    expect(failure.retryable).toBe(retryable);
    expect(failure.status).toBe(status);
    expect(failure.message).not.toContain("chave-secreta-123");
  });

  it("falha de rede e timeout são erros temporários", async () => {
    const network = await fails(
      make(async () => {
        throw new TypeError("fetch failed");
      }).search(query),
    );
    expect(network.kind).toBe("network");
    expect(network.retryable).toBe(true);
    const timeout = await fails(
      make(async () => {
        throw Object.assign(new Error("timeout"), { name: "TimeoutError" });
      }).search(query),
    );
    expect(timeout.kind).toBe("timeout");
    expect(timeout.retryable).toBe(true);
  });

  it("resposta inválida ou irreconhecível é erro de parse, não resultado vazio", async () => {
    const invalid = await fails(
      make(async () => new Response("<html>não é json</html>")).search(query),
    );
    expect(invalid.kind).toBe("parse");
    const unknown = await fails(make(async () => json({ qualquer: "coisa" })).search(query));
    expect(unknown.kind).toBe("parse");
    expect(unknown.retryable).toBe(false);
  });
});
