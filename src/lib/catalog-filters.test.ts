import { describe,expect,it } from "vitest";
import { blankOffer, defaults, evaluate, type Ad } from "./offermind";
import { filterCatalog, initialFilters, type CatalogFilters } from "./catalog-filters";
const rules={...defaults,country:"BR"};
const offer={...blankOffer(),id:"fixture",country:"BR",name:"Extensão de Cílios",advertiser:"Studio Exemplo",niche:"Beleza e estética",favorite:true};
const ad=(id:string,format:string,platforms:string[],start:string):Ad=>({id,offerId:offer.id,country:"BR",status:"active",start,observed:"2026-11-28",source:"https://example.invalid/"+id,headline:"Aprenda mapeamento",concept:"",reviewed:false,format,platforms});
const records=[ad("1","Vídeo",["INSTAGRAM"],"2026-11-08"),ad("2","Imagem",["Facebook"],"2026-11-25")];
const item={o:offer,e:evaluate(offer,records,rules)};
const apply=(f:Partial<CatalogFilters>)=>filterCatalog([item],rules,{...initialFilters,...f});
describe("offline feed filters",()=>{
 it("matches accents, case, multiple terms and headlines",()=>{expect(apply({query:"CILIOS extensao"})).toHaveLength(1);expect(apply({query:"mapeamento"})).toHaveLength(1);expect(apply({query:"culinaria"})).toEqual([])});
 it("combines country, niche, favorite and observed volume",()=>{expect(apply({niche:"Beleza e estetica",fav:true,volume:"2"})).toHaveLength(1);expect(apply({volume:"3"})).toEqual([]);expect(filterCatalog([item],{...rules,country:"US"},initialFilters)).toEqual([])});
 it("uses the same ad for platform, format and age",()=>{expect(apply({platform:"instagram",format:"video",period:"window"})).toHaveLength(1);expect(apply({platform:"facebook",format:"video"})).toEqual([]);expect(apply({platform:"facebook",period:"window"})).toEqual([]);expect(apply({format:"image",period:"7"})).toHaveLength(1)});
 it("does not infer missing metadata or inflate counts",()=>{expect(apply({format:"carousel"})).toEqual([]);expect(apply({volume:"41"})).toEqual([])});
 it("does not mutate input and handles empty catalog",()=>{const rows=[item];expect(filterCatalog(rows,rules,initialFilters)).toEqual(rows);expect(filterCatalog([],rules,initialFilters)).toEqual([])});
});
