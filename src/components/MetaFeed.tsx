import { useEffect, useState } from "react";
import { countries } from "../lib/offermind";
import { searchMetaLibrary } from "../lib/meta-library.functions";

type Query = Parameters<typeof searchMetaLibrary>[0]["data"];
type Page = Awaited<ReturnType<typeof searchMetaLibrary>>;
const control = "rounded-lg border border-[#303950] bg-[#0b101c] px-3 py-2 text-sm";
const initialTerms: Record<string,string> = { BR: "educação", PT: "educação", DE: "Bildung", FR: "éducation", ES: "educación" };

function Results({term, country, platform, media}: Query) {
  const [page, setPage] = useState<Page>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      searchMetaLibrary({data: {term, country, platform, media}})
        .then(result => { if (active) setPage(result); })
        .catch(e => { if (active) setError(e instanceof Error ? e.message : "Falha ao carregar anúncios."); });
    }, 400);
    return () => { active = false; clearTimeout(timer); };
  }, [term, country, platform, media, retry]);

  async function more() {
    if (!page?.after || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const next = await searchMetaLibrary({data: {term, country, platform, media, after: page.after}});
      setPage({...next, ads: [...new Map([...page.ads, ...next.ads].map(ad => [ad.id, ad])).values()]});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar mais anúncios.");
    } finally { setLoadingMore(false); }
  }
  return <div className="space-y-4" aria-live="polite">
    {error && <p role="alert">{error} {!page && <button className={control} onClick={() => {setError(""); setRetry(n => n+1);}}>Tentar novamente</button>}</p>}
    {!page && !error && <p>Carregando anúncios…</p>}
    {page?.ads.length === 0 && <p>Nenhum anúncio encontrado. Altere a pesquisa ou os filtros.</p>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{page?.ads.map(ad =>
      <article key={ad.id} className="space-y-3 rounded-xl border border-[#252c40] bg-[#101625] p-4">
        <h2 className="font-semibold">{ad.page_name || "Anunciante"}</h2>
        <p className="line-clamp-6 text-sm text-slate-300">{ad.ad_creative_bodies?.[0]}</p>
        <a className="text-sm text-violet-300 underline" target="_blank" rel="noreferrer" href={"https://www.facebook.com/ads/library/?id="+ad.id}>Ver anúncio original</a>
      </article>)}</div>
    {page?.after && <button className={control} disabled={loadingMore} onClick={more}>{loadingMore ? "Carregando…" : "Carregar mais anúncios"}</button>}
  </div>;
}

export default function MetaFeed({country, onCountry}: {country: string; onCountry: (value: string) => void}) {
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<Query["platform"]>();
  const [media, setMedia] = useState<Query["media"]>();
  const term = query.trim() || initialTerms[country] || "education";
  return <section className="space-y-4">
    <div className="flex flex-wrap gap-3">
      <input className={control+" flex-1"} aria-label="Pesquisar anúncios da Meta" placeholder={"Pesquisar anúncios · "+term} maxLength={150} value={query} onChange={e=>setQuery(e.target.value)}/>
      <select aria-label="Mercado" className={control} value={country} onChange={e=>onCountry(e.target.value)}>{countries.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>
      <select aria-label="Plataforma" className={control} value={platform || ""} onChange={e=>setPlatform(e.target.value as Query["platform"] || undefined)}><option value="">Todas as plataformas</option><option value="FACEBOOK">Facebook</option><option value="INSTAGRAM">Instagram</option></select>
      <select aria-label="Formato" className={control} value={media || ""} onChange={e=>setMedia(e.target.value as Query["media"] || undefined)}><option value="">Todos os formatos</option><option value="IMAGE">Imagem</option><option value="VIDEO">Vídeo</option></select>
    </div>
    <Results key={JSON.stringify([term,country,platform,media])} term={term} country={country as Query["country"]} platform={platform} media={media}/>
  </section>;
}
