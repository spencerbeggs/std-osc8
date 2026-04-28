import { describe, expect, it } from "vitest";
import { compareSemver, parseKonsoleVersion, parseVteVersion } from "../src/semver.js";

describe("compareSemver", () => {
	it("returns 0 when versions are equal", () => {
		expect(compareSemver("1.2.3", "1.2.3")).toBe(0);
	});
	it("treats missing patch as 0", () => {
		expect(compareSemver("1.2", "1.2.0")).toBe(0);
	});
	it("treats missing minor and patch as 0", () => {
		expect(compareSemver("3", "3.0.0")).toBe(0);
	});
	it("returns negative when a < b", () => {
		expect(compareSemver("1.2.3", "1.2.4")).toBeLessThan(0);
		expect(compareSemver("1.2.3", "1.3.0")).toBeLessThan(0);
		expect(compareSemver("1.2.3", "2.0.0")).toBeLessThan(0);
	});
	it("returns positive when a > b", () => {
		expect(compareSemver("2.0.0", "1.99.99")).toBeGreaterThan(0);
		expect(compareSemver("1.10.0", "1.9.0")).toBeGreaterThan(0);
	});
	it("ignores prerelease tags", () => {
		expect(compareSemver("1.2.3-beta", "1.2.3")).toBe(0);
		expect(compareSemver("1.2.3-rc.1", "1.2.3-rc.2")).toBe(0);
	});
	it("returns 0 when either input is malformed", () => {
		expect(compareSemver("not-a-version", "1.0.0")).toBe(0);
		expect(compareSemver("1.0.0", "garbage")).toBe(0);
	});
});

describe("parseVteVersion", () => {
	it("decodes the packed integer (M*10000 + m*100 + p)", () => {
		expect(parseVteVersion("5202")).toBe("0.52.2");
		expect(parseVteVersion("5000")).toBe("0.50.0");
		expect(parseVteVersion("60100")).toBe("6.1.0");
	});
	it("returns null for malformed input", () => {
		expect(parseVteVersion("not-a-number")).toBe(null);
		expect(parseVteVersion("")).toBe(null);
		expect(parseVteVersion(undefined)).toBe(null);
	});
});

describe("parseKonsoleVersion", () => {
	it("decodes Konsole's packed integer (Y*10000 + M*100 + p)", () => {
		expect(parseKonsoleVersion("220400")).toBe("22.4.0");
		expect(parseKonsoleVersion("220801")).toBe("22.8.1");
		expect(parseKonsoleVersion("240200")).toBe("24.2.0");
	});
	it("returns null for malformed input", () => {
		expect(parseKonsoleVersion("xyz")).toBe(null);
		expect(parseKonsoleVersion(undefined)).toBe(null);
	});
});
