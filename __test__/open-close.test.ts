import { describe, expect, it } from "vitest";
import { closeHyperlink, openHyperlink } from "../src/link.js";

describe("closeHyperlink", () => {
	it("emits the OSC8 close sequence with ST terminator", () => {
		expect(closeHyperlink()).toBe("\x1b]8;;\x1b\\");
	});
});

describe("openHyperlink", () => {
	it("emits the OSC8 open sequence with ST terminator and empty params", () => {
		expect(openHyperlink("https://example.com")).toBe("\x1b]8;;https://example.com\x1b\\");
	});
	it("includes id= param when provided", () => {
		expect(openHyperlink("https://example.com", { id: "abc" })).toBe("\x1b]8;id=abc;https://example.com\x1b\\");
	});
	it("serializes multiple params with colon separator", () => {
		const r = openHyperlink("https://example.com", { id: "abc", foo: "bar" });
		// Order is map iteration order — both orderings acceptable here.
		// biome-ignore lint/suspicious/noControlCharactersInRegex: Regex pattern intentionally matches escape sequences
		expect(r).toMatch(/^\x1b\]8;(id=abc:foo=bar|foo=bar:id=abc);https:\/\/example\.com\x1b\\$/);
	});
	it("throws TypeError when a param value contains ';' or ':'", () => {
		expect(() => openHyperlink("https://example.com", { id: "a:b" })).toThrow(TypeError);
		expect(() => openHyperlink("https://example.com", { id: "a;b" })).toThrow(TypeError);
	});
	it("throws TypeError when a param value contains a control character", () => {
		expect(() => openHyperlink("https://example.com", { id: "a\x07b" })).toThrow(TypeError);
	});
});
