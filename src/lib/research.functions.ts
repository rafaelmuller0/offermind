import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { researcher, redis } from "./research-store.server";
import { generate } from "./agent.server";
import { collectPage } from "./provider.server";
import { groupCandidates, type FoundAd } from "./discovery";
import { defaults } from "./offermind";
import { initial, nextStage, type Session, type Turn } from "./research";
type Stored = Session & { remaining?: Turn["cards"]; cursor?: string };
function visible({ version, country, stage, turns }: Stored): Session {
  return { version, country, stage, turns };
}
async function read(key: string): Promise<Stored> {
  const raw = await redis<string | null>("GET", key);
  return raw ? JSON.parse(raw) : initial;
}
export const loadResearch = createServerFn({ method: "GET" }).handler(async () =>
  visible(await read((await researcher()) + ":research")),
);

const input = z.object({
  version: z.number().int().nonnegative(),
  action: z.enum(["approve", "batch", "restart", "revise"]),
  selection: z.string().trim().max(600),
});
export const research = createServerFn({ method: "POST" })
  .validator(input)
  .handler(async ({ data }) => {
    const user = await researcher(),
      key = user + ":research",
      lock = key + ":lock",
      token = crypto.randomUUID();
    if (!(await redis("SET", lock, token, "NX", "EX", 180)))
      throw Error("Há uma pesquisa em andamento.");
    try {
      const current = await read(key);
      if (current.version !== data.version) throw Error("A operação mudou. Atualize o histórico.");
      let updated: Stored;
      if (data.action === "restart") {
        updated = { ...initial, version: current.version + 1 };
      } else {
        const revising = data.action === "revise";
        if (revising && (!data.selection || current.stage === 1 || current.stage === 4))
          throw Error("Escolha um país ou uma candidata para pesquisar.");
        const stage = data.action === "revise" ? current.stage : nextStage(current, data.action);
        const country = current.country || z.enum(["BR", "US"]).parse(data.selection);
        const state: Stored & { country: "US" | "BR" } = { ...current, country };
        let selection = data.selection;
        if ([3, 4].includes(stage) && data.action === "approve" && !selection)
          throw Error("Selecione o recorte apresentado.");
        if (stage === 5 && !revising) {
          const chosen = current.turns
            .filter((t) => t.stage === 4)
            .flatMap((t) => t.cards)
            .find((c) => c.key === selection);
          if (!chosen) throw Error("Selecione uma candidata do lote.");
          selection = chosen.name + " · " + chosen.destination;
        }
        let turn: Turn;
        if (stage === 4) {
          const prior = current.turns.filter((t) => t.stage === 4);
          const term = data.action === "batch" ? prior[0]?.instruction : selection;
          if (!term || term.length > 150)
            throw Error("O micronicho precisa ter até 150 caracteres.");
          const seen = new Set(prior.flatMap((t) => t.cards.map((c) => c.key)));
          const ads: FoundAd[] = [];
          let cursor = current.cursor || "";
          const pending = current.remaining || [];
          for (let i = 0; i < 4 && pending.length < 5 && (!prior.length || cursor); i++) {
            const page = await collectPage(user, {
              country,
              keyword: term,
              pageId: "",
              start: "",
              end: "",
              cursor,
            });
            ads.push(...page.ads);
            const groups = groupCandidates(ads, { ...defaults, country });
            cursor = page.next === cursor ? "" : page.next;
            if (pending.length + groups.filter((c) => !seen.has(c.key)).length >= 5 || !cursor)
              break;
          }
          const more = groupCandidates(ads, { ...defaults, country })
            .filter((c) => !seen.has(c.key))
            .map((c) => ({
              key: c.key,
              name: c.title,
              advertiser: c.advertiser,
              destination: c.destination,
              observed: c.ads[0]!.observed,
              count: c.ads.length,
              window: c.windowAds.length,
              evidence: c.ads.map((a) => ({
                id: a.id,
                start: a.start,
                format: a.format,
                title: a.title,
              })),
              sources: c.ads
                .slice(0, 10)
                .map((a) => "https://www.facebook.com/ads/library/?id=" + a.id),
              image: c.ads.find((a) => a.thumbnail)?.thumbnail || "",
            }));
          const pool = [...new Map([...pending, ...more].map((c) => [c.key, c])).values()];
          const cards = pool.slice(0, 5);
          state.remaining = pool.slice(5);
          state.cursor = cursor;
          if (prior.length && !cards.length && !current.cursor && !pending.length)
            throw Error("Lotes esgotados para este recorte.");
          turn = {
            stage,
            instruction: term,
            answer:
              cards.length +
              " candidatas distintas nesta amostra. Contagens são mínimos observados. A qualificação exige revisão das evidências e do destino.",
            sources: [],
            cards,
          };
        } else {
          turn = await generate(user, state, stage, selection);
        }
        updated = { ...state, stage, version: state.version + 1, turns: [...state.turns, turn] };
      }
      const script =
        "if redis.call('get',KEYS[1])~=ARGV[1] then return 0 end; if ARGV[3]=='restart' then local old=redis.call('get',KEYS[2]); if old then redis.call('rpush',KEYS[3],old) end end; redis.call('set',KEYS[2],ARGV[2]); return 1";
      if (
        !(await redis(
          "EVAL",
          script,
          3,
          lock,
          key,
          key + ":archive",
          token,
          JSON.stringify(updated),
          data.action,
        ))
      )
        throw Error("A sessão mudou. Atualize o histórico.");
      return visible(updated);
    } finally {
      await redis(
        "EVAL",
        "if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) end; return 0",
        1,
        lock,
        token,
      );
    }
  });
