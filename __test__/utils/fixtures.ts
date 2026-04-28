/**
 * Builders for synthetic NodeJS.ProcessEnv values used in unit tests.
 *
 * Each builder produces an env that uniquely identifies one terminal.
 * Versions and other identifying values can be overridden per-call.
 */
export const envFor = {
	iterm: (opts: { version?: string } = {}): Partial<NodeJS.ProcessEnv> => ({
		TERM_PROGRAM: "iTerm.app",
		TERM_PROGRAM_VERSION: opts.version ?? "3.5.0",
	}),
	wezterm: (opts: { version?: string } = {}): Partial<NodeJS.ProcessEnv> => ({
		TERM_PROGRAM: "WezTerm",
		TERM_PROGRAM_VERSION: opts.version ?? "20240712",
	}),
	kitty: (): Partial<NodeJS.ProcessEnv> => ({
		TERM: "xterm-kitty",
		KITTY_WINDOW_ID: "1",
	}),
	appleTerminal: (): Partial<NodeJS.ProcessEnv> => ({
		TERM_PROGRAM: "Apple_Terminal",
		TERM_PROGRAM_VERSION: "455",
	}),
	vscode: (opts: { version?: string } = {}): Partial<NodeJS.ProcessEnv> => ({
		TERM_PROGRAM: "vscode",
		TERM_PROGRAM_VERSION: opts.version ?? "1.85.0",
	}),
	hyper: (opts: { version?: string } = {}): Partial<NodeJS.ProcessEnv> => ({
		TERM_PROGRAM: "Hyper",
		TERM_PROGRAM_VERSION: opts.version ?? "3.4.1",
	}),
	mintty: (opts: { version?: string } = {}): Partial<NodeJS.ProcessEnv> => ({
		TERM_PROGRAM: "mintty",
		TERM_PROGRAM_VERSION: opts.version ?? "3.7.0",
	}),
	windowsTerminal: (): Partial<NodeJS.ProcessEnv> => ({
		WT_SESSION: "abc-123",
	}),
	konsole: (opts: { rawVersion?: string } = {}): Partial<NodeJS.ProcessEnv> => ({
		KONSOLE_VERSION: opts.rawVersion ?? "240200",
	}),
	vte: (opts: { rawVersion?: string } = {}): Partial<NodeJS.ProcessEnv> => ({
		VTE_VERSION: opts.rawVersion ?? "7400",
	}),
	alacritty: (): Partial<NodeJS.ProcessEnv> => ({
		TERM: "alacritty",
	}),
	ghostty: (): Partial<NodeJS.ProcessEnv> => ({
		TERM_PROGRAM: "ghostty",
	}),
	jediTerm: (): Partial<NodeJS.ProcessEnv> => ({
		TERMINAL_EMULATOR: "JetBrains-JediTerm",
	}),
	tabby: (): Partial<NodeJS.ProcessEnv> => ({
		TERM_PROGRAM: "Tabby",
	}),
	foot: (): Partial<NodeJS.ProcessEnv> => ({
		TERM: "foot",
	}),
	rio: (): Partial<NodeJS.ProcessEnv> => ({
		TERM_PROGRAM: "rio",
	}),
	contour: (): Partial<NodeJS.ProcessEnv> => ({
		TERMINAL_NAME: "contour",
	}),
	conemu: (): Partial<NodeJS.ProcessEnv> => ({
		ConEmuPID: "12345",
	}),
	warp: (): Partial<NodeJS.ProcessEnv> => ({
		TERM_PROGRAM: "WarpTerminal",
	}),
	wave: (): Partial<NodeJS.ProcessEnv> => ({
		TERM_PROGRAM: "WaveTerminal",
	}),
	terminology: (): Partial<NodeJS.ProcessEnv> => ({
		TERMINOLOGY: "1",
	}),
	tmux: (): Partial<NodeJS.ProcessEnv> => ({
		TMUX: "/tmp/tmux-501/default,123,0",
	}),
	screen: (): Partial<NodeJS.ProcessEnv> => ({
		STY: "12345.pts-0.host",
	}),
	unknown: (): Partial<NodeJS.ProcessEnv> => ({
		TERM: "xterm-256color",
	}),
} as const;
