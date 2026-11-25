import {describe,it,expect} from "vitest";
import {age,blankOffer,defaults,evaluate,mergeAds,parseAds,type Ad} from "./offermind";
const offer={...blankOffer(),id:"test",name:"Test"};
const observed="2026-11-25";
const ad=(i:number,start="2026-11-11"):Ad=>({id:String(i),offerId:"test",country:"US",status:"active",start,observed,source:"https://example.invalid/"+i,headline:"Test",concept:"concept "+i%3,reviewed:true,format:"Video"});
describe("OfferMind evidence rules",()=>{
 it("uses inclusive 14–30 day bounds",()=>{expect(age("2026-11-12",observed)).toBe(13);expect(age("2026-11-11",observed)).toBe(14);expect(age("2026-10-26",observed)).toBe(30);expect(age("2026-10-25",observed)).toBe(31);expect(age("2026-02-30",observed)).toBeNull()});
 it("requires 41 distinct ads, not page totals",()=>{const forty=Array.from({length:40},(_,i)=>ad(i));expect(evaluate({...offer,pageTotal:900},[...forty,ad(0)]).passed).toBe(false);expect(evaluate(offer,[...forty,ad(40)]).passed).toBe(true)});
 it("excludes different offers, countries, and inactive ads",()=>{const a=[ad(1),{...ad(2),offerId:"other"},{...ad(3),country:"BR"},{...ad(4),status:"inactive" as const}];expect(evaluate(offer,a).active).toBe(1)});
 it("does not count unreviewed creative concepts",()=>{const a=Array.from({length:41},(_,i)=>({...ad(i),reviewed:false}));expect(evaluate(offer,a).concepts).toBe(0);expect(evaluate(offer,a).passed).toBe(false)});
 it("counts only observations in the latest sample and ages in range",()=>{const a=[ad(1,"2026-11-12"),ad(2),ad(3,"2026-10-26"),ad(4,"2026-10-25"),{...ad(5),observed:"2026-11-24"}];expect(evaluate(offer,a).active).toBe(4);expect(evaluate(offer,a).window).toBe(2)});
 it("does not resurrect old active observations",()=>{const a=[{...ad(1),observed:"2026-11-24"},{...ad(1),status:"inactive" as const}];expect(evaluate(offer,a).active).toBe(0);expect(evaluate(offer,a).date).toBe(observed)});
 it("deduplicates imports and resets untrusted review status",()=>{const a=parseAds(JSON.stringify([{...ad(1),observed:"2025-11-25",start:"2025-11-11"}]),offer);expect(a[0]?.reviewed).toBe(false);expect(mergeAds(a,a)).toHaveLength(1);expect(()=>parseAds(JSON.stringify([{...ad(1),source:"javascript:alert(1)"}]),offer)).toThrow()});
 it("keeps missing observations indeterminate",()=>{expect(evaluate(offer,[],defaults).status).toBe("Indeterminada")});
});
