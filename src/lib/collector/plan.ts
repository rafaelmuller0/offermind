import type { CollectionPlan } from "./types.ts";

/** Pares [nicho, palavra-chave]. A rotação diária cobre todos em poucos dias. */
export const TERMS: [string, string][] = [
  ["Pets", "dog training plan"],
  ["Educação", "learn to read"],
  ["Maternidade", "baby sleep guide"],
  ["Hobbies", "crochet patterns"],
  ["Organização", "cleaning schedule"],
  ["Educação", "daily lessons"],
  ["Hobbies", "guitar practice"],
  ["Produtos digitais", "digital guide"],
  ["Produtos digitais", "personalized plan"],
  ["Produtos digitais", "30 day challenge"],
  ["Profissões", "client templates"],
  ["Hobbies", "garden planner"],
];

const DAY = 86400000;

export const daysAgo = (date: string, n: number) =>
  new Date(Date.parse(date + "T00:00:00Z") - n * DAY).toISOString().slice(0, 10);

type PlanOptions = { termsPerRun?: number; minAge?: number; maxAge?: number };

export function buildPlan(observed: string, options: PlanOptions = {}): CollectionPlan {
  const per = Math.min(options.termsPerRun ?? 3, TERMS.length);
  const offset = (Math.floor(Date.parse(observed + "T00:00:00Z") / DAY) * per) % TERMS.length;
  const terms = Array.from({ length: per }, (_, i) => {
    const [niche, keyword] = TERMS[(offset + i) % TERMS.length]!;
    return { niche, keyword };
  });
  return {
    terms,
    discoverPages: 2,
    deepenTop: 3,
    deepenPages: 4,
    window: {
      start: daysAgo(observed, options.maxAge ?? 30),
      end: daysAgo(observed, options.minAge ?? 14),
    },
  };
}
