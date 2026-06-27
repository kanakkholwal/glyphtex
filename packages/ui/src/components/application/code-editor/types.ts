/** Find/replace types for the editor surface (pure). */

export type SearchOptions = {
  query: string;
  replace?: string;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regexp?: boolean;
  /** Recase each replacement to match the case of the text it replaces. */
  preserveCase?: boolean;
};

export type SearchMatch = {
  from: number;
  to: number;
  line: number;
  column: number;
  text: string;
};
