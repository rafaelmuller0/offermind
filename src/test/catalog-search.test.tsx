import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ComponentType } from "react";
import { Route } from "../routes/index";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

it("finds an authorized imported headline after reloading the workspace", async () => {
  const catalog = {version:1, generatedAt:null, coverage:"not_configured", offers:[], ads:[], matched:0};
  const fetchLocal = vi.fn(async (_url:string) => new Response(JSON.stringify(catalog)));
  vi.stubGlobal("fetch", fetchLocal);
  const Page = Route.options.component as ComponentType;
  const app = render(<Page/>);
  const click = (name:string) => fireEvent.click(screen.getByRole("button",{name}));
  click("Explorar feed");
  const empty = await screen.findByRole("heading",{name:"Catálogo sem ofertas neste mercado"});
  fireEvent.click(within(empty.parentElement!).getByRole("button",{name:"Cadastrar oferta"}));
  fireEvent.change(screen.getByLabelText("Nome da oferta"),{target:{value:"Oferta de teste"}});
  fireEvent.change(screen.getByLabelText("Anunciante"),{target:{value:"Anunciante de teste"}});
  const country=(screen.getByLabelText("País") as HTMLSelectElement).value;
  click("Salvar oferta");
  click("Importar anúncios");
  const dialog=within(screen.getByRole("dialog",{name:"Importar anúncios"}));
  const submit=dialog.getByRole("button",{name:"Validar e importar"});
  const record={id:"test-ad",country,status:"active",start:"2024-01-01",observed:"2024-01-02",source:"https://example.invalid/test",headline:"Termo exclusivo"};
  const input=dialog.getByRole("textbox");
  fireEvent.change(input,{target:{value:JSON.stringify([record])}});
  expect(submit).toBeDisabled();
  fireEvent.click(dialog.getByRole("checkbox"));
  fireEvent.change(input,{target:{value:JSON.stringify([{...record,source:"javascript:void(0)"}])}});
  fireEvent.click(submit);
  expect(JSON.parse(localStorage.getItem("offermind-v1")!).ads).toHaveLength(0);
  fireEvent.change(input,{target:{value:JSON.stringify([record])}});
  fireEvent.click(submit);
  expect(screen.queryByRole("dialog",{name:"Importar anúncios"})).toBeNull();
  app.unmount();
  render(<Page/>);
  click("Explorar feed");
  fireEvent.change(screen.getByRole("textbox",{name:"Buscar ofertas"}),{target:{value:"termo exclusivo"}});
  click("Buscar ofertas");
  expect(screen.getByRole("article")).toHaveTextContent("Oferta de teste");
  expect(fetchLocal.mock.calls.map(call=>call[0])).toEqual([
    "/offermind-catalog-BR.json","/offermind-catalog-US.json",
    "/offermind-catalog-BR.json","/offermind-catalog-US.json",
  ]);
});
