import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Index } from "../routes/index";
const mocks=vi.hoisted(()=>({search:vi.fn()}));
vi.mock("@tanstack/react-start",()=>({useServerFn:()=>mocks.search}));
vi.mock("../lib/library-search.functions",()=>({searchLibrary:vi.fn()}));
const example={id:"123",pageId:"456",advertiser:"Anunciante de teste",destination:"",title:"Anúncio de teste",body:"Texto de teste",start:"2026-01-01",observed:"2026-01-02",country:"BR",format:"IMAGE",platforms:["facebook"]};
describe("single search screen",()=>{
 beforeEach(()=>mocks.search.mockReset());
 it("requires a keyword and calls provider only on submission, renders returned ads",async()=>{
  mocks.search.mockResolvedValue({ok:true,page:{ads:[example],next:"p2",total:null,observed:example.observed,skipped:0}});
  render(<Index/>);
  expect(screen.getByRole("button",{name:"Pesquisar"})).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Palavra-chave"),{target:{value:"cílios"}});
  expect(mocks.search).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Pesquisar"}));
  expect(await screen.findByText("Anunciante de teste")).toBeInTheDocument();
  expect(mocks.search).toHaveBeenCalledWith({data:{country:"BR",keyword:"cílios",platform:"all",media:"all",cursor:""}});
  mocks.search.mockResolvedValue({ok:true,page:{ads:[example],next:"",total:null,observed:example.observed,skipped:0}});
  fireEvent.click(screen.getByRole("button",{name:"Carregar mais anúncios"}));
  await waitFor(()=>expect(screen.queryByRole("button",{name:"Carregar mais anúncios"})).not.toBeInTheDocument());
  expect(screen.getAllByText("Anunciante de teste")).toHaveLength(1);
 });
 it("distinguishes provider failure from empty results",async()=>{
  mocks.search.mockResolvedValue({ok:false,message:"Fonte indisponível"});
  render(<Index/>);fireEvent.change(screen.getByLabelText("Palavra-chave"),{target:{value:"curso"}});fireEvent.click(screen.getByRole("button",{name:"Pesquisar"}));
  expect(await screen.findByRole("alert")).toHaveTextContent("Fonte indisponível");
  expect(screen.queryByText("Nenhum anúncio exibido")).not.toBeInTheDocument();
 });
});
