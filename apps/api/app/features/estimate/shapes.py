"""Shapes: each solid element's surface in world coordinates, in metres, read once for the whole model
(ifcopenshell.geom on every core). A shape knows its volume, its box, and each triangle's area, centre and which way it
faces: a top, a bottom (a soffit, an underside) or a side. Formwork, beds and the checks are worked out from these, and
so is any quantity the model does not state.

Contact: where two elements touch, the faces between them get no formwork. Faces are cut into pieces of at most PIECE
and each piece is tested by its centre against the other element's box, from both sides (a slab's soffit against the
beam, and the beam's top against the slab)."""

import multiprocessing
from dataclasses import dataclass, field

import numpy as np

UP = 0.7  # a face whose normal is within ~45° of vertical is a top or a bottom
TOUCH = 0.02  # m: faces this close to another element's box touch it
CELL = 2.0  # m: the grid that finds an element's neighbours
PIECE = 0.3  # m: faces are tested in pieces no longer than this


@dataclass
class Shape:
    volume: float
    lo: np.ndarray  # the box's lowest corner (x, y, z)
    hi: np.ndarray
    centres: np.ndarray = field(repr=False)  # (n, 3) each triangle's centre
    areas: np.ndarray = field(repr=False)  # (n,)
    facing: np.ndarray = field(repr=False)  # (n,) 1 top, -1 bottom, 0 side
    heights: np.ndarray = field(repr=False)  # (n, 3) each triangle's corner heights, lowest first
    low: np.ndarray = field(repr=False)  # (n, 3) each triangle's own box
    high: np.ndarray = field(repr=False)

    def area(self, facing: int, mask: np.ndarray | None = None) -> float:
        chosen = self.facing == facing if mask is None else (self.facing == facing) & mask
        return float(self.areas[chosen].sum())

    @property
    def size(self) -> np.ndarray:
        return self.hi - self.lo

    def quantities(self) -> dict:
        """What the shape says when the model says nothing: volume, the larger of its plan or one face, length, height."""
        dx, dy, dz = self.size
        return {'volume': self.volume, 'area': max(self.area(-1), self.area(0) / 2), 'length': float(max(dx, dy)),
                'height': float(dz), 'footprint': self.area(-1)}

    def within(self, other: 'Shape') -> np.ndarray:
        """Which of this shape's triangles lie wholly in the other's box: a big soffit triangle is not under a beam just
        because its centre is."""
        return np.all((self.low >= other.lo - TOUCH) & (self.high <= other.hi + TOUCH), axis=1)

    def inside(self, other: 'Shape', axes: slice = slice(0, 3)) -> np.ndarray:
        """Which of this shape's triangles have their centre on or in the other's box (in plan only: axes=slice(0, 2))."""
        return np.all((self.centres[:, axes] >= other.lo[axes] - TOUCH) & (self.centres[:, axes] <= other.hi[axes] + TOUCH), axis=1)

    def between(self, low: float, high: float, chosen: np.ndarray) -> np.ndarray:
        """The share of each chosen triangle's area that lies between two heights, exactly (a floor's band on a wall);
        0 for the rest."""
        share = np.zeros(len(self.areas))
        if chosen.any():
            heights = self.heights[chosen]
            share[chosen] = below(heights, high) - below(heights, low)
        return share


def below(heights: np.ndarray, t: float) -> np.ndarray:
    """The share of each triangle's area lower than t: the area of a triangle up to a height grows with its square."""
    z0, z1, z2 = heights.T
    span = z2 - z0
    tiny = 1e-9
    rising = (t - z0) ** 2 / np.maximum(span * (z1 - z0), tiny)
    falling = 1 - (z2 - t) ** 2 / np.maximum(span * (z2 - z1), tiny)
    share = np.where(t <= z0, 0.0, np.where(t >= z2, 1.0, np.where(t <= z1, rising, falling)))
    return np.where(span < tiny, (t > z0).astype(float), np.clip(share, 0.0, 1.0))


