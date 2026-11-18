/** WebSocket close codes the editor understands; 4000-4999 is the application range. */
export const LIVE_CLOSE = {
	/** The file already has the maximum number of live editors. */
	full: 4001,
	/** The session reached its time limit; the user can start a new one. */
	sessionLimit: 4003
} as const;
