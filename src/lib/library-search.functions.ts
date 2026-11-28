import { createServerFn } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { collectPage } from "./provider.server";
import { researcher } from "./research-store.server";
import type { SearchPage } from "./discovery";

const input=z.object({
 country:z.enum(["BR","US","GB","CA","AU","DE","FR","ES","PT"]),
 keyword:z.string().trim().min(1).max(150),
 platform:z.enum(["all","facebook","instagram"]),
 media:z.enum(["all","image","video"]),
 cursor:z.string().max(32000)
});
export type LibraryResult={ok:true;page:SearchPage}|{ok:false;message:string};
const knownMessages=new Set([
 "Entre pelo acesso privado do OfferMind. A autenticação deve estar configurada pelo administrador.",
 "Sessão inválida.","Sessão expirada ou inválida.","Assinatura desconhecida.","Assinatura inválida.",
 "Não foi possível validar a sessão.","Armazenamento privado indisponível.","Falha no armazenamento privado.",
 "Operação de armazenamento recusada.","Limite diário de consultas atingido.",
 "Fonte comercial sem autorização configurada para este mercado.","Chave inválida ou sem permissão.",
 "Limite do provedor atingido.","Não foi possível acessar o provedor de anúncios. Tente novamente.",
 "O fornecedor não retornou uma lista de anúncios reconhecida."
]);
export const searchLibrary=createServerFn({method:"POST"}).validator(input).handler(async({data}):Promise<LibraryResult>=>{
 setResponseHeaders(new Headers({"Cache-Control":"private, no-store"}));
 try{
  const user=await researcher();
  const page=await collectPage(user,{...data,pageId:"",start:"",end:""});
  return {ok:true,page};
 }catch(error){
  const message=error instanceof Error?error.message:"";
  return {ok:false,message:knownMessages.has(message)?message:"Não foi possível concluir a consulta. Verifique a configuração administrativa e tente novamente."};
 }
});
