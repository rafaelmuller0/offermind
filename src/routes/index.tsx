import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef,useState,type FormEvent } from "react";
import { ArrowUpRight, CalendarDays, ExternalLink, Globe2, ImageOff, Loader2, Search, ShieldCheck } from "lucide-react";
import { searchLibrary } from "../lib/library-search.functions";
import { type FoundAd } from "../lib/discovery";
import { countries,safeUrl,adLibrary } from "../lib/offermind";
import { destinationLabel } from "../lib/offer-links";

export const Route=createFileRoute("/")({head:()=>({meta:[{title:"OfferMind | Biblioteca de anúncios"},{name:"description",content:"Pesquise anúncios comerciais ativos na Biblioteca de Anúncios."}]}),component:Index});
type Country="BR"|"US"|"GB"|"CA"|"AU"|"DE"|"FR"|"ES"|"PT";
type Filters={country:Country;keyword:string;platform:"all"|"facebook"|"instagram";media:"all"|"image"|"video"};
const initial:Filters={country:"BR",keyword:"",platform:"all",media:"all"};
const field="w-full min-w-0 rounded-xl border border-[#343053] bg-[#08091A] px-3.5 py-3 text-sm text-slate-100 focus-visible:outline-2 focus-visible:outline-[#BA48F6] disabled:opacity-60";
const primary="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7C20E9] to-[#6A37F0] px-5 py-3 text-sm font-semibold text-white hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 disabled:opacity-50";
function mediaUrl(raw:string|undefined){const url=safeUrl(raw||"");if(!url)return "";const u=new URL(url);return u.protocol==="https:"&&/(^|\.)(fbcdn\.net|fbsbx\.com)$/i.test(u.hostname)?url:""}
function Creative({ad}:{ad:FoundAd}){
 const [failed,setFailed]=useState(false);const [playing,setPlaying]=useState(false);
 const image=mediaUrl(ad.thumbnail),video=mediaUrl(ad.video);
 return <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-[#111228]">
 {playing&&video&&!failed?<video src={video} controls autoPlay playsInline preload="none" className="h-full w-full object-contain" onError={()=>setFailed(true)}/>:image&&!failed?<img src={image} alt="Criativo do anúncio" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-contain" onError={()=>setFailed(true)}/>:<div className="text-center text-xs text-slate-400"><ImageOff size={27} className="mx-auto mb-2"/>Mídia indisponível</div>}
 {!playing&&video&&!failed&&<button type="button" onClick={()=>setPlaying(true)} className="absolute bottom-3 right-3 rounded-lg bg-black/80 px-3 py-2 text-xs text-white">Reproduzir vídeo</button>}
 </div>
}
export function Index(){
 const search=useServerFn(searchLibrary);
 const [draft,setDraft]=useState<Filters>(initial);const [applied,setApplied]=useState<Filters|null>(null);
 const [ads,setAds]=useState<FoundAd[]>([]);const [cursor,setCursor]=useState("");const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");const [skipped,setSkipped]=useState(0);const [observed,setObserved]=useState("");const [total,setTotal]=useState<number|null>(null);
 const lock=useRef(false);
 function change<K extends keyof Filters>(key:K,value:Filters[K]){setDraft(d=>({...d,[key]:value}))}
 async function load(filters:Filters,more=false){
  if(lock.current)return;
  const keyword=filters.keyword.trim();if(!keyword)return;
  const next=more?cursor:"";if(more&&!next)return;
  lock.current=true;setBusy(true);setError("");
  if(!more){setApplied({...filters,keyword});setAds([]);setCursor("");setSkipped(0);setObserved("");setTotal(null)}
  try{
   const result=await search({data:{...filters,keyword,cursor:next}});
   if(!result.ok){setError(result.message);return;}
   const p=result.page;
   setAds(old=>[...new Map([...(more?old:[]),...p.ads].map(a=>[a.id,a])).values()]);
   setCursor(p.next===next?"":p.next);setSkipped(s=>(more?s:0)+p.skipped);setObserved(p.observed);setTotal(p.total);
  }catch{setError("Não foi possível acessar o servidor. Tente novamente.")}
  finally{lock.current=false;setBusy(false)}
 }
 function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();void load(draft)}
 return <main className="min-h-screen bg-[#050515] text-slate-100 [color-scheme:dark]">
 <header className="border-b border-[#24213F] bg-[#09091D]"><div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-5"><div className="flex items-center gap-3"><svg width="44" height="44" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="om-ring" x1="0%" y1="100%" x2="90%" y2="0%"><stop stopColor="#7620F0"/><stop offset=".48" stopColor="#B54DF8"/><stop offset="1" stopColor="#00E7F3"/></linearGradient></defs><circle cx="24" cy="24" r="20" fill="none" stroke="url(#om-ring)" strokeWidth="5"/><path d="M12 36V20L24 31L36 20V36" stroke="url(#om-ring)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"/><path d="M19 16V12M24 16V9M29 16V6" stroke="#00E7F3" strokeWidth="3" strokeLinecap="round"/></svg><div><div className="text-xl font-bold tracking-tight">Offer<span className="bg-gradient-to-r from-[#B84CF6] via-[#795DF9] to-[#00DDF2] bg-clip-text text-transparent">Mind</span></div><div className="text-[10px] font-medium uppercase tracking-widest text-slate-400">Ad intelligence</div></div></div><span className="hidden items-center gap-2 text-xs text-slate-400 sm:flex"><ShieldCheck size={16}/> Pesquisa comercial</span></div></header>
 <div className="mx-auto max-w-[1440px] space-y-6 px-5 py-8 md:px-9 md:py-12">
 <section className="rounded-3xl border border-[#453074] bg-gradient-to-br from-[#26104F] via-[#100C2B] to-[#082B40] p-6 md:p-9"><p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-violet-300"><Globe2 size={15}/> Biblioteca de anúncios</p><h1 className="text-3xl font-bold tracking-tight md:text-5xl">Encontre anúncios reais.</h1><p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-300 md:text-base">Pesquise anúncios ativos por palavra-chave, mercado e formato. Consulte a origem de cada resultado.</p>
 <form onSubmit={submit} className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,2fr)_1fr_1fr_1fr_auto] lg:items-end">
 <label className="sm:col-span-2 lg:col-span-1"><span className="mb-2 block text-xs font-medium text-slate-300">Palavra-chave</span><input required maxLength={150} className={field} placeholder="Ex.: extensão de cílios" value={draft.keyword} disabled={busy} onChange={e=>change("keyword",e.target.value)}/></label>
 <label><span className="mb-2 block text-xs font-medium text-slate-300">Mercado</span><select className={field} disabled={busy} value={draft.country} onChange={e=>change("country",e.target.value as Country)}>{countries.map(([c,n])=><option key={c} value={c}>{n}</option>)}</select></label>
 <label><span className="mb-2 block text-xs font-medium text-slate-300">Plataforma</span><select className={field} disabled={busy} value={draft.platform} onChange={e=>change("platform",e.target.value as Filters["platform"])}><option value="all">Todas</option><option value="facebook">Facebook</option><option value="instagram">Instagram</option></select></label>
 <label><span className="mb-2 block text-xs font-medium text-slate-300">Formato</span><select className={field} disabled={busy} value={draft.media} onChange={e=>change("media",e.target.value as Filters["media"])}><option value="all">Todos</option><option value="image">Imagem</option><option value="video">Vídeo</option></select></label>
 <button type="submit" className={primary} disabled={busy||!draft.keyword.trim()}>{busy?<Loader2 size={18} className="animate-spin"/>:<Search size={18}/>} Pesquisar</button>
 </form></section>
 <section aria-live="polite" aria-busy={busy} className="space-y-4">
 {busy&&<div role="status" className="flex items-center gap-3 rounded-xl border border-slate-700 p-4 text-sm"><Loader2 size={18} className="animate-spin text-violet-300"/>Consultando a fonte de anúncios…</div>}
 {error&&<div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-5"><h2 className="font-semibold text-amber-200">Pesquisa indisponível</h2><p className="mt-2 text-sm text-slate-300">{error}</p>{applied&&<a href={adLibrary(applied.country,applied.keyword)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm text-violet-300 underline">Consultar manualmente na Meta <ExternalLink size={14}/></a>}<p className="mt-2 text-xs text-slate-400">A consulta externa não preenche automaticamente este site.</p></div>}
 {applied&&observed&&<div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">{ads.length} anúncios exibidos <span className="text-sm font-normal text-slate-400">· {applied.keyword}</span></h2><p className="text-xs text-slate-400">Observação {observed}{total!==null?" · estimativa da fonte: "+total:""}{skipped?" · "+skipped+" registros inválidos omitidos":""}</p></div>}
 {!busy&&!error&&!ads.length&&<div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center"><Search size={32} className="mx-auto mb-4 text-violet-300"/><h2 className="text-lg font-semibold">{applied?"Nenhum anúncio exibido":"Comece uma pesquisa"}</h2><p className="mt-2 text-sm text-slate-400">{applied?"Altere os filtros ou carregue a próxima página, quando disponível.":"Informe uma palavra-chave e escolha os filtros acima."}</p></div>}
 {ads.length>0&&<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{ads.map(a=><article key={a.id} className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0F1025]"><div className="p-4"><h3 className="break-words font-semibold">{a.advertiser}</h3><p className="mt-1 text-xs text-slate-400">ID {a.id} · {a.country}</p></div><Creative ad={a}/><div className="space-y-3 p-4"><div className="flex flex-wrap gap-2 text-xs text-slate-300"><span className="rounded-md bg-[#24213F] px-2 py-1">Ativo na coleta</span><span className="rounded-md bg-slate-800 px-2 py-1">{a.format}</span>{(a.platforms||[]).map(p=><span key={p} className="rounded-md bg-slate-800 px-2 py-1">{p}</span>)}</div><p className="flex items-center gap-2 text-xs text-slate-400"><CalendarDays size={14}/> Início: {a.start}</p>{a.title&&<h4 className="break-words font-semibold">{a.title}</h4>}<p className="line-clamp-5 whitespace-pre-wrap break-words text-sm text-slate-300">{a.body||"Texto não disponibilizado pela fonte."}</p><a className="flex items-center gap-2 text-sm font-medium text-violet-300" href={"https://www.facebook.com/ads/library/?id="+encodeURIComponent(a.id)} target="_blank" rel="noreferrer">Anúncio original <ArrowUpRight size={15}/></a>{safeUrl(a.destination)&&<a className="block text-xs text-slate-300 underline" href={safeUrl(a.destination)} target="_blank" rel="noreferrer">{destinationLabel(a.destination)}</a>}</div></article>)}</div>}
 {cursor&&applied&&<button type="button" className={primary+" mx-auto flex"} disabled={busy} onClick={()=>void load(applied,true)}>{busy?"Carregando…":"Carregar mais anúncios"}</button>}
 </section><footer className="border-t border-slate-800 pt-4 text-xs leading-relaxed text-slate-400">Resultados da fonte autorizada, sujeitos a cobertura e disponibilidade. Atividade publicitária não comprova vendas ou lucro.</footer>
 </div></main>
}
