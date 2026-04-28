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

/** Outcome of running the precedence gate for a single stream's TTY state. */
interface Gate {
	readonly supported: boolean;
	readonly reason: Osc8Reason;
	readonly override: Osc8Info["override"];
}

/**
 * Run the 7-rule precedence ladder for a single stream's TTY state.
 * Shared by stdout and stderr so the two paths cannot drift.
 */
const evaluateGate = (
	isTTY: boolean,
	force: boolean,
	noHyperlink: boolean,
	noColor: boolean,
	wrapper: WrapperInfo | null,
	match: TerminalMatch | null,
): Gate => {
	if (force) return { supported: true, reason: "force-env", override: "force-hyperlink" };
	if (noHyperlink) return { supported: false, reason: "no-hyperlink-env", override: "no-hyperlink" };
	if (noColor) return { supported: false, reason: "no-color-env", override: "no-color" };
	if (!isTTY) return { supported: false, reason: "not-a-tty", override: null };
	if (wrapper) return { supported: false, reason: "wrapper-strips", override: null };
	if (!match) return { supported: false, reason: "terminal-unknown", override: null };
	if (!match.entry.supported) return { supported: false, reason: "terminal-known-unsupported", override: null };
	if (
		match.entry.minVersion &&
		(match.identify.version === null || compareSemver(match.identify.version, match.entry.minVersion) < 0)
	) {
		return { supported: false, reason: "terminal-known-too-old", override: null };
	}
	return { supported: true, reason: "terminal-known-supported", override: null };
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

	const stdout = evaluateGate(isStdoutTTY, force, noHyperlink, noColor, wrapper, match);
	const stderr = evaluateGate(isStderrTTY, force, noHyperlink, noColor, wrapper, match);

	// Capabilities are an intrinsic property of the detected terminal — not
	// gated by stream TTY state. A piped stdout still tells us the terminal
	// has params support; the gate decides whether to USE them. Without
	// this decoupling, callers targeting stderr would see params silently
	// dropped whenever stdout happens to be piped.
	const capabilities: Osc8Capabilities = match?.entry.capabilities ?? NO_CAPS;

	return {
		supported: stdout.supported,
		supportedForStderr: stderr.supported,
		reason: stdout.reason,
		explanation: explanationFor(stdout.reason, terminal, terminalVersion, wrapper),
		terminal,
		terminalRaw,
		terminalVersion,
		wrapper,
		isStdoutTTY,
		isStderrTTY,
		override: stdout.override,
		capabilities,
	};
};
