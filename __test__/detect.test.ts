import { describe, expect, it } from "vitest";
import type { ProcessSnapshot } from "../src/detect.js";
import { detect } from "../src/detect.js";
import { envFor } from "./utils/fixtures.js";

const snapshot = (env: Partial<NodeJS.ProcessEnv> = {}, isStdoutTTY = true, isStderrTTY = true): ProcessSnapshot => ({
	env: env as NodeJS.ProcessEnv,
	isStdoutTTY,
	isStderrTTY,
});

describe("detect — overrides", () => {
	it("FORCE_HYPERLINK=1 forces on, even when not a TTY", () => {
		const r = detect(snapshot({ FORCE_HYPERLINK: "1" }, false, false));
		expect(r.supported).toBe(true);
		expect(r.reason).toBe("force-env");
		expect(r.override).toBe("force-hyperlink");
	});
	it("FORCE_HYPERLINK=1 forces on, even inside tmux", () => {
		const r = detect(snapshot({ FORCE_HYPERLINK: "1", TMUX: "x" }));
		expect(r.supported).toBe(true);
		expect(r.reason).toBe("force-env");
	});
	it("FORCE_HYPERLINK=0 is falsy and does not force", () => {
		const r = detect(snapshot({ FORCE_HYPERLINK: "0" }, false, false));
		expect(r.supported).toBe(false);
		expect(r.reason).toBe("not-a-tty");
	});
	it("NO_HYPERLINK=1 disables", () => {
		const r = detect(snapshot({ ...envFor.iterm(), NO_HYPERLINK: "1" } as NodeJS.ProcessEnv));
		expect(r.supported).toBe(false);
		expect(r.reason).toBe("no-hyperlink-env");
		expect(r.override).toBe("no-hyperlink");
	});
	it("FORCE_HYPERLINK overrides NO_HYPERLINK", () => {
		const r = detect(snapshot({ FORCE_HYPERLINK: "1", NO_HYPERLINK: "1" }, false, false));
		expect(r.supported).toBe(true);
		expect(r.reason).toBe("force-env");
	});
	it("NO_COLOR=1 disables (per no-color.org spec)", () => {
		const r = detect(snapshot({ ...envFor.iterm(), NO_COLOR: "1" } as NodeJS.ProcessEnv));
		expect(r.supported).toBe(false);
		expect(r.reason).toBe("no-color-env");
		expect(r.override).toBe("no-color");
	});
	it("NO_COLOR='0' still disables (any non-empty is truthy per spec)", () => {
		const r = detect(snapshot({ ...envFor.iterm(), NO_COLOR: "0" } as NodeJS.ProcessEnv));
		expect(r.supported).toBe(false);
		expect(r.reason).toBe("no-color-env");
	});
});

describe("detect — TTY", () => {
	it("returns off with not-a-tty when stdout is not a TTY", () => {
		const r = detect(snapshot(envFor.iterm() as NodeJS.ProcessEnv, false, true));
		expect(r.supported).toBe(false);
		expect(r.reason).toBe("not-a-tty");
	});
	it("supportedForStderr reflects stderr's TTY independently", () => {
		const r = detect(snapshot(envFor.iterm() as NodeJS.ProcessEnv, false, true));
		expect(r.supported).toBe(false);
		expect(r.supportedForStderr).toBe(true);
	});
});

describe("detect — wrappers", () => {
	it("returns off with wrapper-strips when TMUX is set", () => {
		const r = detect(snapshot({ ...envFor.iterm(), TMUX: "x" } as NodeJS.ProcessEnv));
		expect(r.supported).toBe(false);
		expect(r.reason).toBe("wrapper-strips");
		expect(r.wrapper).toEqual({ name: "tmux", passesThrough: false });
	});
});

