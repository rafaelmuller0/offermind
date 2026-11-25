import { age, safeUrl, type Rules } from "./offermind";
export type FoundAd={id:string;pageId:string;advertiser:string;destination:string;title:string;body:string;start:string;observed:string;country:string;format:string;thumbnail?:string;video?:string;platforms?:string[]};
export type SearchPage={ads:FoundAd[];next:string;total:number|null;observed:string;skipped:number};
export type Candidate={key:string;advertiser:string;destination:string;title:string;ads:FoundAd[];windowAds:FoundAd[];variations:number;meetsVolume:boolean;meetsWindow:boolean};
type Obj=Record<string,unknown>;
const obj=(v:unknown):Obj=>v&&typeof v==="object"&&!Array.isArray(v)?v as Obj:{};
const str=(v:unknown)=>typeof v==="string"?v.trim():"";
const id=(v:unknown)=>typeof v==="string"&&/^\d+$/.test(v)?v:typeof v==="number"&&Number.isSafeInteger(v)&&v>0?String(v):"";
const tracking=/^(utm_.+|fbclid|gclid|msclkid|igshid|ttclid)$/i;
export function normalizeDestination(v:unknown){const s=safeUrl(str(v));if(!s)return "";const u=new URL(s);if(/(^|\.)facebook\.com$|(^|\.)instagram\.com$/i.test(u.hostname)||u.username||u.password)return "";for(const k of [...u.searchParams.keys()])if(tracking.test(k))u.searchParams.delete(k);u.searchParams.sort();u.hash="";return u.toString()}
const mediaUrl=(v:unknown)=>{const url=safeUrl(str(v));if(!url)return "";const u=new URL(url);return u.protocol==="https:"&&(/(^|\\.)fbcdn\\.net$|(^|\\.)fbsbx\\.com$/i.test(u.hostname))?url:""};
const firstObj=(v:unknown)=>Array.isArray(v)?obj(v[0]):{};
export function parsePage(value:unknown,country:string,observed:string):SearchPage{
 const root=obj(value);const info=obj(root["search_information"]);const total=typeof info["total_results"]==="number"&&Number.isSafeInteger(info["total_results"])&&info["total_results"]>=0?info["total_results"]:null;
 if(!Array.isArray(root["ads"])&&total!==0)throw Error("O fornecedor não retornou uma lista de anúncios reconhecida.");
 const rows=Array.isArray(root["ads"])?root["ads"]:[];const ads:FoundAd[]=[];let skipped=0;
 for(const row of rows){const a=obj(row),s=obj(a["snapshot"]);const adId=id(a["ad_archive_id"]),pageId=id(a["page_id"])||id(s["page_id"]);const start=str(a["start_date"]).slice(0,10);if(!adId||!pageId||a["is_active"]!==true||age(start,observed)===null){skipped++;continue}
 const links=new Set<string>();const direct=normalizeDestination(s["link_url"]);if(direct)links.add(direct);if(Array.isArray(s["cards"]))for(const c of s["cards"]){const link=normalizeDestination(obj(c)["link_url"]);if(link)links.add(link)}
 const destination=links.size===1?[...links][0]||"":"";
 const image=firstObj(s["images"]),video=firstObj(s["videos"]),card=firstObj(s["cards"]);const thumbnail=[video["video_preview_image_url"],image["resized_image_url"],image["original_image_url"],card["video_preview_image_url"],card["resized_image_url"],card["original_image_url"]].map(mediaUrl).find(Boolean)||"";const videoUrl=[video["video_sd_url"],video["video_hd_url"],card["video_sd_url"],card["video_hd_url"]].map(mediaUrl).find(Boolean)||"";const platforms=Array.isArray(a["publisher_platform"])?a["publisher_platform"].filter((x):x is string=>typeof x==="string"):[];
 ads.push({thumbnail,video:videoUrl,platforms,id:adId,pageId,advertiser:str(s["page_name"])||str(a["page_name"])||"Anunciante "+pageId,destination,title:str(s["title"]).slice(0,400),body:str(obj(s["body"])["text"]).slice(0,3000),start,observed,country,format:str(s["display_format"])||"Desconhecido"});
 }
 return {ads,next:str(obj(root["pagination"])["next_page_token"]),total,observed,skipped};
}
export function groupCandidates(ads:FoundAd[],rules:Rules):Candidate[]{
 const unique=new Map<string,FoundAd>();const conflicted=new Set<string>();for(const a of ads){if(a.country!==rules.country)continue;const key=a.country+"|"+a.id;const prev=unique.get(key);if(prev&&(prev.destination!==a.destination||prev.pageId!==a.pageId))conflicted.add(key);else unique.set(key,a)}
 const groups=new Map<string,FoundAd[]>();for(const [id,a] of unique){if(conflicted.has(id)||!a.destination)continue;const key=a.pageId+"|"+a.destination;const list=groups.get(key)||[];list.push(a);groups.set(key,list)}
 return [...groups].map(([key,list])=>{const first=list[0]!;const windowAds=list.filter(a=>{const n=age(a.start,a.observed);return n!==null&&n>=rules.minAge&&n<=rules.maxAge});const variations=new Set(windowAds.map(a=>(a.title+" "+a.body).trim().replace(/\s+/g," ").toLowerCase()).filter(Boolean)).size;return {key,advertiser:first.advertiser,destination:first.destination,title:list.find(a=>a.title&&!a.title.includes("{{"))?.title||new URL(first.destination).hostname,ads:list,windowAds,variations,meetsVolume:list.length>=rules.minAds,meetsWindow:windowAds.length>=rules.minWindow}}).sort((a,b)=>Number(b.meetsVolume&&b.meetsWindow)-Number(a.meetsVolume&&a.meetsWindow)||b.ads.length-a.ads.length||b.windowAds.length-a.windowAds.length)
}
