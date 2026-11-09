import { AwsClient } from "aws4fetch";
import { createPolicy, HttpError, retryableHttp } from "../../lib/resilience.ts";
import type { Blobs } from "../types.ts";

export interface S3Options {
	endpoint: string;
	region: string;
	bucket: string;
	accessKeyId: string;
	secretAccessKey: string;
}

const DELETE_BATCH = 1000;

/** Any S3-compatible store (AWS, R2 S3 API, MinIO, B2, Tigris); fetch-based, so it runs everywhere. */
export function s3Blobs(o: S3Options): Blobs {
	const client = new AwsClient({
		accessKeyId: o.accessKeyId,
		secretAccessKey: o.secretAccessKey,
		region: o.region,
		service: "s3"
	});
	const policy = createPolicy("Blob storage", {
		retry: { shouldRetry: retryableHttp },
		timeoutMs: 30_000
	});
	const url = (key = "") =>
		`${o.endpoint.replace(/\/$/, "")}/${o.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;

	const send = (input: string, init: RequestInit, signal: AbortSignal) =>
		client.fetch(input, { ...init, signal }).then(async (res) => {
			if (!res.ok && res.status !== 404) {
				throw new HttpError(res.status, `S3 ${init.method ?? "GET"} failed: ${res.status}`);
			}
			return res;
		});

	return {
		async put(key, data, contentType) {
			await policy.run((signal) =>
				send(
					url(key),
					{
						method: "PUT",
						body: data as BodyInit,
						headers: contentType ? { "content-type": contentType } : {}
					},
					signal
				)
			);
		},
		async get(key) {
			const res = await policy.run((signal) => send(url(key), { method: "GET" }, signal));
			if (res.status === 404 || !res.body) return null;
			return {
				body: res.body,
				size: Number(res.headers.get("content-length") ?? 0),
				contentType: res.headers.get("content-type") ?? undefined
			};
		},
		async delete(keys) {
			for (let i = 0; i < keys.length; i += DELETE_BATCH) {
				const batch = keys.slice(i, i + DELETE_BATCH);
				const body = `<Delete><Quiet>true</Quiet>${batch
					.map((k) => `<Object><Key>${escapeXml(k)}</Key></Object>`)
					.join("")}</Delete>`;
				// AWS rejects multi-object delete without an integrity checksum.
				const checksum = await sha256Base64(body);
				await policy.run((signal) =>
					send(
						`${url()}?delete`,
						{
							method: "POST",
							body,
							headers: {
								"content-type": "application/xml",
								"x-amz-sdk-checksum-algorithm": "SHA256",
								"x-amz-checksum-sha256": checksum
							}
						},
						signal
					)
				);
			}
		}
	};
}

const escapeXml = (s: string) =>
	s.replace(
		/[<>&'"]/g,
		(c) => `&${{ "<": "lt", ">": "gt", "&": "amp", "'": "apos", '"': "quot" }[c]};`
	);

async function sha256Base64(text: string) {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	return btoa(String.fromCharCode(...new Uint8Array(digest)));
}
