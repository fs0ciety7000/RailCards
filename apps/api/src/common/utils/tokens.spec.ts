import { generateOpaqueToken, hashOpaqueToken } from "./tokens";

describe("opaque token utils", () => {
  it("generates unique, high-entropy tokens", () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a).not.toEqual(b);
    expect(a.length).toBeGreaterThan(40);
  });

  it("hashes deterministically", () => {
    const token = "fixed-value-for-test";
    expect(hashOpaqueToken(token)).toBe(hashOpaqueToken(token));
  });

  it("produces different hashes for different tokens", () => {
    expect(hashOpaqueToken("a")).not.toBe(hashOpaqueToken("b"));
  });
});
