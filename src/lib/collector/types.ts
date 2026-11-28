import type { FoundAd, SearchPage } from "../discovery.ts";
import type { ProviderErrorKind } from "./errors.ts";

export type SearchQuery = {
  country: string;
  keyword?: string | undefined;
  pageId?: string | undefined;
  cursor?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
};

/** Contrato que todo fornecedor de anúncios precisa cumprir. */
export type AdProvider = {
  id: string;
  label: string;
  search: (query: SearchQuery) => Promise<SearchPage>;
};

export type CollectionPlan = {
  terms: { niche: string; keyword: string }[];
  /** Páginas por termo na descoberta. */
  discoverPages: number;
  /** Quantos anunciantes aprofundar, por quantidade de anúncios observados. */
  deepenTop: number;
  /** Páginas por anunciante aprofundado. */
  deepenPages: number;
  /** Janela de datas de veiculação aplicada somente à descoberta. */
  window?: { start: string; end: string };
};

export type QueryLog = {
  phase: "discover" | "deepen";
  niche: string;
  keyword: string | null;
  pageId: string | null;
  /** Chamadas HTTP feitas, incluindo retentativas. */
  attempts: number;
  /** Páginas obtidas com sucesso. */
  pages: number;
  adsReturned: number;
  skipped: number;
  totalReported: number | null;
  /** Há resultados que não foram lidos (cursor restante, erro ou orçamento). */
  truncated: boolean;
  error: string | null;
};

export type RunError = {
  kind: ProviderErrorKind;
  message: string;
  keyword: string | null;
  pageId: string | null;
};

export type Coverage = "complete" | "partial" | "failed";

export type RunResult = {
  provider: string;
  country: string;
  startedAt: string;
  finishedAt: string;
  calls: number;
  maxCalls: number;
  ads: FoundAd[];
  nicheByPage: Record<string, string>;
  queries: QueryLog[];
  errors: RunError[];
  advertisersSeen: number;
  coverage: Coverage;
  stoppedBy: "budget" | "auth" | "failures" | null;
};
