import { z } from "zod";
import { countries, day, age, safeUrl, stages } from "./offermind";
const short=z.string().max(500);
const url=z.string().max(8192).refine(v=>v===""||!!safeUrl(v),"URL inválida");
const country=z.string().refine(v=>countries.some(c=>c[0]===v),"Mercado inválido");
const date=z.string().refine(v=>Number.isFinite(day(v)),"Data inválida");
const offer=z.object({id:z.string().min(1).max(10000),name:short.min(1),advertiser:short.min(1),niche:short,country,promise:z.string().max(10000),url,pageTotal:z.number().int().nonnegative().nullable(),favorite:z.boolean(),monitored:z.boolean(),notes:z.string().max(100000),stage:z.string().refine(v=>stages.includes(v)),microniche:short.optional(),productType:z.string().max(50).optional()});
const ad=z.object({id:z.string().min(1).max(256),offerId:z.string().min(1).max(10000),country,status:z.enum(["active","inactive","unknown"]),start:date,observed:date,source:url.refine(v=>!!v),headline:z.string().max(10000),concept:short,reviewed:z.boolean(),format:short,thumbnail:url.optional(),video:url.optional(),platforms:z.array(short).max(20).optional()}).refine(v=>age(v.start,v.observed)!==null&&day(v.observed)<=day(new Date().toISOString().slice(0,10)),"Data de anúncio inválida");
const offers=z.array(offer).max(5000);
const ads=z.array(ad).max(50000);
const rules=z.object({country,minAds:z.number().int().min(1).max(10000),minAge:z.number().int().min(0).max(3650),maxAge:z.number().int().min(0).max(3650),minWindow:z.number().int().min(1).max(10000),minConcepts:z.number().int().min(1).max(10000)}).refine(v=>v.minAge<=v.maxAge);
const history=z.array(z.object({term:z.string().max(1000),country,date:z.string().max(100)})).max(100);
const workspace=z.object({offers,ads,rules,history});
const catalog=z.object({version:z.literal(1),generatedAt:z.string().nullable(),coverage:z.string(),offers,ads,matched:z.number().int().nonnegative()});
function referencesValid(data:{offers:z.infer<typeof offers>;ads:z.infer<typeof ads>}) {
 const map=new Map(data.offers.map(o=>[o.id,o.country]));
 return map.size===data.offers.length&&data.ads.every(a=>map.get(a.offerId)===a.country);
}
export function readWorkspace(raw:string){if(raw.length>30*1024*1024)throw Error("Workspace acima do limite.");const data=workspace.parse(JSON.parse(raw));if(!referencesValid(data))throw Error("Evidências sem oferta correspondente.");return data;}
export function readCatalog(raw:unknown,market:string){const data=catalog.parse(raw);if(!referencesValid(data)||data.offers.some(o=>o.country!==market)||data.generatedAt!==null&&!Number.isFinite(Date.parse(data.generatedAt)))throw Error("Catálogo inválido.");return data;}
