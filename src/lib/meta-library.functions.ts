import { researcher,reserve } from "./research-store.server";
import { createServerFn } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { classifyMetaApiError, type MetaLibraryResponse } from "./meta-library";

const query = z.object({
  term: z.string().trim().min(1).max(150),
  country: z.enum(["US", "BR", "GB", "CA", "AU", "DE", "FR", "ES", "PT"]),
  platform: z.enum(["FACEBOOK", "INSTAGRAM"]).optional(),
  media: z.enum(["IMAGE", "VIDEO"]).optional(),
  after: z.string().max(8192).optional(),
});

const page = z.object({
  data: z.array(z.object({
    id: z.string().regex(/^\d+$/),
    page_name: z.string().optional(),
    ad_creative_bodies: z.array(z.string()).optional(),
  })),
  paging: z.object({
    next: z.string().optional(),
    cursors: z.object({ after: z.string().optional() }).optional(),
  }).optional(),
});

export const searchMetaLibrary = createServerFn({ method: "POST" })
  .validator((input) => query.parse(input))
  .handler(async ({ data }): Promise<MetaLibraryResponse> => {
    setResponseHeaders(new Headers({ "Cache-Control": "no-store" }));
    const token = process.env["META_AD_LIBRARY_ACCESS_TOKEN"]?.trim();
    if (!token) {
      return {
        ok: false,
        code: "missing_token",
        message: "O segredo META_AD_LIBRARY_ACCESS_TOKEN não está configurado no servidor.",
      };
    }

    await reserve(await researcher(),"meta",60);
    const url = new URL("https://graph.facebook.com/v27.0/ads_archive");
    url.search = new URLSearchParams({
      ad_type: "ALL",
      ad_active_status: "ACTIVE",
      search_terms: data.term,
      ad_reached_countries: JSON.stringify([data.country]),
      fields: "id,page_name,ad_creative_bodies",
      limit: "25",
    }).toString();
    if (data.platform) url.searchParams.set("publisher_platforms", JSON.stringify([data.platform]));
    if (data.media) url.searchParams.set("media_type", data.media);
    if (data.after) url.searchParams.set("after", data.after);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        redirect: "manual",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      return {
        ok: false,
        code: "network_error",
        message: "Não foi possível conectar à API da Meta. Verifique a conexão e tente novamente.",
      };
    }

    if (response.status >= 300 && response.status < 400) {
      return {
        ok: false,
        code: "api_error",
        message: "A API da Meta retornou um redirecionamento inesperado.",
        status: response.status,
      };
    }

    let raw: unknown = null;
    try {
      raw = await response.json();
    } catch {
      raw = null;
    }

    if (!response.ok) {
      const classified = classifyMetaApiError(response.status, raw);
      return { ok: false, ...classified };
    }

    const parsed = page.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        code: "api_error",
        message: "A resposta da API da Meta veio em um formato inesperado.",
      };
    }

    const after = parsed.data.paging?.next ? parsed.data.paging.cursors?.after : undefined;
    return after ? { ok: true, ads: parsed.data.data, after } : { ok: true, ads: parsed.data.data };
  });
