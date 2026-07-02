/**
 * The detected terminal program. One literal per allowlist entry in
 * src/terminals.ts. Kept as a tight union for autocomplete-friendly
 * comparisons (e.g. `osc8.terminal === "iTerm.app"`).
 *
 * @public
 */
export type KnownTerminal =
	| "iTerm.app"
	| "WezTerm"
	| "kitty"
	| "Apple_Terminal"
	| "vscode"
	| "Hyper"
	| "mintty"
	| "WindowsTerminal"
	| "Konsole"
	| "VTE"
	| "Alacritty"
	| "Ghostty"
	| "JediTerm"
	| "Tabby"
	| "Foot"
	| "Rio"
	| "Contour"
	| "ConEmu"
	| "WarpTerminal"
	| "WaveTerminal"
	| "Terminology";

/**
 * Why detection produced its verdict. The discriminator on `Osc8Info`.
 *
 * @public
 */
export type Osc8Reason =
	| "force-env"
	| "no-hyperlink-env"
	| "no-color-env"
	| "not-a-tty"
	| "wrapper-strips"
	| "terminal-known-supported"
	| "terminal-known-unsupported"
	| "terminal-known-too-old"
	| "terminal-unknown";

/**
 * Sub-feature capabilities of the detected terminal. Always populated.
 * When the terminal is unknown or unsupported, all fields are `false`.
 *
 * @public
 */
export interface Osc8Capabilities {
	/** Terminal supports `id=` / `key=value` params. */
	readonly params: boolean;
	/** Terminal renders `file://` URLs. */
	readonly fileUrls: boolean;
	/** When true, `file://` URLs misbehave over SSH/remote sessions. */
	readonly fileUrlsRemoteUnsafe: boolean;
}

/**
 * Multiplexer info, when detected.
 *
 * @public
 */
export interface WrapperInfo {
	readonly name: "tmux" | "screen";
	/**
	 * Whether the wrapper passes OSC8 through to the outer terminal. We
	 * conservatively report `false` since we cannot verify without spawning.
	 */
	readonly passesThrough: boolean;
}

/**
 * The diagnostic info record. The eager `osc8` export and the per-stream
 * function-form result both follow this shape.
 *
 * @public
 */
export interface Osc8Info {
	/** Final boolean verdict for stdout. */
	readonly supported: boolean;
	/** Final boolean verdict for stderr. */
	readonly supportedForStderr: boolean;
	/** Discriminated reason for the stdout verdict. */
	readonly reason: Osc8Reason;
	/** Human-readable summary, useful for logging. */
	readonly explanation: string;
	/** Detected terminal program, if matched against the allowlist. */
	readonly terminal: KnownTerminal | null;
	/** Raw env value used to identify the terminal (e.g. `TERM_PROGRAM`'s value). */
	readonly terminalRaw: string | null;
	/** Detected terminal version, if available. */
	readonly terminalVersion: string | null;
	/** Multiplexer info, if inside one. */
	readonly wrapper: WrapperInfo | null;
	/** Whether stdout is a TTY at detection time. */
	readonly isStdoutTTY: boolean;
	/** Whether stderr is a TTY at detection time. */
	readonly isStderrTTY: boolean;
	/** Which override produced the verdict, if any. */
	readonly override: "force-hyperlink" | "no-hyperlink" | "no-color" | null;
	/** Sub-feature capabilities of the detected terminal. */
	readonly capabilities: Osc8Capabilities;
}

/**
 * OSC8 link parameters. Most consumers only ever set `id`.
 *
 * @public
 */
export interface Osc8Params {
	readonly id?: string;
	readonly [key: string]: string | undefined;
}

/**
 * Options for the `link()` formatter helper.
 *
 * @public
 */
export interface LinkOptions {
	/** Override detection. When set, overrides per-stream auto-detection. */
	readonly enabled?: boolean;
	/** OSC8 params (id=, etc.). Silently dropped if the terminal lacks support. */
	readonly params?: Osc8Params;
	/** Fallback rendering when OSC8 is unsupported. Default: "with-url". */
	readonly fallback?: "with-url" | "label-only" | "url-only" | ((label: string, url: string) => string);
	/** Stream/fd to detect against. Default: process.stdout. */
	readonly target?: NodeJS.WriteStream | number;
}
