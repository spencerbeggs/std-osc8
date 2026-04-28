import { describe, expect, it } from "vitest";
import { envIsTruthy } from "../src/env.js";

describe("envIsTruthy (default semantics)", () => {
	it("is false for undefined", () => {
		expect(envIsTruthy(undefined)).toBe(false);
	});
	it("is false for empty string", () => {
		expect(envIsTruthy("")).toBe(false);
	});
	it("is false for '0', 'false', 'off', 'no' (case insensitive)", () => {
		for (const v of ["0", "false", "FALSE", "off", "Off", "no", "NO"]) {
			expect(envIsTruthy(v)).toBe(false);
		}
	});
	it("is true for any other non-empty value", () => {
		for (const v of ["1", "true", "yes", "on", "x"]) {
			expect(envIsTruthy(v)).toBe(true);
		}
	});
});

describe("envIsTruthy with NO_COLOR semantics", () => {
	it("is false for undefined and empty string", () => {
		expect(envIsTruthy(undefined, "no-color")).toBe(false);
		expect(envIsTruthy("", "no-color")).toBe(false);
	});
	it("is true for any non-empty value (including '0')", () => {
		for (const v of ["0", "false", "off", "no", "1", "true", "x"]) {
			expect(envIsTruthy(v, "no-color")).toBe(true);
		}
	});
});
