import { afterEach, describe, expect, it, vi } from "vitest";
import { readProcessSnapshot } from "../src/snapshot.js";

describe("readProcessSnapshot", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	it("reads process.env into the snapshot", () => {
		vi.stubEnv("TERM_PROGRAM", "iTerm.app");
		const snap = readProcessSnapshot();
		expect(snap.env.TERM_PROGRAM).toBe("iTerm.app");
	});

	it("reads process.stdout.isTTY", () => {
		vi.stubGlobal("process", {
			...process,
			stdout: { ...process.stdout, isTTY: true },
			stderr: { ...process.stderr, isTTY: false },
		});
		const snap = readProcessSnapshot();
		expect(snap.isStdoutTTY).toBe(true);
		expect(snap.isStderrTTY).toBe(false);
	});

	it("treats undefined isTTY as false", () => {
		vi.stubGlobal("process", {
			...process,
			stdout: { ...process.stdout, isTTY: undefined },
			stderr: { ...process.stderr, isTTY: undefined },
		});
		const snap = readProcessSnapshot();
		expect(snap.isStdoutTTY).toBe(false);
		expect(snap.isStderrTTY).toBe(false);
	});
});