describe("detect — terminal allowlist", () => {
	it("iTerm 3.5 is terminal-known-supported", () => {
		const r = detect(snapshot(envFor.iterm({ version: "3.5.0" }) as NodeJS.ProcessEnv));
		expect(r.supported).toBe(true);
		expect(r.reason).toBe("terminal-known-supported");
		expect(r.terminal).toBe("iTerm.app");
		expect(r.terminalVersion).toBe("3.5.0");
	});
	it("iTerm 3.0 is terminal-known-too-old", () => {
		const r = detect(snapshot(envFor.iterm({ version: "3.0.0" }) as NodeJS.ProcessEnv));
		expect(r.supported).toBe(false);
		expect(r.reason).toBe("terminal-known-too-old");
		expect(r.terminal).toBe("iTerm.app");
	});
	it("Apple Terminal is terminal-known-unsupported", () => {
		const r = detect(snapshot(envFor.appleTerminal() as NodeJS.ProcessEnv));
		expect(r.supported).toBe(false);
		expect(r.reason).toBe("terminal-known-unsupported");
		expect(r.terminal).toBe("Apple_Terminal");
	});
	it("VTE 0.50 is terminal-known-supported", () => {
		const r = detect(snapshot(envFor.vte({ rawVersion: "5000" }) as NodeJS.ProcessEnv));
		expect(r.supported).toBe(true);
		expect(r.reason).toBe("terminal-known-supported");
	});
	it("VTE 0.49 is terminal-known-too-old", () => {
		const r = detect(snapshot(envFor.vte({ rawVersion: "4900" }) as NodeJS.ProcessEnv));
		expect(r.supported).toBe(false);
		expect(r.reason).toBe("terminal-known-too-old");
	});
	it("Terminal with null minVersion (e.g. WezTerm) is supported regardless", () => {
		const r = detect(snapshot(envFor.wezterm() as NodeJS.ProcessEnv));
		expect(r.supported).toBe(true);
		expect(r.reason).toBe("terminal-known-supported");
	});
	it("unidentifiable terminal is terminal-unknown", () => {
		const r = detect(snapshot(envFor.unknown() as NodeJS.ProcessEnv));
		expect(r.supported).toBe(false);
		expect(r.reason).toBe("terminal-unknown");
		expect(r.terminal).toBe(null);
	});
	it("Alacritty (any version) is terminal-known-supported", () => {
		// Regression: Alacritty's TERM=alacritty carries no version info,
		// so a minVersion gate would always fire 'terminal-known-too-old'.
		const r = detect(snapshot(envFor.alacritty() as NodeJS.ProcessEnv));
		expect(r.supported).toBe(true);
		expect(r.reason).toBe("terminal-known-supported");
		expect(r.terminal).toBe("Alacritty");
	});
});

describe("detect — capabilities", () => {
	it("populates capabilities for supported known terminals", () => {
		const r = detect(snapshot(envFor.iterm() as NodeJS.ProcessEnv));
		expect(r.capabilities).toEqual({
			params: true,
			fileUrls: true,
			fileUrlsRemoteUnsafe: false,
		});
	});
	it("zeros capabilities for unknown terminals", () => {
		const r = detect(snapshot(envFor.unknown() as NodeJS.ProcessEnv));
		expect(r.capabilities).toEqual({
			params: false,
			fileUrls: false,
			fileUrlsRemoteUnsafe: false,
		});
	});
	it("zeros capabilities for known-unsupported terminals", () => {
		const r = detect(snapshot(envFor.appleTerminal() as NodeJS.ProcessEnv));
		expect(r.capabilities.params).toBe(false);
	});
	it("populates capabilities for known terminals even when stdout is not a TTY", () => {
		// Capabilities are an intrinsic terminal property, decoupled from
		// stream TTY state. A piped stdout doesn't change what the terminal
		// can do — only whether we're emitting OSC8 right now.
		const r = detect(snapshot(envFor.iterm() as NodeJS.ProcessEnv, false, true));
		expect(r.supported).toBe(false);
		expect(r.reason).toBe("not-a-tty");
		expect(r.capabilities).toEqual({
			params: true,
			fileUrls: true,
			fileUrlsRemoteUnsafe: false,
		});
	});
	it("populates capabilities for known terminals even inside a wrapper", () => {
		const r = detect(snapshot({ ...envFor.iterm(), TMUX: "x" } as NodeJS.ProcessEnv));
		expect(r.supported).toBe(false);
		expect(r.reason).toBe("wrapper-strips");
		expect(r.capabilities.params).toBe(true);
	});
});

describe("detect — supportedForStderr divergence", () => {
	// These exercise the bug class the stderrSupported IIFE was fragile to:
	// stdout and stderr can disagree only on TTY state; everything else
	// (overrides, wrapper, allowlist) agrees by construction.
	it("stdout-piped, stderr-TTY, known terminal: stderr supported, stdout not", () => {
		const r = detect(snapshot(envFor.iterm() as NodeJS.ProcessEnv, false, true));
		expect(r.supported).toBe(false);
		expect(r.supportedForStderr).toBe(true);
	});
	it("FORCE_HYPERLINK lifts both streams regardless of TTY", () => {
		const r = detect(snapshot({ FORCE_HYPERLINK: "1" }, false, false));
		expect(r.supported).toBe(true);
		expect(r.supportedForStderr).toBe(true);
	});
	it("NO_HYPERLINK disables both streams regardless of TTY", () => {
		const r = detect(snapshot({ ...envFor.iterm(), NO_HYPERLINK: "1" } as NodeJS.ProcessEnv));
		expect(r.supported).toBe(false);
		expect(r.supportedForStderr).toBe(false);
	});
	it("terminal-known-too-old applies symmetrically to both streams", () => {
		const r = detect(snapshot(envFor.iterm({ version: "3.0.0" }) as NodeJS.ProcessEnv));
		expect(r.supported).toBe(false);
		expect(r.supportedForStderr).toBe(false);
	});
});

describe("detect — explanation", () => {
	it("provides a non-empty human-readable string", () => {
		const r = detect(snapshot(envFor.iterm() as NodeJS.ProcessEnv));
		expect(typeof r.explanation).toBe("string");
		expect(r.explanation.length).toBeGreaterThan(0);
	});
});
