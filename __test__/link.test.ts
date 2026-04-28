import { describe, expect, it } from "vitest";
import { link } from "../src/link.js";

const URL = "https://example.com";
const SUPPORTED_OUT = `\x1b]8;;${URL}\x1b\\docs\x1b]8;;\x1b\\`;

describe("link — when enabled", () => {
	it("emits OSC8 sequence", () => {
		expect(link("docs", URL, { enabled: true })).toBe(SUPPORTED_OUT);
	});
	it("includes params when capabilities allow", () => {
		// We force enabled=true. Params are silently dropped if the runtime
		// terminal lacks support; here we override that via the option.
		expect(link("docs", URL, { enabled: true, params: { id: "x" } })).toBe(
			`\x1b]8;id=x;${URL}\x1b\\docs\x1b]8;;\x1b\\`,
		);
	});
	it("throws TypeError on invalid param values even when enabled", () => {
		expect(() => link("docs", URL, { enabled: true, params: { id: "a;b" } })).toThrow(TypeError);
	});
});

describe("link — when disabled (fallback)", () => {
	it("default fallback is 'with-url'", () => {
		expect(link("docs", URL, { enabled: false })).toBe(`docs (${URL})`);
	});
	it("'label-only' returns just the label", () => {
		expect(link("docs", URL, { enabled: false, fallback: "label-only" })).toBe("docs");
	});
	it("'url-only' returns just the URL", () => {
		expect(link("docs", URL, { enabled: false, fallback: "url-only" })).toBe(URL);
	});
	it("custom function fallback receives label and url", () => {
		const r = link("docs", URL, {
			enabled: false,
			fallback: (l, u) => `${l}: ${u}`,
		});
		expect(r).toBe("docs: https://example.com");
	});
	it("validation still throws even when disabled", () => {
		expect(() => link("docs", URL, { enabled: false, params: { id: "a;b" } })).toThrow(TypeError);
	});
});
