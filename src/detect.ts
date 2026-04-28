import { envIsTruthy } from "./env.js";
import { compareSemver } from "./semver.js";
import type { TerminalMatch } from "./terminals.js";
import { lookupTerminal } from "./terminals.js";
import type { KnownTerminal, Osc8Capabilities, Osc8Info, Osc8Reason, WrapperInfo } from "./types.js";
import { detectWrapper } from "./wrappers.js";

/**
 * Input to the pure `detect()` function. Snapshot of the relevant slice of
 * `process` at one moment.
 */
export interface ProcessSnapshot {
	readonly env: NodeJS.ProcessEnv;
	readonly isStdoutTTY: boolean;
	readonly isStderrTTY: boolean;
}

const NO_CAPS: Osc8Capabilities = {
	params: false,
	fileUrls: false,
	fileUrlsRemoteUnsafe: false,
};

const explanationFor = (
	reason: Osc8Reason,
	terminal: KnownTerminal | null,
	terminalVersion: string | null,
	wrapper: WrapperInfo | null,
): string => {
	switch (reason) {
		case "force-env":
			return "FORCE_HYPERLINK env var is set";
		case "no-hyperlink-env":
			return "NO_HYPERLINK env var is set";
		case "no-color-env":
			return "NO_COLOR env var is set";
		case "not-a-tty":
			return "stdout is not a TTY";
		case "wrapper-strips":
			return `inside ${wrapper?.name ?? "wrapper"}; passthrough not verifiable without subprocess`;
		case "terminal-known-supported":
			return `detected ${terminal}${terminalVersion ? ` ${terminalVersion}` : ""}`;
		case "terminal-known-unsupported":
			return `detected ${terminal}; terminal does not support OSC8`;
		case "terminal-known-too-old":
			return `detected ${terminal} ${terminalVersion ?? ""}; below minimum version`;
		case "terminal-unknown":
			return "no identifying signal matched";
	}
};

/**
 * Determine OSC8 support from a process snapshot. Pure: same input ⇒ same
 * output. The eager constants are `detect(readProcessSnapshot())`; the
 * function form re-runs `detect()` against a per-stream input.
 */
export const detect = (snap: ProcessSnapshot): Osc8Info => {
	const { env, isStdoutTTY, isStderrTTY } = snap;
	const wrapper = detectWrapper(env);

	const force = envIsTruthy(env.FORCE_HYPERLINK);
	const noHyperlink = envIsTruthy(env.NO_HYPERLINK);
	const noColor = envIsTruthy(env.NO_COLOR, "no-color");

	const match: TerminalMatch | null = lookupTerminal(env);
	const terminal: KnownTerminal | null = match?.entry.name ?? null;
	const terminalRaw = match?.identify.rawIdentifier ?? null;
	const terminalVersion = match?.identify.version ?? null;

	let supported: boolean;
	let reason: Osc8Reason;
	let override: Osc8Info["override"] = null;
	let capabilities: Osc8Capabilities = NO_CAPS;

	if (force) {
		supported = true;
		reason = "force-env";
		override = "force-hyperlink";
		// When forced, surface capabilities of detected terminal if any,
		// else NO_CAPS.
		if (match?.entry.supported) capabilities = match.entry.capabilities;
	} else if (noHyperlink) {
		supported = false;
		reason = "no-hyperlink-env";
		override = "no-hyperlink";
	} else if (noColor) {
		supported = false;
		reason = "no-color-env";
		override = "no-color";
	} else if (!isStdoutTTY) {
		supported = false;
		reason = "not-a-tty";
	} else if (wrapper) {
		supported = false;
		reason = "wrapper-strips";
	} else if (match) {
		if (!match.entry.supported) {
			supported = false;
			reason = "terminal-known-unsupported";
		} else if (
			match.entry.minVersion &&
			(match.identify.version === null || compareSemver(match.identify.version, match.entry.minVersion) < 0)
		) {
			supported = false;
			reason = "terminal-known-too-old";
		} else {
			supported = true;
			reason = "terminal-known-supported";
			capabilities = match.entry.capabilities;
		}
	} else {
		supported = false;
		reason = "terminal-unknown";
	}

	// supportedForStderr: re-run the gate logic for stderr only.
	// Overrides + wrapper checks share the same answer; the only divergence
	// is the not-a-tty branch.
	const stderrSupported = (() => {
		if (force) return true;
		if (noHyperlink || noColor) return false;
		if (!isStderrTTY) return false;
		if (wrapper) return false;
		if (!match) return false;
		if (!match.entry.supported) return false;
		if (
			match.entry.minVersion &&
			(match.identify.version === null || compareSemver(match.identify.version, match.entry.minVersion) < 0)
		) {
			return false;
		}
		return true;
	})();

	return {
		supported,
		supportedForStderr: stderrSupported,
		reason,
		explanation: explanationFor(reason, terminal, terminalVersion, wrapper),
		terminal,
		terminalRaw,
		terminalVersion,
		wrapper,
		isStdoutTTY,
		isStderrTTY,
		override,
		capabilities,
	};
};
