import { listGuides } from "$lib/server/guides";
import { LATEX_COMMANDS, LATEX_PACKAGES } from "@glyphtex/ui/editor";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = () => ({
	counts: {
		commands: LATEX_COMMANDS.length,
		packages: LATEX_PACKAGES.length,
		guides: listGuides().length
	}
});
