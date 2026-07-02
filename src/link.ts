import { osc8, supportsHyperlinksFor } from "./constants.js";
import type { LinkOptions, Osc8Params } from "./types.js";

/** OSC8 introducer + ST terminator. Used universally. */
const OSC = "\x1b]";
const ST = "\x1b\\";
// biome-ignore lint/suspicious/noControlCharactersInRegex: Pattern intentionally matches control characters (0x00-0x1F, 0x7F)
const INVALID_PARAM_VALUE_RE = /[;:\x00-\x1f\x7f]/;

const serializeParams = (params: Osc8Params | undefined): string => {
	if (!params) return "";
	const parts: string[] = [];
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined) continue;
		if (INVALID_PARAM_VALUE_RE.test(value)) {
			throw new TypeError(`OSC8 param '${key}' contains invalid character (no ; : or control chars allowed)`);
		}
		parts.push(`${key}=${value}`);
	}
	return parts.join(":");
};

/**
 * Emit the OSC8 close sequence, ending an in-progress hyperlink.
 *
 * Use with `openHyperlink` for streaming output where the label is built
 * up incrementally between the open and close.
 *
 * @public
 */
export const closeHyperlink = (): string => `${OSC}8;;${ST}`;

/**
 * Emit the OSC8 open sequence introducing a hyperlink to `url`.
 *
 * Throws `TypeError` if a param value contains `;`, `:`, or control
 * characters. Validation runs even if the terminal does not support OSC8.
 *
 * @public
 */
export const openHyperlink = (url: string, params?: Osc8Params): string =>
	`${OSC}8;${serializeParams(params)};${url}${ST}`;

/**
 * Render `label` as a hyperlink to `url` when OSC8 is supported, else
 * a configurable fallback rendering. Always validates `params` regardless
 * of whether OSC8 will actually be emitted.
 *
 * @public
 */
export const link = (label: string, url: string, options?: LinkOptions): string => {
	// Validate params first so malformed values throw even when emit is skipped.
	const paramsString = serializeParams(options?.params);

	const enabled = options?.enabled ?? supportsHyperlinksFor(options?.target ?? process.stdout);

	if (!enabled) {
		const fb = options?.fallback ?? "with-url";
		if (typeof fb === "function") return fb(label, url);
		switch (fb) {
			case "with-url":
				return `${label} (${url})`;
			case "label-only":
				return label;
			case "url-only":
				return url;
		}
	}

	// When enabled is explicitly set, trust the caller fully and bypass the
	// capability gate. Otherwise gate on osc8.capabilities.params.
	const useParams = options?.enabled === true || osc8.capabilities.params;
	const effectiveParams = useParams ? paramsString : "";
	return `${OSC}8;${effectiveParams};${url}${ST}${label}${OSC}8;;${ST}`;
};
