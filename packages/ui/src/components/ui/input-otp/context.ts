import { getContext, hasContext, setContext } from "svelte";
import type {
	InputOtpInvalidMotion,
	InputOtpSize,
	InputOtpStatus,
	InputOtpVariant
} from "./variants";

export type InputOtpStyle = {
	variant: InputOtpVariant;
	size: InputOtpSize;
	invalid: boolean;
	invalidMotion: InputOtpInvalidMotion;
	status: InputOtpStatus;
};

/** The slots the last change filled, so a pasted code lands one slot after another. */
export type InputOtpChange = { from: number; count: number };

const STYLE = Symbol("input-otp-style");
const CHANGE = Symbol("input-otp-change");

export const setInputOtpStyle = (get: () => InputOtpStyle) => setContext(STYLE, get);
const DEFAULT_STYLE: InputOtpStyle = {
	variant: "default",
	size: "default",
	invalid: false,
	invalidMotion: "shake",
	status: "idle"
};
/** Call during init; the getter it returns reads the root's latest style props. */
export const getInputOtpStyle = (): (() => InputOtpStyle) =>
	hasContext(STYLE) ? getContext<() => InputOtpStyle>(STYLE) : () => DEFAULT_STYLE;

export const setInputOtpChange = (get: () => InputOtpChange) => setContext(CHANGE, get);
export const getInputOtpChange = (): (() => InputOtpChange) =>
	hasContext(CHANGE) ? getContext<() => InputOtpChange>(CHANGE) : () => ({ from: 0, count: 0 });
