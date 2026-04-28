// src/index.ts

// Eager constants + per-stream function form
export {
	osc8,
	supportsHyperlinks,
	supportsHyperlinksFor,
	supportsHyperlinksStderr,
} from "./constants.js";

// Formatter helpers
export { closeHyperlink, link, openHyperlink } from "./link.js";

// Public types
export type {
	KnownTerminal,
	LinkOptions,
	Osc8Capabilities,
	Osc8Info,
	Osc8Params,
	Osc8Reason,
	WrapperInfo,
} from "./types.js";
