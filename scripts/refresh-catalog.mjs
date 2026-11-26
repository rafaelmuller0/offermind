import { writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parsePage,groupCandidates } from "../src/lib/discovery.ts";
import { defaults,age } from "../src/lib/offermind.ts";
const key=process.env.SEARCHAPI_API_KEY;
if(!key||process.env.OFFERMIND_CATALOG_ENABLED!=="true")throw Error("Coleta desabilitada: configure credencial e autorização de catálogo.");
const limit=18, country="US", observed=new Date().toISOString().slice(0,10);
const dateAgo=n=>new Date(Date.parse(observed+"T00:00:00Z")-n*86400000).toISOString().slice(0,10);
const terms=[["Pets","dog training plan"],["Educação","learn to read"],["Maternidade","baby sleep guide"],["Hobbies","crochet patterns"],["Organização","cleaning schedule"],["Educação","daily lessons"],["Hobbies","guitar practice"],["Produtos digitais","digital guide"],["Produtos digitais","personalized plan"],["Produtos digitais","30 day challenge"],["Profissões","client templates"],["Hobbies","garden planner"]];
const offset=(Math.floor(Date.parse(observed)/86400000)*3)%terms.length;
const chosen=[0,1,2].map(i=>terms[(offset+i)%terms.length]);
let calls=0;const found=[];const niches=new Map();const seenPages=new Map();let incomplete=false;
async function collect(q,pageId,niche,pages,dated){
 let cursor="";
 for(let i=0;i<pages&&calls<limit;i++){
  const params=new URLSearchParams({engine:"meta_ad_library",country:"us",ad_type:"all",active_status:"active",media_type:"all"});
  if(pageId)params.set("page_id",pageId);else params.set("q",q);
  if(cursor)params.set("next_page_token",cursor);
  if(dated){params.set("start_date",dateAgo(30));params.set("end_date",dateAgo(14))}
  const endpoint="https://www.searchapi.io/api/v1/search";const large=params.toString().length>3500;
  calls++;
  const response=await fetch(large?endpoint:endpoint+"?"+params.toString(),{method:large?"POST":"GET",headers:{Authorization:"Bearer "+key,Accept:"application/json","Content-Type":"application/json"},...(large?{body:JSON.stringify(Object.fromEntries(params))}:{}),redirect:"error",signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw Error("Fornecedor retornou HTTP "+response.status+" na consulta "+calls);
  const p=parsePage(await response.json(),country,observed);
  for(const a of p.ads){found.push(a);if(a.destination&&!pageId){const s=seenPages.get(a.pageId)||new Set();s.add(a.id);seenPages.set(a.pageId,s);niches.set(a.pageId,niche)}}
  if(!p.next){cursor="";break}if(p.next===cursor){incomplete=true;break}cursor=p.next;
 }
 if(cursor)incomplete=true;
}
for(const [niche,q] of chosen)await collect(q,"",niche,2,true);
const pages=[...seenPages].sort((a,b)=>b[1].size-a[1].size).slice(0,3);
if(seenPages.size>pages.length)incomplete=true;
for(const [id] of pages){if(calls>=limit){incomplete=true;break}await collect("",id,niches.get(id),4,false)}
const groups=groupCandidates(found,defaults).filter(c=>c.windowAds.length>=1).slice(0,60);
const offers=[],ads=[];
for(const c of groups){
 const first=c.ads[0];if(!first)continue;
 const id="catalog:"+createHash("sha256").update(country+"|"+c.key).digest("hex").slice(0,32);
 offers.push({id,name:c.title.slice(0,140),advertiser:c.advertiser,niche:niches.get(first.pageId)||"Produtos digitais (candidato)",country,promise:first.body.slice(0,350),url:c.destination,pageTotal:null,favorite:false,monitored:false,notes:"Catálogo automático. Associação candidata por anunciante e destino. Nicho sugerido pela pesquisa; conceitos visuais não verificados.",stage:"Investigação"});
 for(const a of c.ads)ads.push({id:a.id,offerId:id,country,status:"active",start:a.start,observed:a.observed,source:"https://www.facebook.com/ads/library/?id="+a.id,headline:a.title.slice(0,180),concept:"",reviewed:false,format:a.format,thumbnail:a.thumbnail||"",video:a.video||"",platforms:a.platforms||[]});
}
const result={version:1,generatedAt:new Date().toISOString(),provider:"SearchAPI",coverage:"partial",calls,offers,ads,matched:groups.filter(c=>c.meetsVolume&&c.meetsWindow).length,terms:chosen.map(x=>x[1])};
await mkdir("public",{recursive:true});await writeFile("public/offermind-catalog.json",JSON.stringify(result)+"\n");
console.log("Coleta concluída:",calls,"consultas;",offers.length,"candidatas;",result.matched,"com volume e idade observados. Cobertura limitada:",incomplete);
