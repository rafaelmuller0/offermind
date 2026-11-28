import { describe, expect, it } from "vitest";
import { classifyMetaApiError, getMarketCoverageNote, initialMetaTerm } from "./meta-library";

describe("meta-library helpers", () => {
  it("translates the initial 'educação' search term by market", () => {
    expect(initialMetaTerm("BR")).toBe("educação");
    expect(initialMetaTerm("PT")).toBe("educação");
    expect(initialMetaTerm("US")).toBe("education");
    expect(initialMetaTerm("GB")).toBe("education");
    expect(initialMetaTerm("DE")).toBe("Bildung");
    expect(initialMetaTerm("FR")).toBe("éducation");
    expect(initialMetaTerm("ES")).toBe("educación");
  });

  it("classifies invalid/expired token errors", () => {
    expect(classifyMetaApiError(401, null).code).toBe("invalid_token");
    expect(classifyMetaApiError(403, null).code).toBe("invalid_token");
    expect(classifyMetaApiError(400, { error: { code: 190, type: "OAuthException" } }).code).toBe("invalid_token");
  });

  it("classifies Meta rate-limit responses", () => {
    expect(classifyMetaApiError(429, null).code).toBe("rate_limit");
    expect(classifyMetaApiError(400, { error: { code: 613, type: "OAuthException" } }).code).toBe("rate_limit");
    expect(classifyMetaApiError(400, { error: { code: 17 } }).code).toBe("rate_limit");
  });

  it("explains EU vs non-EU market coverage limitations", () => {
    expect(getMarketCoverageNote("US")).toContain("União Europeia");
    expect(getMarketCoverageNote("BR")).toContain("temas sociais");
    expect(getMarketCoverageNote("DE")).toContain("comerciais");
  });
});