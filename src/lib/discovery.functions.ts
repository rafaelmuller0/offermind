import { createServerFn } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { parsePage } from "./discovery";
const input=z.object({apiKey:z.string().min(8).max(256).regex(/^[A-Za-z0-9_-]+$/),country:z.enum(["US","BR","GB","CA","AU","DE","FR","ES","PT"]),keyword:z.string().max(150),pageId:z.string().max(32).regex(/^\d*$/),cursor:z.string().max(32000),start:z.string().regex(/^\d{4}-\d{2}-\d{2}$|^$/),end:z.string().regex(/^\d{4}-\d{2}-\d{2}$|^$/)}).refine(v=>!!v.keyword.trim()||!!v.pageId,{message:"Informe palavra-chave ou anunciante."});
export const searchAdsPage=createServerFn({method:"POST"}).validator(input).handler(async({data})=>{
 setResponseHeaders(new Headers({"Cache-Control":"no-store"}));
 const params=new URLSearchParams({engine:"meta_ad_library",country:data.country.toLowerCase(),ad_type:"all",active_status:"active",media_type:"all",sort_by:"impressions_high_to_low"});
 if(data.pageId)params.set("page_id",data.pageId);if(data.keyword.trim())params.set("q",data.keyword.trim());
 if(data.cursor)params.set("next_page_token",data.cursor);
 if(data.start)params.set("start_date",data.start);if(data.end)params.set("end_date",data.end);
 const endpoint="https://www.searchapi.io/api/v1/search";const large=params.toString().length>3500;let response:Response;try{response=await fetch(large?endpoint:endpoint+"?"+params.toString(),{method:large?"POST":"GET",headers:{Authorization:"Bearer "+data.apiKey,"Content-Type":"application/json",Accept:"application/json"},...(large?{body:JSON.stringify(Object.fromEntries(params))}:{}),signal:AbortSignal.timeout(25000),redirect:"error"})}catch{throw Error("Não foi possível acessar o provedor de anúncios. Tente novamente.")}
 if(!response.ok){throw Error(response.status===401||response.status===403?"Chave inválida ou sem permissão.":response.status===429?"Limite do provedor atingido.": "O provedor retornou erro HTTP "+response.status+".")}
 const raw:unknown=await response.json();return parsePage(raw,data.country,new Date().toISOString().slice(0,10));
});
