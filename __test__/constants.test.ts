import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("eager constants", () => {
	beforeEach(() => {
		vi.resetModules();
	});
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it("supportsHyperlinks reflects detect() output for stdout", async () => {
		vi.stubEnv("TERM_PROGRAM", "iTerm.app");
		vi.stubEnv("TERM_PROGRAM_VERSION", "3.5.0");
		vi.stubGlobal("process", {
			...process,
			env: { ...process.env, TERM_PROGRAM: "iTerm.app", TERM_PROGRAM_VERSION: "3.5.0" },
			stdout: { ...process.stdout, isTTY: true },
			stderr: { ...process.stderr, isTTY: true },
		});
		const mod = await import("../src/constants.js");
		expect(mod.supportsHyperlinks).toBe(true);
		expect(mod.osc8.terminal).toBe("iTerm.app");
	});

	it("supportsHyperlinksStderr reflects stderr TTY", async () => {
		vi.stubGlobal("process", {
			...process,
			env: { ...process.env, TERM_PROGRAM: "iTerm.app", TERM_PROGRAM_VERSION: "3.5.0" },
			stdout: { ...process.stdout, isTTY: false },
			stderr: { ...process.stderr, isTTY: true },
		});
		const mod = await import("../src/constants.js");
		expect(mod.supportsHyperlinks).toBe(false);
		expect(mod.supportsHyperlinksStderr).toBe(true);
	});
});

describe("supportsHyperlinksFor", () => {
	it("returns the result for the given WriteStream-like", async () => {
		vi.stubGlobal("process", {
			...process,
			env: { ...process.env, TERM_PROGRAM: "iTerm.app", TERM_PROGRAM_VERSION: "3.5.0" },
			stdout: { ...process.stdout, isTTY: true },
			stderr: { ...process.stderr, isTTY: true },
		});
		vi.resetModules();
		const { supportsHyperlinksFor } = await import("../src/constants.js");
		expect(supportsHyperlinksFor({ isTTY: true } as NodeJS.WriteStream)).toBe(true);
		expect(supportsHyperlinksFor({ isTTY: false } as NodeJS.WriteStream)).toBe(false);
		vi.unstubAllGlobals();
	});

	it("returns false for fd 3 when not a TTY", async () => {
		vi.resetModules();
		const { supportsHyperlinksFor } = await import("../src/constants.js");
		expect(supportsHyperlinksFor(3)).toBe(false);
	});
});
