import { createServerFn } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { collectPage } from "./provider.server";
import { researcher } from "./research-store.server";
const input = z
  .object({
    country: z.enum(["US", "BR", "GB", "CA", "AU", "DE", "FR", "ES", "PT"]),
    keyword: z.string().max(150),
    pageId: z.string().max(32).regex(/^\d*$/),
    cursor: z.string().max(32000),
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$|^$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$|^$/),
  })
  .refine((v) => !!v.keyword.trim() || !!v.pageId, {
    message: "Informe palavra-chave ou anunciante.",
  });
export const searchAdsPage = createServerFn({ method: "POST" })
  .validator(input)
  .handler(async ({ data }) => {
    setResponseHeaders(new Headers({ "Cache-Control": "no-store" }));
    return collectPage(await researcher(), data);
  });
