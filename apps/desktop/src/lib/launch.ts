/** The path the OS asked GlyphTeX to open (file association). Not a rune: the editor
 *  reads it once at mount rather than tracking it. */
export const launch: { path: string | null } = { path: null };
