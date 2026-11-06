import { describe, it, expect } from "vitest";
import { compareSemVer, isValidSemVer, parseSemVer } from "../src/utils/versions";

describe("semver comparisons", () => {
  it("orders patch versions", () => {
    expect(compareSemVer("1.0.1", "1.0.0")).toBe(1);
    expect(compareSemVer("1.0.0", "1.0.1")).toBe(-1);
  });

  it("recognizes 1.10.0 as newer than 1.9.0", () => {
    expect(compareSemVer("1.10.0", "1.9.0")).toBe(1);
    expect(compareSemVer("1.9.0", "1.10.0")).toBe(-1);
  });

  it("orders minor versions", () => {
    expect(compareSemVer("1.1.0", "1.0.0")).toBe(1);
  });

  it("orders major versions", () => {
    expect(compareSemVer("2.0.0", "1.99.0")).toBe(1);
  });

  it("considers release newer than prerelease", () => {
    expect(compareSemVer("1.0.0", "1.0.0-beta.1")).toBe(1);
    expect(compareSemVer("1.0.0-beta.1", "1.0.0")).toBe(-1);
  });

  it("orders prerelease identifiers", () => {
    expect(compareSemVer("1.0.0-beta.2", "1.0.0-beta.1")).toBe(1);
    expect(compareSemVer("1.0.0-alpha.1", "1.0.0-beta.1")).toBe(-1);
  });

  it("handles v prefix", () => {
    expect(compareSemVer("v2.0.0", "1.0.0")).toBe(1);
  });

  it("rejects invalid versions", () => {
    expect(() => compareSemVer("not-a-version", "1.0.0")).toThrow();
    expect(parseSemVer("1.0")).toBeNull();
    expect(parseSemVer("1.0.0.0")).toBeNull();
    expect(isValidSemVer("1.0.0")).toBe(true);
    expect(isValidSemVer("1.0")).toBe(false);
  });
});
