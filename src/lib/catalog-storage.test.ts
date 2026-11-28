import { describe, expect, it } from "vitest";
import { readWorkspace, readCatalog } from "./catalog-storage";
import { blankOffer, defaults, safeUrl } from "./offermind";
const empty={offers:[],ads:[],rules:defaults,history:[]};
describe("catalog boundary",()=>{
 it("loads a valid empty workspace",()=>expect(readWorkspace(JSON.stringify(empty))).toEqual(empty));
 it("rejects bad shapes and untrusted link schemes",()=>{
  expect(()=>readWorkspace('{"offers":[{}]}')).toThrow();
  expect(safeUrl("javascript:alert(1)")).toBe("");
  expect(safeUrl("https://user:secret@example.com/")).toBe("");
  expect(()=>readWorkspace(JSON.stringify({...empty,offers:[{...blankOffer(),id:"x",name:"Name",advertiser:"Advertiser",url:"javascript:alert(1)"}]}))).toThrow();
 });
 it("rejects mismatched catalog market",()=>expect(()=>readCatalog({version:1,generatedAt:null,coverage:"test",matched:0,offers:[{...blankOffer(),id:"x",name:"Name",advertiser:"Advertiser",country:"US"}],ads:[]},"BR")).toThrow());
});
