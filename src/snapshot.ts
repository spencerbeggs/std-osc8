import type { ProcessSnapshot } from "./detect.js";

/**
 * Read the current `process.env` and TTY flags into a `ProcessSnapshot`.
 * Used to seed the eager constants and as the fallback input when the
 * function form is called without a target.
 */
export const readProcessSnapshot = (): ProcessSnapshot => ({
	env: process.env,
	isStdoutTTY: Boolean(process.stdout?.isTTY),
	isStderrTTY: Boolean(process.stderr?.isTTY),
});
