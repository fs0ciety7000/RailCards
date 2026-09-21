import { parseDurationToMs } from "./duration";

describe("parseDurationToMs", () => {
  it.each([
    ["15m", 15 * 60_000],
    ["30d", 30 * 86_400_000],
    ["12h", 12 * 3_600_000],
    ["45s", 45 * 1_000],
  ])("parses %s", (input, expected) => {
    expect(parseDurationToMs(input)).toBe(expected);
  });

  it("throws on an invalid format", () => {
    expect(() => parseDurationToMs("banana")).toThrow();
    expect(() => parseDurationToMs("15")).toThrow();
    expect(() => parseDurationToMs("15x")).toThrow();
  });
});
