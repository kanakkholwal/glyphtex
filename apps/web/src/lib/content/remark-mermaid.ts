import { visit } from "unist-util-visit";

type CodeNode = {
	type: "code";
	lang?: string | null;
	meta?: string | null;
	value: string;
	data?: Record<string, unknown>;
};

// docvia has no published mermaid plugin, so ```mermaid fences are rewritten into
// the same directive-shaped hast a `:::mermaid` block would produce.
export function remarkMermaid() {
	return (tree: unknown) => {
		visit(tree as never, "code", (node: CodeNode) => {
			if (node.lang !== "mermaid") return;
			node.data = {
				...node.data,
				hName: "div",
				hProperties: {
					"data-directive": "mermaid",
					"data-directive-type": "block",
					"data-prop-code": node.value,
					"data-prop-caption": node.meta ?? ""
				},
				hChildren: []
			};
		});
	};
}
