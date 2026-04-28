import { describe, expect, it } from "vitest";
import { lookupTerminal } from "../src/terminals.js";
import { envFor } from "./utils/fixtures.js";

describe("lookupTerminal", () => {
	it("returns null when no terminal is identified", () => {
		expect(lookupTerminal(envFor.unknown() as NodeJS.ProcessEnv)).toBe(null);
	});

	describe("iTerm.app", () => {
		it("identifies iTerm2 with TERM_PROGRAM=iTerm.app", () => {
			const m = lookupTerminal(envFor.iterm({ version: "3.5.0" }) as NodeJS.ProcessEnv);
			expect(m).not.toBeNull();
			expect(m?.entry.name).toBe("iTerm.app");
			expect(m?.entry.supported).toBe(true);
			expect(m?.identify.version).toBe("3.5.0");
			expect(m?.identify.rawIdentifier).toBe("iTerm.app");
		});
		it("populates capabilities (params + fileUrls true)", () => {
			const m = lookupTerminal(envFor.iterm() as NodeJS.ProcessEnv);
			expect(m?.entry.capabilities.params).toBe(true);
			expect(m?.entry.capabilities.fileUrls).toBe(true);
		});
	});

	describe("Apple_Terminal", () => {
		it("identifies Apple Terminal as known but unsupported", () => {
			const m = lookupTerminal(envFor.appleTerminal() as NodeJS.ProcessEnv);
			expect(m?.entry.name).toBe("Apple_Terminal");
			expect(m?.entry.supported).toBe(false);
			expect(m?.entry.capabilities.params).toBe(false);
			expect(m?.entry.capabilities.fileUrls).toBe(false);
		});
	});

	describe("VTE-based terminals", () => {
		it("decodes VTE_VERSION packed integer to semver", () => {
			const m = lookupTerminal(envFor.vte({ rawVersion: "5202" }) as NodeJS.ProcessEnv);
			expect(m?.entry.name).toBe("VTE");
			expect(m?.identify.version).toBe("0.52.2");
		});
		it("min version is 0.50.0", () => {
			const m = lookupTerminal(envFor.vte() as NodeJS.ProcessEnv);
			expect(m?.entry.minVersion).toBe("0.50.0");
		});
	});

	describe("Konsole", () => {
		it("decodes KONSOLE_VERSION packed integer", () => {
			const m = lookupTerminal(envFor.konsole({ rawVersion: "240200" }) as NodeJS.ProcessEnv);
			expect(m?.entry.name).toBe("Konsole");
			expect(m?.identify.version).toBe("24.2.0");
		});
		it("min version is 22.4.0", () => {
			const m = lookupTerminal(envFor.konsole() as NodeJS.ProcessEnv);
			expect(m?.entry.minVersion).toBe("22.4.0");
		});
	});

	describe("WezTerm", () => {
		it("identifies WezTerm with any version", () => {
			const m = lookupTerminal(envFor.wezterm() as NodeJS.ProcessEnv);
			expect(m?.entry.name).toBe("WezTerm");
			expect(m?.entry.minVersion).toBe(null);
		});
	});

	describe("kitty", () => {
		it("identifies kitty via TERM=xterm-kitty", () => {
			const m = lookupTerminal(envFor.kitty() as NodeJS.ProcessEnv);
			expect(m?.entry.name).toBe("kitty");
		});
	});

	describe("vscode", () => {
		it("identifies VS Code with min version 1.71", () => {
			const m = lookupTerminal(envFor.vscode() as NodeJS.ProcessEnv);
			expect(m?.entry.name).toBe("vscode");
			expect(m?.entry.minVersion).toBe("1.71.0");
			expect(m?.entry.capabilities.fileUrlsRemoteUnsafe).toBe(true);
		});
	});

	describe("Hyper", () => {
		it("identifies Hyper with min version 3.0", () => {
			const m = lookupTerminal(envFor.hyper() as NodeJS.ProcessEnv);
			expect(m?.entry.name).toBe("Hyper");
			expect(m?.entry.minVersion).toBe("3.0.0");
		});
	});

	describe("mintty", () => {
		it("identifies mintty with min version 3.6", () => {
			const m = lookupTerminal(envFor.mintty() as NodeJS.ProcessEnv);
			expect(m?.entry.name).toBe("mintty");
			expect(m?.entry.minVersion).toBe("3.6.0");
		});
	});

	describe("WindowsTerminal", () => {
		it("identifies via WT_SESSION", () => {
			const m = lookupTerminal(envFor.windowsTerminal() as NodeJS.ProcessEnv);
			expect(m?.entry.name).toBe("WindowsTerminal");
			expect(m?.identify.rawIdentifier).toBe("abc-123");
		});
	});

	describe("Alacritty", () => {
		it("identifies via TERM=alacritty with no version gate", () => {
			const m = lookupTerminal(envFor.alacritty() as NodeJS.ProcessEnv);
			expect(m?.entry.name).toBe("Alacritty");
			// minVersion is null because TERM=alacritty carries no version info;
			// gating on a minVersion would falsely reject every Alacritty user.
			expect(m?.entry.minVersion).toBe(null);
		});
	});

	describe("Ghostty", () => {
		it("identifies via TERM_PROGRAM=ghostty", () => {
			const m = lookupTerminal(envFor.ghostty() as NodeJS.ProcessEnv);
			expect(m?.entry.name).toBe("Ghostty");
		});
	});

	describe("JediTerm", () => {
		it("identifies via TERMINAL_EMULATOR=JetBrains-JediTerm", () => {
			const m = lookupTerminal(envFor.jediTerm() as NodeJS.ProcessEnv);
			expect(m?.entry.name).toBe("JediTerm");
		});
	});

	describe("Tabby", () => {
		it("identifies via TERM_PROGRAM=Tabby", () => {
			const m = lookupTerminal(envFor.tabby() as NodeJS.ProcessEnv);
			expect(m?.entry.name).toBe("Tabby");
		});
	});

	describe("Foot", () => {
		it("identifies via TERM=foot", () => {
			const m = lookupTerminal(envFor.foot() as NodeJS.ProcessEnv);
			expect(m?.entry.name).toBe("Foot");
		});
	});

	describe("Rio", () => {
		it("identifies via TERM_PROGRAM=rio", () => {
			const m = lookupTerminal(envFor.rio() as NodeJS.ProcessEnv);
			expect(m?.entry.name).toBe("Rio");
		});
	});

	describe("Contour", () => {
		it("identifies via TERMINAL_NAME=contour", () => {
			const m = lookupTerminal(envFor.contour() as NodeJS.ProcessEnv);
			expect(m?.entry.name).toBe("Contour");
		});
	});

	describe("ConEmu", () => {
		it("identifies via ConEmuPID being set", () => {
			const m = lookupTerminal(envFor.conemu() as NodeJS.ProcessEnv);
			expect(m?.entry.name).toBe("ConEmu");
		});
	});

	describe("WarpTerminal", () => {
		it("identifies via TERM_PROGRAM=WarpTerminal", () => {
			const m = lookupTerminal(envFor.warp() as NodeJS.ProcessEnv);
			expect(m?.entry.name).toBe("WarpTerminal");
		});
	});

	describe("WaveTerminal", () => {
		it("identifies via TERM_PROGRAM=WaveTerminal", () => {
			const m = lookupTerminal(envFor.wave() as NodeJS.ProcessEnv);
			expect(m?.entry.name).toBe("WaveTerminal");
		});
	});

	describe("Terminology", () => {
		it("identifies as known unsupported", () => {
			const m = lookupTerminal(envFor.terminology() as NodeJS.ProcessEnv);
			expect(m?.entry.name).toBe("Terminology");
			expect(m?.entry.supported).toBe(false);
		});
	});
});