def split(a: np.ndarray, b: np.ndarray, c: np.ndarray, limit: float) -> tuple:
    """Triangles cut in two across their longest side until no side is longer than limit, keeping their winding: a
    wall's face is two triangles 11m tall, and one centre cannot say which part of it touches a floor."""
    while True:
        sides = np.stack([np.linalg.norm(b - c, axis=1), np.linalg.norm(c - a, axis=1), np.linalg.norm(a - b, axis=1)], axis=1)
        big = sides.max(axis=1) > limit
        if not big.any():
            return a, b, c
        k = sides[big].argmax(axis=1)  # turn each so its longest side is b–c
        A, B, C = a[big], b[big], c[big]
        A, B, C = (np.where((k == 0)[:, None], A, np.where((k == 1)[:, None], B, C)),
                   np.where((k == 0)[:, None], B, np.where((k == 1)[:, None], C, A)),
                   np.where((k == 0)[:, None], C, np.where((k == 1)[:, None], A, B)))
        middle = (B + C) / 2
        a = np.concatenate([a[~big], A, A])
        b = np.concatenate([b[~big], B, middle])
        c = np.concatenate([c[~big], middle, C])


def from_mesh(verts, faces) -> Shape | None:
    v = np.asarray(verts, dtype=float).reshape(-1, 3)
    f = np.asarray(faces, dtype=int).reshape(-1, 3)
    if not len(f):
        return None
    a, b, c = v[f[:, 0]], v[f[:, 1]], v[f[:, 2]]
    volume = abs(float(np.einsum('ij,ij->i', a, np.cross(b, c)).sum()) / 6)
    cross = np.cross(b - a, c - a)
    doubled = np.linalg.norm(cross, axis=1)
    keep = doubled > 1e-9
    a, b, c, cross, doubled = a[keep], b[keep], c[keep], cross[keep], doubled[keep]
    nz = cross[:, 2] / doubled
    facing = np.where(nz > UP, 1, np.where(nz < -UP, -1, 0))
    # a build-up exported one solid per layer: where a layer's top meets the next one's underside is inside the
    # element, not a surface of it
    level = np.round((a[:, 2] + b[:, 2] + c[:, 2]) / 3 / 0.005).astype(int)
    inner = np.intersect1d(level[facing == 1], level[facing == -1])
    keep = ~((facing != 0) & np.isin(level, inner))
    a, b, c, facing = a[keep], b[keep], c[keep], facing[keep]
    upright = facing == 0  # only sides are cut into pieces: their touching is a band in height, their plan a line
    pieces = split(a[upright], b[upright], c[upright], PIECE)
    a, b, c = (np.concatenate([part[~upright], piece]) for part, piece in zip((a, b, c), pieces))
    cross = np.cross(b - a, c - a)
    doubled = np.linalg.norm(cross, axis=1)
    nz = cross[:, 2] / np.maximum(doubled, 1e-12)
    return Shape(volume=volume, lo=v.min(axis=0), hi=v.max(axis=0), centres=(a + b + c) / 3, areas=doubled / 2,
                 facing=np.where(nz > UP, 1, np.where(nz < -UP, -1, 0)), heights=np.sort(np.stack([a[:, 2], b[:, 2], c[:, 2]], axis=1), axis=1),
                 low=np.minimum(np.minimum(a, b), c), high=np.maximum(np.maximum(a, b), c))


def read_shapes(ifc, entities: list, world: bool = True) -> dict[int, Shape]:
    """{entity id: Shape} for the entities whose geometry can be read; the rest are left out (the caller flags them)."""
    if not entities:
        return {}
    import ifcopenshell.geom as G

    settings = G.settings()
    settings.set('use-world-coords', world)
    out: dict[int, Shape] = {}
    iterator = G.iterator(settings, ifc, multiprocessing.cpu_count(), include=entities)
    if iterator.initialize():
        while True:
            item = iterator.get()
            shape = from_mesh(item.geometry.verts, item.geometry.faces)
            if shape:
                out[item.id] = shape
            if not iterator.next():
                break
    return out


