import { createServerFn } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { ProviderError } from "./collector/errors.ts";
import { createSearchApiProvider } from "./collector/searchapi.ts";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$|^$/);

const input = z
  .object({
    apiKey: z
      .string()
      .min(8)
      .max(256)
      .regex(/^[A-Za-z0-9_-]+$/),
    country: z.enum(["US", "BR", "GB", "CA", "AU", "DE", "FR", "ES", "PT"]),
    keyword: z.string().max(150),
    pageId: z.string().max(32).regex(/^\d*$/),
    cursor: z.string().max(32000),
    start: date,
    end: date,
  })
  .refine((v) => !!v.keyword.trim() || !!v.pageId, {
    message: "Informe palavra-chave ou anunciante.",
  });

// Beta manual do Miner. A coleta automática do catálogo usa o mesmo provedor
// (src/lib/collector), então o endpoint e o formato da requisição ficam em um só lugar.
export const searchAdsPage = createServerFn({ method: "POST" })
  .validator(input)
  .handler(async ({ data }) => {
    setResponseHeaders(new Headers({ "Cache-Control": "no-store" }));
    const provider = createSearchApiProvider({ apiKey: data.apiKey });
    try {
      return await provider.search({
        country: data.country,
        keyword: data.keyword,
        pageId: data.pageId,
        cursor: data.cursor,
        startDate: data.start,
        endDate: data.end,
      });
    } catch (cause) {
      throw Error(
        cause instanceof ProviderError
          ? cause.message
          : "Não foi possível consultar o provedor de anúncios. Tente novamente.",
      );
    }
  });
