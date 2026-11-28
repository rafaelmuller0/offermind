import { parsePage } from "../discovery.ts";
import { ProviderError } from "./errors.ts";
import type { AdProvider, SearchQuery } from "./types.ts";

/**
 * Único lugar do projeto que conhece o endpoint do SearchAPI.
 * Documentação: https://www.searchapi.io/docs/meta-ad-library-api
 */
export const SEARCHAPI_ENDPOINT = "https://www.searchapi.io/api/v1/search";
export const SEARCHAPI_DOCS = "https://www.searchapi.io/docs/meta-ad-library-api";

// A documentação manda usar POST quando o next_page_token é grande.
const LARGE_QUERY = 3500;

export function buildSearchParams(query: SearchQuery) {
  const params = new URLSearchParams({
    engine: "meta_ad_library",
    // A lista oficial de países usa maiúsculas (US, BR). Os exemplos da página principal
    // usam minúsculas e a documentação não diz se o campo diferencia caixa; seguimos a lista.
    country: query.country.toUpperCase(),
    ad_type: "all",
    active_status: "active",
    media_type: "all",
  });
  if (query.pageId) params.set("page_id", query.pageId);
  else if (query.keyword?.trim()) params.set("q", query.keyword.trim());
  if (query.cursor) params.set("next_page_token", query.cursor);
  if (query.startDate) params.set("start_date", query.startDate);
  if (query.endDate) params.set("end_date", query.endDate);
  return params;
}

type Options = {
  apiKey: string;
  fetchImpl?: typeof fetch;
  endpoint?: string;
  timeoutMs?: number;
  today?: () => string;
};

export function createSearchApiProvider(options: Options): AdProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = options.endpoint ?? SEARCHAPI_ENDPOINT;
  const timeoutMs = options.timeoutMs ?? 25000;
  const today = options.today ?? (() => new Date().toISOString().slice(0, 10));

  return {
    id: "searchapi",
    label: "SearchAPI",
    async search(query) {
      const params = buildSearchParams(query);
      const large = params.toString().length > LARGE_QUERY;
      let response: Response;
      try {
        response = await fetchImpl(large ? endpoint : endpoint + "?" + params.toString(), {
          method: large ? "POST" : "GET",
          headers: {
            Authorization: "Bearer " + options.apiKey,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          ...(large ? { body: JSON.stringify(Object.fromEntries(params)) } : {}),
          signal: AbortSignal.timeout(timeoutMs),
          // Nunca seguir redirecionamentos: o cabeçalho Authorization não pode vazar.
          redirect: "error",
        });
      } catch (cause) {
        const timedOut = cause instanceof Error && cause.name === "TimeoutError";
        throw new ProviderError(
          timedOut ? "timeout" : "network",
          timedOut
            ? "O provedor de anúncios demorou demais para responder."
            : "Não foi possível acessar o provedor de anúncios.",
        );
      }
      if (!response.ok) {
        const status = response.status;
        if (status === 401 || status === 403)
          throw new ProviderError("auth", "Chave inválida ou sem permissão.", status);
        if (status === 429)
          throw new ProviderError("rate_limit", "Limite do provedor atingido.", status);
        if (status >= 500)
          throw new ProviderError(
            "server",
            "O provedor retornou erro HTTP " + status + ".",
            status,
          );
        throw new ProviderError(
          "request",
          "O provedor recusou a consulta (HTTP " + status + ").",
          status,
        );
      }
      let raw: unknown;
      try {
        raw = await response.json();
      } catch {
        throw new ProviderError("parse", "A resposta do provedor não é um JSON válido.");
      }
      try {
        return parsePage(raw, query.country.toUpperCase(), today());
      } catch (cause) {
        throw new ProviderError(
          "parse",
          cause instanceof Error ? cause.message : "Resposta do provedor não reconhecida.",
        );
      }
    },
  };
}
