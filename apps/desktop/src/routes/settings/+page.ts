import { redirect } from '@sveltejs/kit';

// /settings has no content of its own: land on the first section.
export const load = () => {
	redirect(307, '/settings/general');
};
