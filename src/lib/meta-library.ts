export type MetaCountry = "US" | "BR" | "GB" | "CA" | "AU" | "DE" | "FR" | "ES" | "PT";
export type MetaPlatform = "FACEBOOK" | "INSTAGRAM";
export type MetaMediaType = "IMAGE" | "VIDEO";

export type MetaAdItem = {
  id: string;
  page_name?: string | undefined;
  ad_creative_bodies?: string[] | undefined;
};

export type MetaLibraryErrorCode =
  | "missing_token"
  | "invalid_token"
  | "rate_limit"
  | "api_error"
  | "network_error";

export type MetaLibraryResponse =
  | { ok: true; ads: MetaAdItem[]; after?: string | undefined }
  | { ok: false; code: MetaLibraryErrorCode; message: string; status?: number | undefined };

const INITIAL_TERMS: Record<MetaCountry, string> = {
  US: "education",
  GB: "education",
  CA: "education",
  AU: "education",
  BR: "educação",
  PT: "educação",
  DE: "Bildung",
  FR: "éducation",
  ES: "educación",
};

const EU_MARKETS = new Set<string>(["DE", "FR", "ES", "PT"]);
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80004]);
const AUTH_ERROR_CODES = new Set([10, 102, 190, 200]);

export function initialMetaTerm(country: string): string {
  return INITIAL_TERMS[country as MetaCountry] ?? "education";
}

export function getMarketCoverageNote(country: string): string {
  if (EU_MARKETS.has(country)) {
    return "Neste mercado da União Europeia, a API oficial da Meta cobre anúncios comerciais e de temas sociais/políticos entregues na UE. Tente um termo mais amplo ou remova os filtros de plataforma e formato.";
  }
  return "Fora da União Europeia, a API oficial da Biblioteca de Anúncios da Meta retorna apenas anúncios sobre temas sociais, eleições ou política — anúncios puramente comerciais não aparecem nesta consulta. Tente outro termo, mude para um mercado da UE (DE, FR, ES, PT) ou ajuste os filtros.";
}

export function classifyMetaApiError(
  status: number,
  body: unknown,
): { code: MetaLibraryErrorCode; message: string; status: number } {
  const graphError =
    body && typeof body === "object" && "error" in body && body.error && typeof body.error === "object"
      ? (body.error as { code?: unknown; type?: unknown })
      : undefined;
  const errorCode = typeof graphError?.code === "number" ? graphError.code : undefined;
  const errorType = typeof graphError?.type === "string" ? graphError.type : "";

  if (status === 429 || (errorCode !== undefined && RATE_LIMIT_CODES.has(errorCode))) {
    return {
      code: "rate_limit",
      message: "Limite de chamadas da API da Meta atingido. Aguarde alguns instantes e tente novamente.",
      status,
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    (errorCode !== undefined && AUTH_ERROR_CODES.has(errorCode)) ||
    errorType === "OAuthException"
  ) {
    return {
      code: "invalid_token",
      message:
        "O token META_AD_LIBRARY_ACCESS_TOKEN é inválido, expirou ou não tem permissão para consultar a Biblioteca de Anúncios da Meta.",
      status,
    };
  }

  return {
    code: "api_error",
    message: `A API da Meta recusou a consulta no momento (HTTP ${status}). Tente novamente em instantes.`,
    status,
  };
}