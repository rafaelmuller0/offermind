import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OfferFeed from "./OfferFeed";
import { blankOffer, defaults, evaluate, type Ad } from "../lib/offermind";
const rules={...defaults,country:"BR",minAds:1,minWindow:1};
const items=Array.from({length:6},(_,i)=>{
 const o={...blankOffer(),id:"offer-"+i,country:"BR",name:"Produto "+i,advertiser:"Estúdio "+i,niche:"Beleza e estética",productType:"course"};
 const a:Ad={id:"ad-"+i,offerId:o.id,country:"BR",status:"active",start:"2026-11-08",observed:"2026-11-28",source:"https://example.invalid/"+i,headline:"Exemplo",concept:"",reviewed:false,format:"Imagem"};
 return {o,e:evaluate(o,[a],rules)};
});
const click=(name:string|RegExp)=>fireEvent.click(screen.getByRole("button",{name}));
describe("feed workflow",()=>{
 it("displays five matching saved products and loads the next batch in place",()=>{
  const onResearch=vi.fn();
  render(<OfferFeed onCreate={vi.fn()} items={items} rules={rules} onCountry={vi.fn()} onResearch={onResearch} onOpen={vi.fn()} onFavorite={vi.fn()} onCompare={vi.fn()} selected={[]}/>);
  click(/Brasil/);click(/Todos os nichos/);click("Todos os micronichos");click("Todos os produtos");click(/Revisar pesquisa/);click("Encontrar ofertas");
  expect(screen.getAllByRole("article")).toHaveLength(5);
  expect(onResearch).toHaveBeenCalledTimes(1);
  click("Mais 5 ofertas");
  expect(screen.getAllByRole("article")).toHaveLength(6);
  expect(screen.queryByRole("button",{name:"Mais 5 ofertas"})).not.toBeInTheDocument();
 });
 it("applies the submitted term by click or Enter and focuses the result count",()=>{
  render(<OfferFeed onCreate={vi.fn()} items={items} rules={rules} onCountry={vi.fn()} onResearch={vi.fn()} onOpen={vi.fn()} onFavorite={vi.fn()} onCompare={vi.fn()} selected={[]}/>);
  click("Explorar feed");
  const input=screen.getByRole("textbox",{name:"Buscar ofertas"});
  fireEvent.change(input,{target:{value:"produto 3"}});
  expect(screen.getAllByRole("article")).toHaveLength(6);
  click("Buscar ofertas");
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(screen.getByRole("heading",{name:/resultado da busca.*produto 3.*1 de 6/i})).toHaveFocus();
  fireEvent.change(input,{target:{value:"ausente"}});
  fireEvent.keyDown(input,{key:"Enter"});
  expect(screen.getByText("Nenhuma oferta para estes filtros")).toBeVisible();
  click("Limpar filtros");
  expect(screen.getAllByRole("article")).toHaveLength(6);
 });
 it("distinguishes an empty catalog from a failed search",()=>{
  render(<OfferFeed onCreate={vi.fn()} items={[]} rules={rules} onCountry={vi.fn()} onResearch={vi.fn()} onOpen={vi.fn()} onFavorite={vi.fn()} onCompare={vi.fn()} selected={[]}/>);
  click("Explorar feed");
  expect(screen.getByRole("heading",{name:"Catálogo sem ofertas neste mercado"})).toBeInTheDocument();
 });
});
