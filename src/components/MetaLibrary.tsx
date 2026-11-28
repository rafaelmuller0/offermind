import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMarketCoverageNote, type MetaAdItem, type MetaCountry } from "../lib/meta-library";
import { searchMetaLibrary } from "../lib/meta-library.functions";

export default function MetaLibrary({ country }: { country: string }) {
  const searchFn = useServerFn(searchMetaLibrary);
  const [term, setTerm] = useState("");
  const [result, setResult] = useState<{ ads: MetaAdItem[]; after?: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function search(after?: string) {
    if (busy || !term.trim()) return;
    setBusy(true);
    setError("");
    if (!after) setResult(undefined);
    try {
      const next = await searchFn({
        data: { term, country: country as MetaCountry, ...(after ? { after } : {}) },
      });
      if (!next.ok) {
        setError(next.message);
        return;
      }
      setResult((previous) =>
        after && previous
          ? {
              ...(next.after ? { after: next.after } : {}),
              ads: [...new Map([...previous.ads, ...next.ads].map((ad) => [ad.id, ad])).values()],
            }
          : { ...(next.after ? { after: next.after } : {}), ads: next.ads },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível consultar a Meta.");
    } finally {
      setBusy(false);
    }
  }
  return <section className="mb-4 space-y-3 rounded-2xl border border-[#252c40] bg-[#101625] p-5">
    <h2 className="font-semibold">Biblioteca de Anúncios da Meta</h2>
    <p className="text-sm text-slate-400">Anúncios ativos no mercado {country}. Para anúncios que não alcançaram a União Europeia, a API cobre apenas temas sociais, eleições e política.</p>
    <form className="flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); void search(); }}>
      <input aria-label="Palavra-chave na Biblioteca da Meta" className="rounded-lg bg-[#0b101c] px-3 py-2" placeholder="Palavra-chave" maxLength={150} value={term} disabled={busy} onChange={event => { setTerm(event.target.value); setResult(undefined); setError(""); }} />
      <button className="rounded-lg bg-violet-600 px-4 py-2 disabled:opacity-50" disabled={busy || !term.trim()}>{busy ? "Consultando…" : "Pesquisar na Meta"}</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {result?.ads.length === 0 && (
      <div className="space-y-1 text-sm text-slate-300">
        <p>Nenhum anúncio encontrado para esta consulta.</p>
        <p className="text-xs text-slate-400">{getMarketCoverageNote(country)}</p>
      </div>
    )}
    {result?.ads.map(ad => <article key={ad.id} className="border-t border-slate-700 pt-3">
      <strong>{ad.page_name || "Anunciante"}</strong><p>{ad.ad_creative_bodies?.[0]}</p>
      <a className="text-violet-300 underline" href={"https://www.facebook.com/ads/library/?id=" + ad.id} target="_blank" rel="noreferrer">Ver anúncio original</a>
    </article>)}
    {result?.after && <button disabled={busy} onClick={() => void search(result.after)}>Carregar mais anúncios</button>}
  </section>;
}
