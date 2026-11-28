import { age, type Ad, type Offer, type Rules, type evaluate } from "./offermind";
export type FeedItem = { o: Offer; e: ReturnType<typeof evaluate> };
export type CatalogFilters = {query:string;niche:string;platform:string;volume:string;period:string;format:string;fav:boolean;sort:string;microniche?:string;productType?:string;minWindow?:number};
export const initialFilters:CatalogFilters={query:"",niche:"all",platform:"all",volume:"all",period:"all",format:"all",fav:false,sort:"volume"};
export const normalize = (value:string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
export function matchesFormat(ad:Ad,format:string) {
 const f=normalize(ad.format||"");
 if(format==="all")return true;
 if(format==="video")return f.includes("video")||!!ad.video;
 if(format==="image")return /image|imagem|photo|foto/.test(f)||(!ad.video&&!!ad.thumbnail&&!/video|carousel|carrossel/.test(f));
 if(format==="carousel")return /carousel|carrossel/.test(f);
 return false;
}
export function matchesAd(ad:Ad,filters:CatalogFilters,rules:Rules) {
 if(filters.platform!=="all"&&!(ad.platforms||[]).some(p=>normalize(p)===filters.platform))return false;
 if(!matchesFormat(ad,filters.format))return false;
 if(filters.period==="all")return true;
 const days=age(ad.start,ad.observed);
 return days!==null&&(filters.period==="window"?days>=rules.minAge&&days<=rules.maxAge:filters.period==="30-60"?days>=30&&days<=60:filters.period==="60+"?days>60:days<=Number(filters.period));
}
export function filterCatalog<T extends FeedItem>(items:T[],rules:Rules,f:CatalogFilters):T[] {
 const tokens=normalize(f.query).split(/\s+/).filter(Boolean);
 const hasAdFilter=f.platform!=="all"||f.format!=="all"||f.period!=="all";
 return items.filter(({o,e})=>{
  if(o.country!==rules.country||f.niche!=="all"&&normalize(o.niche)!==normalize(f.niche)||f.fav&&!o.favorite)return false;
  if(f.volume!=="all"&&e.active<Number(f.volume))return false;
  if(f.microniche&&normalize(o.microniche||"")!==normalize(f.microniche))return false;
  if(f.productType&&f.productType!=="all"&&o.productType!==f.productType)return false;
  if(f.minWindow&&e.records.filter(a=>matchesAd(a,f,rules)).length<f.minWindow)return false;
  const haystack=normalize([o.name,o.advertiser,o.niche,o.microniche||"",o.productType||"",o.promise,o.url,...e.records.map(a=>a.headline)].join(" "));
  if(!tokens.every(t=>haystack.includes(t)))return false;
  return !hasAdFilter||e.records.some(a=>matchesAd(a,f,rules));
 }).sort((a,b)=>f.sort==="window"?b.e.window-a.e.window:f.sort==="recent"?b.e.date.localeCompare(a.e.date):b.e.active-a.e.active);
}
