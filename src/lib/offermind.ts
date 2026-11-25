export type Ad = { id:string; offerId:string; country:string; status:"active"|"inactive"|"unknown"; start:string; observed:string; source:string; headline:string; concept:string; reviewed:boolean; format:string };
export type Offer = { id:string; name:string; advertiser:string; niche:string; country:string; promise:string; url:string; pageTotal:number|null; favorite:boolean; monitored:boolean; notes:string; stage:string };
export type Rules = { country:string; minAds:number; minAge:number; maxAge:number; minWindow:number; minConcepts:number };
export const defaults:Rules={country:"US",minAds:41,minAge:14,maxAge:30,minWindow:5,minConcepts:3};
export const stages=["Descoberta","Investigação","Selecionada","Planejamento","MVP","Desenvolvimento","Testes","Lançamento","Arquivada"];
export const countries=[["US","Estados Unidos"],["BR","Brasil"],["GB","Reino Unido"],["CA","Canadá"],["AU","Austrália"],["DE","Alemanha"],["FR","França"],["ES","Espanha"],["PT","Portugal"]];
export const day=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+"T00:00:00Z").toString()!=="Invalid Date"&&new Date(value+"T00:00:00Z").toISOString().slice(0,10)===value?Date.parse(value+"T00:00:00Z"):NaN;
export function age(start:string,observed:string){const n=(day(observed)-day(start))/86400000;return Number.isFinite(n)&&n>=0?n:null}
export function safeUrl(input:string){try{const u=new URL(input);return u.protocol==="https:"||u.protocol==="http:"?u.href:""}catch{return ""}}
export function adLibrary(country:string,keyword:string){return "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&media_type=all&country="+encodeURIComponent(country)+"&search_type=keyword_unordered&q="+encodeURIComponent(keyword)}
export function evaluate(offer:Offer,ads:Ad[],rules:Rules=defaults,asOf?:string){
 const unique=new Map<string,Ad>();for(const a of ads){if(a.offerId!==offer.id||a.country!==rules.country||!a.id.trim()||!safeUrl(a.source)||!Number.isFinite(day(a.observed)))continue;const old=unique.get(a.id);if(!old||day(a.observed)>=day(old.observed))unique.set(a.id,a)}
 const records=[...unique.values()].filter(a=>a.status==="active"&&age(a.start,a.observed)!==null);
 const date=asOf||[...unique.values()].map(a=>a.observed).sort().at(-1)||"";
 const current=records.filter(a=>a.observed===date);
 const windowAds=current.filter(a=>{const n=age(a.start,date);return n!==null&&n>=rules.minAge&&n<=rules.maxAge});
 const concepts=new Set(windowAds.filter(a=>a.reviewed&&a.concept.trim()).map(a=>a.concept.trim().toLowerCase())).size;
 const checks=[{label:"Anúncios ativos associados",value:current.length,target:rules.minAds},{label:"Anúncios na janela",value:windowAds.length,target:rules.minWindow},{label:"Conceitos revisados na janela",value:concepts,target:rules.minConcepts}];
 const passed=checks.every(c=>c.value>=c.target);
 return {active:current.length,window:windowAds.length,concepts,date,checks,passed,status:passed?"Critérios atendidos (importação)":current.length?"Parcial / evidência insuficiente":"Indeterminada",records:current,windowAds};
}
export function parseAds(raw:string,offer:Offer):Ad[]{
 const input:unknown=JSON.parse(raw);if(!Array.isArray(input))throw Error("Importe uma lista JSON de anúncios.");
 if(input.length>10000)throw Error("Limite: 10.000 registros por importação.");
 return input.map((v:unknown,i:number)=>{if(!v||typeof v!=="object")throw Error("Registro "+(i+1)+" inválido.");const a=v as Record<string,unknown>;const get=(k:string)=>typeof a[k]==="string"?(a[k] as string).trim():"";const id=get("id"),start=get("start"),observed=get("observed"),source=safeUrl(get("source")),country=get("country"),status=get("status");if(!id||!source||!countries.some(c=>c[0]===country)||!["active","inactive","unknown"].includes(status)||age(start,observed)===null||day(observed)>day(new Date().toISOString().slice(0,10)))throw Error("Registro "+(i+1)+": ID, país, status, datas ISO e URL válidos são obrigatórios.");if(country!==offer.country)throw Error("Registro "+(i+1)+": país diferente da oferta.");return {id,offerId:offer.id,country,status:status as Ad["status"],start,observed,source,headline:get("headline"),concept:get("concept"),reviewed:false,format:get("format")||"Desconhecido"};});
}
export function mergeAds(old:Ad[],incoming:Ad[]){const map=new Map(old.map(a=>[a.offerId+"|"+a.country+"|"+a.id+"|"+a.observed,a]));for(const a of incoming){const k=a.offerId+"|"+a.country+"|"+a.id+"|"+a.observed;map.set(k,a)}return [...map.values()]}
export const blankOffer=():Offer=>({id:"",name:"",advertiser:"",niche:"",country:"US",promise:"",url:"",pageTotal:null,favorite:false,monitored:false,notes:"",stage:"Descoberta"});
