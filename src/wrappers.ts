import type { WrapperInfo } from "./types.js";

/**
 * Detect a multiplexer wrapper from the env. Conservative — `passesThrough`
 * is always `false` because we cannot verify version or config without
 * spawning a subprocess (out of scope per design).
 *
 * Users who know their tmux ≥ 3.4 has `set -g allow-passthrough on` can
 * opt back in via FORCE_HYPERLINK=1.
 */
export const detectWrapper = (env: NodeJS.ProcessEnv): WrapperInfo | null => {
	if (env.TMUX) return { name: "tmux", passesThrough: false };
	if (env.STY) return { name: "screen", passesThrough: false };
	return null;
};
