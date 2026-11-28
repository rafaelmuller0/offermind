import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Clock, ExternalLink, KeyRound, Loader2, RefreshCw, Search, SearchX } from "lucide-react";
import { countries } from "../lib/offermind";
import {
  getMarketCoverageNote,
  initialMetaTerm,
  type MetaAdItem,
  type MetaCountry,
  type MetaLibraryErrorCode,
  type MetaMediaType,
  type MetaPlatform,
} from "../lib/meta-library";
import { searchMetaLibrary } from "../lib/meta-library.functions";

const control =
  "min-w-0 rounded-lg border border-[#283246] bg-[#090e19] px-3 py-2.5 text-sm text-[#e5eaf3] outline-none focus:border-violet-400";
const btn =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-[#303950] bg-[#111827] px-3 py-2.5 text-sm text-[#cbd5e1] transition hover:border-violet-400 hover:text-white disabled:opacity-40";

type FeedError = { code: MetaLibraryErrorCode; message: string };

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "AN"
  );
}

export default function MetaFeed({ country, onCountry }: { country: string; onCountry: (value: string) => void }) {
  const searchFn = useServerFn(searchMetaLibrary);
  const [query, setQuery] = useState(() => initialMetaTerm(country));
  const [platform, setPlatform] = useState<MetaPlatform | undefined>();
  const [media, setMedia] = useState<MetaMediaType | undefined>();
  const [ads, setAds] = useState<MetaAdItem[]>([]);
  const [after, setAfter] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<FeedError | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const requestIdRef = useRef(0);
  const prevCountryRef = useRef(country);
  const prevTermRef = useRef(query);

  function handleCountryChange(nextCountry: string) {
    const previousDefault = initialMetaTerm(country);
    prevCountryRef.current = nextCountry;
    setQuery((current) => {
      const trimmed = current.trim();
      return !trimmed || trimmed === previousDefault ? initialMetaTerm(nextCountry) : current;
    });
    onCountry(nextCountry);
  }

  useEffect(() => {
    if (prevCountryRef.current !== country) {
      const previousDefault = initialMetaTerm(prevCountryRef.current);
      prevCountryRef.current = country;
      setQuery((current) => {
        const trimmed = current.trim();
        return !trimmed || trimmed === previousDefault ? initialMetaTerm(country) : current;
      });
    }
  }, [country]);

  const trimmedTerm = query.trim();

  useEffect(() => {
    const reqId = ++requestIdRef.current;
    const termChanged = prevTermRef.current !== trimmedTerm;
    prevTermRef.current = trimmedTerm;

    if (!trimmedTerm) {
      setLoading(false);
      setLoadingMore(false);
      setError(null);
      setAds([]);
      setAfter(undefined);
      setHasLoaded(false);
      return;
    }

    setLoading(true);
    setLoadingMore(false);
    setError(null);

    const delay = termChanged ? 400 : 0;
    const timer = setTimeout(() => {
      searchFn({
        data: {
          term: trimmedTerm,
          country: country as MetaCountry,
          ...(platform ? { platform } : {}),
          ...(media ? { media } : {}),
        },
      })
        .then((result) => {
          if (reqId !== requestIdRef.current) return;
          if (result.ok) {
            setAds(result.ads);
            setAfter(result.after);
            setError(null);
            setHasLoaded(true);
          } else {
            setAds([]);
            setAfter(undefined);
            setError({ code: result.code, message: result.message });
            setHasLoaded(true);
          }
        })
        .catch(() => {
          if (reqId !== requestIdRef.current) return;
          setAds([]);
          setAfter(undefined);
          setError({
            code: "network_error",
            message: "Não foi possível consultar a Biblioteca da Meta. Tente novamente.",
          });
          setHasLoaded(true);
        })
        .finally(() => {
          if (reqId === requestIdRef.current) setLoading(false);
        });
    }, delay);

    return () => clearTimeout(timer);
  }, [trimmedTerm, country, platform, media, retryCount, searchFn]);

  async function handleLoadMore() {
    if (!after || loading || loadingMore || !trimmedTerm) return;
    const reqId = requestIdRef.current;
    setLoadingMore(true);
    setError(null);
    try {
      const result = await searchFn({
        data: {
          term: trimmedTerm,
          country: country as MetaCountry,
          ...(platform ? { platform } : {}),
          ...(media ? { media } : {}),
          after,
        },
      });
      if (reqId !== requestIdRef.current) return;
      if (result.ok) {
        setAds((prev) => [...new Map([...prev, ...result.ads].map((ad) => [ad.id, ad])).values()]);
        setAfter(result.after);
      } else {
        setError({ code: result.code, message: result.message });
      }
    } catch {
      if (reqId !== requestIdRef.current) return;
      setError({
        code: "network_error",
        message: "Falha ao carregar mais anúncios. Tente novamente.",
      });
    } finally {
      if (reqId === requestIdRef.current) setLoadingMore(false);
    }
  }

  function renderError(err: FeedError) {
    const isTokenError = err.code === "missing_token" || err.code === "invalid_token";
    const isRateLimit = err.code === "rate_limit";
    const title =
      err.code === "missing_token"
        ? "Token da Meta não configurado"
        : err.code === "invalid_token"
          ? "Token da Meta inválido ou expirado"
          : isRateLimit
            ? "Limite de chamadas atingido"
            : "Não foi possível consultar a Meta";
    const detail =
      err.code === "missing_token"
        ? "Cadastre o segredo META_AD_LIBRARY_ACCESS_TOKEN em Configurações do Projeto → Secrets (ou pelo formulário seguro no chat) e tente novamente."
        : err.code === "invalid_token"
          ? "Atualize o segredo META_AD_LIBRARY_ACCESS_TOKEN com um token válido com acesso à Biblioteca de Anúncios da Meta."
          : isRateLimit
            ? "A API oficial da Meta limitou temporariamente novas consultas. Aguarde alguns instantes antes de tentar novamente."
            : err.message;
    const Icon = isTokenError ? KeyRound : isRateLimit ? Clock : AlertTriangle;

    return (
      <div
        role="alert"
        className="rounded-2xl border border-amber-500/30 bg-[#101625] p-6 text-left"
      >
        <div className="flex items-start gap-3">
          <Icon size={20} className="mt-0.5 shrink-0 text-amber-300" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <h2 className="text-base font-semibold text-white">{title}</h2>
            <p className="text-sm text-[#cbd5e1]">{err.message}</p>
            {detail !== err.message && <p className="text-xs text-[#94a3b8]">{detail}</p>}
            <div className="pt-2">
              <button
                type="button"
                className={btn}
                onClick={() => setRetryCount((n) => n + 1)}
              >
                <RefreshCw size={15} /> Tentar novamente
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-[#252c40] bg-[#0d111c] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-[220px] flex-1">
            <Search size={17} className="absolute left-3 top-3 text-[#8794ab]" />
            <input
              className={`${control} w-full pl-10`}
              aria-label="Pesquisar anúncios da Meta"
              placeholder="Digite um termo para pesquisar na Biblioteca da Meta..."
              maxLength={150}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="Mercado"
            className={control}
            value={country}
            onChange={(e) => handleCountryChange(e.target.value)}
          >
            {countries.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select
            aria-label="Plataforma"
            className={control}
            value={platform ?? ""}
            onChange={(e) => setPlatform((e.target.value as MetaPlatform) || undefined)}
          >
            <option value="">Todas as plataformas</option>
            <option value="FACEBOOK">Facebook</option>
            <option value="INSTAGRAM">Instagram</option>
          </select>
          <select
            aria-label="Formato"
            className={control}
            value={media ?? ""}
            onChange={(e) => setMedia((e.target.value as MetaMediaType) || undefined)}
          >
            <option value="">Todos os formatos</option>
            <option value="IMAGE">Imagem</option>
            <option value="VIDEO">Vídeo</option>
          </select>
        </div>
      </div>

      <div className="space-y-4" aria-live="polite">
        {!trimmedTerm && (
          <div className="rounded-2xl border border-dashed border-[#303950] bg-[#101625] px-5 py-12 text-center">
            <p className="text-sm text-[#94a3b8]">
              Digite um termo no campo de pesquisa para consultar anúncios ativos na Biblioteca da Meta.
            </p>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-[#cbd5e1]">
              <Loader2 size={16} className="animate-spin text-[#a78bfa]" />
              <span>Consultando anúncios ativos na Biblioteca da Meta…</span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((idx) => (
                <div
                  key={idx}
                  className="h-44 animate-pulse rounded-xl border border-[#252c40] bg-[#0d111c] p-4"
                />
              ))}
            </div>
          </div>
        )}

        {!loading && error && renderError(error)}

        {!loading && !error && hasLoaded && trimmedTerm && ads.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#303950] bg-[#101625] px-6 py-12 text-center">
            <SearchX size={36} className="mx-auto mb-3 text-[#a78bfa]" />
            <h2 className="text-lg font-semibold text-white">Nenhum anúncio encontrado</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-[#cbd5e1]">
              A Meta não retornou anúncios ativos para “{trimmedTerm}” no mercado {country}.
            </p>
            <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-[#94a3b8]">
              {getMarketCoverageNote(country)}
            </p>
          </div>
        )}

        {!loading && ads.length > 0 && (
          <>
            <div className="text-sm text-[#94a3b8]">
              <b className="text-white">{ads.length}</b> anúncios exibidos para “{trimmedTerm}” · {country}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {ads.map((ad) => {
                const advertiser = ad.page_name?.trim() || "Anunciante";
                const bodyText =
                  ad.ad_creative_bodies?.find((line) => line.trim().length > 0)?.trim() ||
                  "Texto criativo indisponível neste anúncio.";
                return (
                  <article
                    key={ad.id}
                    className="flex flex-col justify-between gap-4 rounded-xl border border-[#252c40] bg-[#0d111c] p-4 transition hover:border-[#65518b]"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violet-600/30 text-xs font-bold text-[#c4b5fd]">
                          {initials(advertiser)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h2 className="truncate text-sm font-semibold text-white">{advertiser}</h2>
                          <p className="text-[11px] text-[#94a3b8]">Biblioteca da Meta · {country}</p>
                        </div>
                      </div>
                      <p className="line-clamp-6 whitespace-pre-line text-sm leading-relaxed text-[#cbd5e1]">
                        {bodyText}
                      </p>
                    </div>
                    <a
                      className={`${btn} w-full !text-xs`}
                      target="_blank"
                      rel="noreferrer"
                      href={`https://www.facebook.com/ads/library/?id=${ad.id}`}
                    >
                      <ExternalLink size={14} /> Ver anúncio original
                    </a>
                  </article>
                );
              })}
            </div>
          </>
        )}

        {!loading && after && (
          <button
            type="button"
            className={`${btn} mx-auto flex`}
            disabled={loadingMore}
            onClick={() => void handleLoadMore()}
          >
            {loadingMore ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Carregando mais…
              </>
            ) : (
              "Carregar mais"
            )}
          </button>
        )}
      </div>
    </section>
  );
}
