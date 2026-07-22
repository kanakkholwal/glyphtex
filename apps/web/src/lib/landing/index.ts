// Landing-specific components. Only used on the marketing site. Kept under
// `apps/web/src/lib/landing/` so the shared `@glyphtex/ui` package stays
// focused on the editor + chrome primitives these pages reuse.

export { default as BeforeAfterSlider } from './BeforeAfterSlider.svelte';
export { default as Container } from './Container.svelte';
export { default as ContainerTextFlip } from './ContainerTextFlip.svelte';
export { default as EditorMock } from './EditorMock.svelte';
export { default as HeroBackdrop } from './HeroBackdrop.svelte';
export { default as MacWindow } from './MacWindow.svelte';
export { default as PolishGrid } from './PolishGrid.svelte';
export { default as Section } from './Section.svelte';
export { default as ShowcasePanel } from './ShowcasePanel.svelte';

export { footerCols, footerSocials, navLinks, REPO_URL } from './nav-data';
