import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Index } from "../routes/index";
const mocks=vi.hoisted(()=>({search:vi.fn()}));
vi.mock("@tanstack/react-start",()=>({useServerFn:()=>mocks.search}));
vi.mock("../lib/library-search.functions",()=>({searchLibrary:vi.fn()}));

it("submits selected market, format and platform; reports a successful empty response",async()=>{
 mocks.search.mockResolvedValue({ok:true,page:{ads:[],next:"",total:0,observed:"2026-11-28",skipped:0}});
 render(<Index/>);
 fireEvent.change(screen.getByLabelText("Palavra-chave"),{target:{value:"  lash mapping  "}});
 fireEvent.change(screen.getByLabelText("Mercado"),{target:{value:"US"}});
 fireEvent.change(screen.getByLabelText("Plataforma"),{target:{value:"instagram"}});
 fireEvent.change(screen.getByLabelText("Formato"),{target:{value:"video"}});
 fireEvent.click(screen.getByRole("button",{name:"Pesquisar"}));
 expect(await screen.findByRole("heading",{name:"Nenhum anúncio exibido"})).toBeInTheDocument();
 expect(mocks.search).toHaveBeenCalledWith({data:{country:"US",keyword:"lash mapping",platform:"instagram",media:"video",cursor:""}});
 expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
