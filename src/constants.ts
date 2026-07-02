import { isatty } from "node:tty";
import { detect } from "./detect.js";
import { readProcessSnapshot } from "./snapshot.js";
import type { Osc8Info } from "./types.js";

const eagerSnapshot = readProcessSnapshot();
const eager: Osc8Info = detect(eagerSnapshot);

/**
 * Whether stdout supports OSC8 hyperlinks. Computed once at module import.
 *
 * @public
 */
export const supportsHyperlinks: boolean = eager.supported;

/**
 * Whether stderr supports OSC8 hyperlinks. Computed once at module import.
 *
 * @public
 */
export const supportsHyperlinksStderr: boolean = eager.supportedForStderr;

/**
 * Diagnostic info object. Computed once at module import.
 *
 * @public
 */
export const osc8: Osc8Info = eager;

/**
 * Determine OSC8 support for a specific stream or fd. Recomputes detection
 * with the target's TTY state but reuses the import-time env snapshot.
 *
 * Accepts a WriteStream-like (anything with `.isTTY`), or a numeric fd:
 * fds 1 and 2 use the cached process flags; other fds go through
 * `node:tty.isatty()`.
 *
 * @public
 */
export const supportsHyperlinksFor = (target: NodeJS.WriteStream | number): boolean => {
	let isTTY: boolean;
	if (typeof target === "number") {
		if (target === 1) isTTY = eagerSnapshot.isStdoutTTY;
		else if (target === 2) isTTY = eagerSnapshot.isStderrTTY;
		else isTTY = isatty(target);
	} else {
		isTTY = Boolean(target?.isTTY);
	}
	return detect({
		env: eagerSnapshot.env,
		isStdoutTTY: isTTY,
		isStderrTTY: isTTY,
	}).supported;
};
