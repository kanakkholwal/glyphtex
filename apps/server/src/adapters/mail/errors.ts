/** A send that can never succeed (bad sender, recipient not allowed): the job is dropped, not retried. */
export class PermanentMailError extends Error {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = "PermanentMailError";
	}
}
