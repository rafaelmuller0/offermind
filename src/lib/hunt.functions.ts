import { createServerFn } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { createHunter, type Hunter } from "./collector/hunt.ts";
import { createSearchApiProvider } from "./collector/searchapi.ts";
import { AD_TYPES, SORTS } from "./collector/types.ts";

const input = z.object({
  country: z.enum(["US", "BR", "GB", "CA", "AU", "DE", "FR", "ES", "PT"]),
  adType: z.enum(AD_TYPES),
  sortBy: z.enum(SORTS),
  keyword: z.string().max(150),
});

// Um caçador por processo do servidor. É recriado se a chave mudar, para que a
// cache e o orçamento não sobrevivam a uma troca de credencial.
let current: { key: string; hunter: Hunter } | undefined;

function getHunter(): Hunter {
  const key = (process.env["SEARCHAPI_API_KEY"] ?? "").trim();
  if (current && current.key === key) return current.hunter;
  const hunter = createHunter({
    provider: key ? createSearchApiProvider({ apiKey: key }) : null,
  });
  current = { key, hunter };
  return hunter;
}

/**
 * Busca em tempo real para o feed. A credencial é a do servidor (secret
 * SEARCHAPI_API_KEY); o navegador nunca envia nem recebe chave.
 */
export const huntOffers = createServerFn({ method: "POST" })
  .validator(input)
  .handler(async ({ data }) => {
    setResponseHeaders(new Headers({ "Cache-Control": "no-store" }));
    return getHunter().hunt(data);
  });
