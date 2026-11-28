import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
import {loadResearch,research} from "../lib/research.functions";
import ResearchChat from "../components/ResearchChat";
import {initial} from "../lib/research";
vi.mock("../lib/research.functions",()=>({loadResearch:vi.fn(),research:vi.fn()}));
afterEach(()=>{cleanup();vi.resetAllMocks()});
it("waits for an explicit country choice and shows the resulting report",async()=>{
  vi.mocked(loadResearch).mockResolvedValue(initial);
  vi.mocked(research).mockResolvedValue({version:1,stage:2,country:"BR",turns:[{stage:2,instruction:"BR",answer:"Relatório de teste",sources:["https://example.org/"],cards:[]}]});
  render(<ResearchChat onDiscover={vi.fn()}/>);
  const choice=screen.getByRole("button",{name:"Brasil"});
  await waitFor(()=>expect(choice).toBeEnabled());
  expect(research).not.toHaveBeenCalled();
  fireEvent.click(choice);
  expect(await screen.findByText("Relatório de teste")).toBeVisible();
  expect(screen.getByRole("link",{name:/Fonte 1/})).toHaveAttribute("href","https://example.org/");
  expect(screen.getByRole("button",{name:"Aprovar etapa"})).toBeDisabled();
});
it("does not enable a paid query when the private history is unavailable",async()=>{
  vi.mocked(loadResearch).mockRejectedValue(Error("Acesso privado indisponível"));
  render(<ResearchChat onDiscover={vi.fn()}/>);
  expect(await screen.findByRole("alert")).toHaveTextContent("Acesso privado indisponível");
  expect(screen.getByRole("button",{name:"Brasil"})).toBeDisabled();
});
