export type V = [number, number, number];
export type BoxFaces = { top: string; left: string; right: string };

const C = Math.cos(Math.PI / 6);
const S = 0.5;
const f = (n: number) => n.toFixed(1);

/** 30° isometric projection that tracks the drawn extent so each scene can size its own viewBox. */
export function createScene() {
	const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

	function project([x, y, z]: V): [number, number] {
		const sx = (x - y) * C;
		const sy = (x + y) * S - z;
		bounds.minX = Math.min(bounds.minX, sx);
		bounds.maxX = Math.max(bounds.maxX, sx);
		bounds.minY = Math.min(bounds.minY, sy);
		bounds.maxY = Math.max(bounds.maxY, sy);
		return [sx, sy];
	}

	const poly = (vs: V[]) => vs.map((v) => project(v).map(f).join(",")).join(" ");

	function box(x: number, y: number, z: number, w: number, d: number, h: number): BoxFaces {
		return {
			top: poly([
				[x, y, z + h],
				[x + w, y, z + h],
				[x + w, y + d, z + h],
				[x, y + d, z + h]
			]),
			right: poly([
				[x + w, y, z],
				[x + w, y + d, z],
				[x + w, y + d, z + h],
				[x + w, y, z + h]
			]),
			left: poly([
				[x, y + d, z],
				[x + w, y + d, z],
				[x + w, y + d, z + h],
				[x, y + d, z + h]
			])
		};
	}

	/** Four-sided roof; only the two viewer-facing triangles are drawn. */
	function pyramid(x: number, y: number, z: number, w: number, d: number, h: number) {
		const apex: V = [x + w / 2, y + d / 2, z + h];
		return {
			left: poly([[x, y + d, z], [x + w, y + d, z], apex]),
			right: poly([[x + w, y, z], [x + w, y + d, z], apex])
		};
	}

	/** Maps flat 2D decal coordinates onto the plane at height z. */
	const plane = (z: number) => `matrix(${C} ${S} ${-C} ${S} 0 ${-z})`;

	/** Decal space on a box's right face (x fixed): u runs along +y, v runs up from (x, y0, z0). */
	function rightFace(x: number, y0: number, z0: number) {
		const [ex, ey] = project([x, y0, z0]);
		return `matrix(${-C} ${S} 0 -1 ${f(ex)} ${f(ey)})`;
	}

	/** Decal space on a box's left face (y fixed): u runs along +x, v runs up from (x0, y, z0). */
	function leftFace(x0: number, y: number, z0: number) {
		const [ex, ey] = project([x0, y, z0]);
		return `matrix(${C} ${S} 0 -1 ${f(ex)} ${f(ey)})`;
	}

	/** Quadratic tether that arcs `lift` px above the higher end. */
	function tether(from: V, to: V, lift = 30) {
		const [fx, fy] = project(from);
		const [tx, ty] = project(to);
		return `M${f(fx)} ${f(fy)}Q${f((fx + tx) / 2)} ${f(Math.min(fy, ty) - lift)} ${f(tx)} ${f(ty)}`;
	}

	/** A polyline on the ground plane (z = 0) from flat x, y pairs. */
	function groundPath(pts: number[], z = 0) {
		const out: string[] = [];
		for (let i = 0; i < pts.length; i += 2)
			out.push(
				project([pts[i], pts[i + 1], z])
					.map(f)
					.join(" ")
			);
		return `M${out.join("L")}`;
	}

	function viewBox(pad = 24) {
		return [
			bounds.minX - pad,
			bounds.minY - pad,
			bounds.maxX - bounds.minX + pad * 2,
			bounds.maxY - bounds.minY + pad * 2
		]
			.map(f)
			.join(" ");
	}

	return { project, poly, box, pyramid, plane, rightFace, leftFace, tether, groundPath, viewBox };
}
