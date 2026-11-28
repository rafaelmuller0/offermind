import { createServerFn } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";
import { z } from "zod";

const query = z.object({
  term: z.string().trim().min(1).max(150),
  country: z.enum(["US","BR","GB","CA","AU","DE","FR","ES","PT"]),
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

export const searchMetaLibrary = createServerFn({ method: "POST" }).validator(query).handler(async ({ data }) => {
  setResponseHeaders(new Headers({ "Cache-Control": "no-store" }));
  const token = process.env.META_AD_LIBRARY_ACCESS_TOKEN;
  if (!token) throw Error("Configure META_AD_LIBRARY_ACCESS_TOKEN nos Secrets da hospedagem.");
  const url = new URL("https://graph.facebook.com/v27.0/ads_archive");
  url.search = new URLSearchParams({
    ad_type: "ALL", ad_active_status: "ACTIVE", search_terms: data.term,
    ad_reached_countries: JSON.stringify([data.country]),
    fields: "id,page_name,ad_creative_bodies", limit: "25",
  }).toString();
  if (data.after) url.searchParams.set("after", data.after);
  const response = await fetch(url, {
    headers: { Authorization: "Bearer " + token }, redirect: "error", signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw Error("A Meta recusou a consulta. Verifique o acesso à biblioteca, a validade do token e o limite de chamadas (HTTP " + response.status + ").");
  const result = page.parse(await response.json());
  return { ads: result.data, after: result.paging?.next ? result.paging.cursors?.after : undefined };
});
