import { afterEach, expect, it, vi } from "vitest";
import { initial, nextStage } from "./research";
import { isCheckout } from "./offer-links";
import { collectPage } from "./provider.server";
import { generate } from "./agent.server";
vi.mock("./research-store.server", () => ({ reserve: vi.fn() }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("allows only one approved stage or another mining batch", () => {
  expect(nextStage(initial, "approve")).toBe(2);
  expect(() => nextStage(initial, "batch")).toThrow();
  expect(nextStage({ ...initial, stage: 4 }, "batch")).toBe(4);
  expect(() => nextStage({ ...initial, stage: 15 }, "approve")).toThrow();
});
it("separates checkout hosts and paths from candidate destinations", () => {
  expect(isCheckout("https://pay.hotmart.com/A")).toBe(true);
  expect(isCheckout("https://example.org/checkout/42")).toBe(true);
  expect(isCheckout("https://example.org/oferta")).toBe(false);
});
it("blocks a market outside the license before any provider call", async () => {
  vi.stubEnv("SEARCHAPI_API_KEY", "fixture");
  vi.stubEnv("OFFERMIND_RESEARCH_AUTHORIZED", "true");
  vi.stubEnv("OFFERMIND_LICENSED_COUNTRIES", "US");
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(
    collectPage("test", {
      country: "BR",
      keyword: "test",
      pageId: "",
      cursor: "",
      start: "",
      end: "",
    }),
  ).rejects.toThrow(/autorização/);
  expect(fetcher).not.toHaveBeenCalled();
});
it("calls Responses with web search and accepts only cited sources", async () => {
  vi.stubEnv("OPENAI_API_KEY", "fixture");
  const url = "https://example.org/course";
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      Response.json({
        status: "completed",
        output: [
          {type:"web_search_call",action:{type:"open_page",url}},
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: "Análise\nVENDAS " + url + "\nCHECKOUT https://pay.example.org/item",
                annotations: [{ type: "url_citation", url }],
              },
            ],
          },
        ],
      }),
    );
  vi.stubGlobal("fetch", fetcher);
  const result = await generate("fixture", { ...initial, country: "BR" }, 5, "Curso");
  const [endpoint, request] = fetcher.mock.calls[0]!;
  expect(endpoint).toBe("https://api.openai.com/v1/responses");
  expect(JSON.parse(request.body)).toMatchObject({
    store: false,
    tool_choice: "required",
    tools: [{ type: "web_search" }],
  });
  expect(result.salesPage).toBe(url);
  expect(result.checkout).toBe("");
});
it("keeps an uncited market report from advancing", async () => {
  vi.stubEnv("OPENAI_API_KEY", "fixture");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({
          status: "completed",
          output: [{ type: "message", content: [{ type: "output_text", text: "Hipótese" }] }],
        }),
      ),
  );
  await expect(generate("fixture", initial, 2, "BR")).rejects.toThrow(/sem fontes/);
});
