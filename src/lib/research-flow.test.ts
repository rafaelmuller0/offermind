import { beforeEach, expect, it, vi } from "vitest";
import type { Session } from "./research";
const { kv, identity, provider, agent } = vi.hoisted(() => ({
  kv: new Map<string, string>(),
  identity: vi.fn(),
  provider: vi.fn(),
  agent: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    validator() {
      return this;
    },
    handler: (fn: unknown) => fn,
  }),
}));
vi.mock("./research-store.server", () => ({
  researcher: identity,
  redis: async (cmd: string, ...a: string[]) => {
    if (cmd === "GET") return kv.get(a[0]!) || null;
    if (cmd === "SET") {
      if (kv.has(a[0]!)) return null;
      kv.set(a[0]!, a[1]!);
      return "OK";
    }
    if (cmd === "EVAL" && Number(a[1]) === 3) {
      if (kv.get(a[2]!) !== a[5]) return 0;
      kv.set(a[3]!, a[6]!);
      return 1;
    }
    if (cmd === "EVAL") {
      kv.delete(a[2]!);
      return 1;
    }
    throw Error("Comando inesperado");
  },
}));
vi.mock("./provider.server", () => ({ collectPage: provider }));
vi.mock("./agent.server", () => ({ generate: agent }));
import { research, loadResearch } from "./research.functions";
beforeEach(() => {
  kv.clear();
  vi.clearAllMocks();
  identity.mockResolvedValue("alice");
  agent.mockImplementation(async (_user, _state, stage, instruction) => ({
    stage,
    instruction,
    answer: "Resultado do teste",
    sources: [],
    cards: [],
  }));
});
it("persists approvals, paginates batches without repeats and separates accounts", async () => {
  const run = (version: number, selection: string, action: "approve" | "batch" = "approve") =>
    research({ data: { version, selection, action } });
  provider.mockResolvedValue({
    next: "",
    ads: Array.from({ length: 7 }, (_, i) => ({
      id: String(i + 1),
      pageId: "11",
      destination: "https://example.org/" + i,
      advertiser: "Fixture",
      title: "Curso " + i,
      body: "",
      country: "BR",
      format: "IMAGE",
      start: "2026-11-01",
      observed: "2026-11-20",
    })),
  });
  await run(0, "BR");
  await expect(run(0, "BR")).rejects.toThrow(/mudou/);
  await run(1, "Educação");
  expect(provider).not.toHaveBeenCalled();
  const first = await run(2, "Alfabetização");
  expect(first.turns.at(-1)?.cards).toHaveLength(5);
  const second = await run(3, "", "batch");
  expect(second.turns.at(-1)?.cards).toHaveLength(2);
  expect(provider).toHaveBeenCalledTimes(1);
  await expect(run(4, "inventado")).rejects.toThrow(/Selecione/);
  expect((await loadResearch()).stage).toBe(4);
  await run(4, first.turns.at(-1)!.cards[0]!.key);
  expect((await loadResearch()).stage).toBe(5);
  identity.mockResolvedValue("bob");
  expect((await loadResearch()).turns).toHaveLength(0);
});
it("leaves a failed research step retryable", async () => {
  agent.mockRejectedValueOnce(Error("Serviço indisponível"));
  const input = { data: { version: 0, action: "approve" as const, selection: "BR" } };
  await expect(research(input)).rejects.toThrow();
  const saved: Session = await loadResearch();
  expect(saved.version).toBe(0);
  expect((await research(input)).stage).toBe(2);
});
