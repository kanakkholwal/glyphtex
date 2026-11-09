import { errors } from "../../lib/errors.ts";
import type { Blobs } from "../types.ts";

/** Used when BLOB_DRIVER is unset: nothing is ever stored, so reads miss and deletes are no-ops. */
export function disabledBlobs(): Blobs {
	return {
		async put() {
			throw errors.storageDisabled();
		},
		async get() {
			return null;
		},
		async delete() {}
	};
}
