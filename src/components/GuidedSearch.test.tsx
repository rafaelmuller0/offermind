import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GuidedSearch from "./GuidedSearch";
import { blankOffer, defaults, evaluate, type Ad } from "../lib/offermind";
const rules={...defaults,country:"BR",minAds:1,minWindow:1};
const o={...blankOffer(),id:"fixture",country:"BR",name:"Cílios profissionais",advertiser:"Exemplo",niche:"Beleza e estética",microniche:"Extensão de cílios",productType:"course"};
const a:Ad={id:"1",offerId:o.id,country:"BR",status:"active",start:"2026-11-08",observed:"2026-11-28",source:"https://example.invalid/ad",headline:"Cílios",concept:"",reviewed:false,format:"Imagem"};
describe("guided catalog search",()=>{
 it("walks through selections and applies them without network",()=>{
  const onApply=vi.fn(),onClose=vi.fn();
  render(<GuidedSearch items={[{o,e:evaluate(o,[a],rules)}]} rules={rules} onApply={onApply} onClose={onClose}/>);
  fireEvent.click(screen.getByRole("button",{name:/Brasil/}));
  fireEvent.click(screen.getByRole("button",{name:/Beleza e estética/}));
  fireEvent.click(screen.getByRole("button",{name:"Extensão de cílios"}));
  fireEvent.click(screen.getByRole("button",{name:"Cursos online"}));
  fireEvent.click(screen.getByRole("button",{name:/Revisar pesquisa/}));
  expect(screen.getByText("1 ofertas correspondentes no catálogo")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"Encontrar ofertas"}));
  expect(onApply).toHaveBeenCalledWith(expect.objectContaining({country:"BR",filters:expect.objectContaining({niche:"Beleza e estética",microniche:"Extensão de cílios",productType:"course",volume:"1",minWindow:1})}));
 });
 it("allows returning and changing country",()=>{
  render(<GuidedSearch items={[]} rules={rules} onApply={vi.fn()} onClose={vi.fn()}/>);
  fireEvent.click(screen.getByRole("button",{name:/Brasil/}));
  fireEvent.click(screen.getByRole("button",{name:"Voltar"}));
  expect(screen.getByRole("heading",{name:"Qual mercado deseja explorar?"})).toBeInTheDocument();
 });
});
