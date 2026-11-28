import { parsePage } from "./discovery";
import { reserve } from "./research-store.server";
export async function collectPage(
  user: string,
  data: {
    country: string;
    keyword: string;
    pageId: string;
    cursor: string;
    start: string;
    end: string;
    media?: "all" | "video" | "image";
    platform?: "all" | "facebook" | "instagram";
  },
) {
  const key = process.env["SEARCHAPI_API_KEY"];
  if (
    !key ||
    process.env["OFFERMIND_RESEARCH_AUTHORIZED"] !== "true" ||
    !(process.env["OFFERMIND_LICENSED_COUNTRIES"] || "").split(",").includes(data.country)
  )
    throw Error("Fonte comercial sem autorização configurada para este mercado.");
  await reserve(user, "ads", 60);
  const params = new URLSearchParams({
    engine: "meta_ad_library",
    country: data.country.toLowerCase(),
    ad_type: "all",
    active_status: "active",
    media_type: data.media || "all",
    sort_by: "impressions_high_to_low",
  });
  if (data.platform && data.platform !== "all") params.set("platforms", data.platform);
  if (data.pageId) params.set("page_id", data.pageId);
  if (data.keyword.trim()) params.set("q", data.keyword.trim());
  if (data.cursor) params.set("next_page_token", data.cursor);
  if (data.start) params.set("start_date", data.start);
  if (data.end) params.set("end_date", data.end);
  const endpoint = "https://www.searchapi.io/api/v1/search";
  const large = params.toString().length > 3500;
  let response: Response;
  try {
    response = await fetch(large ? endpoint : endpoint + "?" + params.toString(), {
      method: large ? "POST" : "GET",
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      ...(large ? { body: JSON.stringify(Object.fromEntries(params)) } : {}),
      signal: AbortSignal.timeout(25000),
      redirect: "error",
    });
  } catch {
    throw Error("Não foi possível acessar o provedor de anúncios. Tente novamente.");
  }
  if (!response.ok) {
    throw Error(
      response.status === 401 || response.status === 403
        ? "Chave inválida ou sem permissão."
        : response.status === 429
          ? "Limite do provedor atingido."
          : "O provedor retornou erro HTTP " + response.status + ".",
    );
  }
  const raw: unknown = await response.json();
  return parsePage(raw, data.country, new Date().toISOString().slice(0, 10));
}
