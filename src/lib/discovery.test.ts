import { describe,it,expect } from "vitest";
import { normalizeDestination,parsePage,groupCandidates,type FoundAd } from "./discovery";
import { defaults } from "./offermind";
const date="2026-11-25";
const row=(i:number,extra:Partial<FoundAd>={}):FoundAd=>({id:String(i),pageId:"1",advertiser:"A",destination:"https://example.com/course",title:"Title "+i%3,body:"Body",start:"2026-11-05",observed:date,country:"US",format:"VIDEO",...extra});
describe("automatic discovery",()=>{
 it("removes only known tracking parameters",()=>{expect(normalizeDestination("https://example.com/p?utm_source=fb&product=2#x")).toBe("https://example.com/p?product=2");expect(normalizeDestination("javascript:alert(1)")).toBe("")});
 it("keeps offers with different destinations separate and deduplicates IDs",()=>{const ads=[...Array.from({length:40},(_,i)=>row(i)),row(0),row(41,{destination:"https://example.com/other"})];expect(groupCandidates(ads,defaults)[0]?.ads.length).toBe(40);expect(groupCandidates(ads,defaults)[0]?.meetsVolume).toBe(false)});
 it("applies the date window independently of volume",()=>{const ads=Array.from({length:41},(_,i)=>row(i,{start:i<5?"2026-11-11":"2026-11-24"}));const c=groupCandidates(ads,defaults)[0];expect(c?.meetsVolume).toBe(true);expect(c?.windowAds.length).toBe(5);expect(c?.meetsWindow).toBe(true)});
 it("does not group conflicting IDs or missing destinations",()=>{expect(groupCandidates([row(1),row(1,{destination:"https://example.com/other"}),row(2,{destination:""})],defaults)).toHaveLength(0)});
 it("parses only explicitly active identifiable provider records",()=>{const out=parsePage({ads:[{ad_archive_id:"123",page_id:"9",is_active:true,start_date:"2026-11-05T07:00:00Z",snapshot:{page_name:"Test",link_url:"https://example.com/p",title:"Title",body:{text:"Copy"}}},{ad_archive_id:"124",page_id:"9",start_date:"2026-11-05"}],pagination:{next_page_token:"token"}},"US",date);expect(out.ads).toHaveLength(1);expect(out.skipped).toBe(1);expect(out.next).toBe("token");expect(out.total).toBeNull()});
 it("does not merge carousel ads with multiple destinations",()=>{const out=parsePage({ads:[{ad_archive_id:"123",page_id:"9",is_active:true,start_date:"2026-11-05",snapshot:{cards:[{link_url:"https://example.com/a"},{link_url:"https://example.com/b"}]}}]},"US",date);expect(out.ads[0]?.destination).toBe("");expect(groupCandidates(out.ads,defaults)).toHaveLength(0)});
});
