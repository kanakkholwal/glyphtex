const encoder = new TextEncoder();

export const newId = () => crypto.randomUUID();

function toHex(buffer: ArrayBuffer) {
	return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(data: Uint8Array | string) {
	const bytes = typeof data === "string" ? encoder.encode(data) : data;
	return toHex(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
}

/** A 256-bit URL-safe secret; only its hash is stored, so a DB leak can't redeem links. */
export function newToken() {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

export const hashToken = (token: string) => sha256Hex(token);
