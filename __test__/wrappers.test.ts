import { describe, expect, it } from "vitest";
import { detectWrapper } from "../src/wrappers.js";

describe("detectWrapper", () => {
	it("returns null when neither TMUX nor STY is set", () => {
		expect(detectWrapper({} as unknown as NodeJS.ProcessEnv)).toBe(null);
		expect(detectWrapper({ TERM: "xterm-256color" } as unknown as NodeJS.ProcessEnv)).toBe(null);
	});
	it("detects tmux when TMUX is set", () => {
		expect(detectWrapper({ TMUX: "/tmp/tmux-501/default,123,0" } as unknown as NodeJS.ProcessEnv)).toEqual({
			name: "tmux",
			passesThrough: false,
		});
	});
	it("detects screen when STY is set", () => {
		expect(detectWrapper({ STY: "12345.pts-0.host" } as unknown as NodeJS.ProcessEnv)).toEqual({
			name: "screen",
			passesThrough: false,
		});
	});
	it("prefers tmux when both TMUX and STY are set", () => {
		expect(detectWrapper({ TMUX: "x", STY: "y" } as unknown as NodeJS.ProcessEnv)?.name).toBe("tmux");
	});
});