def one_shape(entity) -> Shape | None:
    """One element's shape, for an element read without one that turns out to need it."""
    import ifcopenshell.geom as G

    settings = G.settings()
    settings.set('use-world-coords', True)
    try:
        geometry = G.create_shape(settings, entity).geometry
    except Exception:
        return None
    return from_mesh(geometry.verts, geometry.faces)


def neighbours(shapes: dict) -> dict:
    """{key: [keys of shapes whose boxes touch it]}, through a coarse grid so a big model is not every pair."""
    grid: dict[tuple, list] = {}
    for key, shape in shapes.items():
        lo, hi = np.floor((shape.lo - TOUCH) / CELL).astype(int), np.floor((shape.hi + TOUCH) / CELL).astype(int)
        for cx in range(lo[0], hi[0] + 1):
            for cy in range(lo[1], hi[1] + 1):
                for cz in range(lo[2], hi[2] + 1):
                    grid.setdefault((cx, cy, cz), []).append(key)
    near: dict = {key: set() for key in shapes}
    for keys in grid.values():
        for key in keys:
            near[key].update(keys)
    out = {}
    for key, others in near.items():
        a = shapes[key]
        out[key] = [o for o in others if o != key and np.all(a.lo - TOUCH <= shapes[o].hi) and np.all(shapes[o].lo - TOUCH <= a.hi)]
    return out


def contact(shape: Shape, others: list[Shape]) -> dict[int, float]:
    """The area of this shape's tops, bottoms and sides that touches the others: {1: m², -1: m², 0: m²}.
    ponytail: box contact, exact for square-cut frames; a raked or curved member touching another can lose a little
    more than it should (a mesh boolean is the upgrade if that shows in a real job)."""
    touched = np.zeros(len(shape.areas))  # the share of each triangle that touches something
    mirrored = {1: 0.0, -1: 0.0, 0: 0.0}
    levels = {facing: np.unique(np.round(shape.centres[shape.facing == facing, 2], 3)) for facing in (1, -1)}
    sides = shape.facing == 0
    for other in others:
        flat = shape.within(other) & ~sides
        # a side touches the other where it runs through the other's depth: a floor's band on a wall, not a beam's
        # side just under the slab it carries
        upright = shape.between(other.lo[2], other.hi[2], sides & shape.inside(other, slice(0, 2)))
        touched = np.maximum(touched, np.maximum(flat.astype(float), upright))
        theirs = other.within(shape)
        for facing in (1, -1):  # the other's tops against this one's bottoms (and the reverse), at this one's own level
            chosen = theirs & (other.facing == -facing)
            if len(levels[facing]) and chosen.any():
                on = np.abs(other.centres[chosen, 2][:, None] - levels[facing][None, :]).min(axis=1) <= TOUCH
                mirrored[facing] += float(other.areas[chosen][on].sum())
        their_sides = (other.facing == 0) & other.inside(shape, slice(0, 2))
        mirrored[0] += float((other.areas * other.between(shape.lo[2], shape.hi[2], their_sides)).sum())
    out = {}
    for facing in (1, -1, 0):
        seen = [found for found in (float((shape.areas * touched)[shape.facing == facing].sum()), mirrored[facing]) if found > 1e-9]
        # both sides see the contact: the smaller (each is measured in pieces, and a piece on the edge counts whole);
        # only one sees it (an element through another's box): that one
        out[facing] = min(shape.area(facing), min(seen) if seen else 0.0)
    return out


def free(shape: Shape, others: list[Shape]) -> dict[int, float]:
    """The area of each facing that touches nothing: what formwork is measured to."""
    touching = contact(shape, others)
    return {facing: max(0.0, shape.area(facing) - touching[facing]) for facing in (1, -1, 0)}
