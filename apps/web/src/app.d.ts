// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

// docvia emits its virtual-module types at the project root, outside SvelteKit's
// tsconfig include; pull them in so `virtual:docvia/source` type-checks.
/// <reference path="../docvia-env.d.ts" />

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
