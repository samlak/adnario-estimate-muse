"""Shapes: faces sorted into tops, bottoms and sides, what touches what, a build-up's inner faces dropped, and big
faces tested in pieces (a wall's 11m face is not 'in' a floor because its one centre happens to be at that level)."""

from app.features.estimate.shapes import free, from_mesh, neighbours

FACES = [(0, 2, 1), (0, 3, 2), (4, 5, 6), (4, 6, 7), (0, 1, 5), (0, 5, 4), (1, 2, 6), (1, 6, 5), (2, 3, 7), (2, 7, 6), (3, 0, 4), (3, 4, 7)]


def corners(lo, hi):
    (x0, y0, z0), (x1, y1, z1) = lo, hi
    return [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]


def box(lo, hi):
    return from_mesh([c for p in corners(lo, hi) for c in p], [i for t in FACES for i in t])


def boxes(*pairs):
    """Several boxes as one element's mesh (a build-up exported one solid per layer)."""
    verts, faces = [], []
    for lo, hi in pairs:
        start = len(verts) // 3
        verts += [c for p in corners(lo, hi) for c in p]
        faces += [start + i for t in FACES for i in t]
    return from_mesh(verts, faces)


def test_a_box_is_sorted_into_tops_bottoms_and_sides():
    shape = box((0, 0, 0), (2, 3, 0.5))
    assert round(shape.volume, 6) == 3.0
    assert (round(shape.area(1), 6), round(shape.area(-1), 6), round(shape.area(0), 6)) == (6.0, 6.0, 5.0)


def test_a_slab_on_a_beam_on_a_column_loses_what_they_touch():
    slab = box((0, 0, 3), (6, 6, 3.2))
    beam = box((0, 2.85, 2.6), (6, 3.15, 3))
    column = box((2.85, 2.85, 0), (3.15, 3.15, 2.6))
    assert round(free(slab, [beam, column])[-1], 6) == 34.2  # 36 m² of soffit, less the beam's 6 x 0.3
    beam_free = free(beam, [slab, column])
    assert round(beam_free[1], 6) == 0 and round(beam_free[-1], 6) == 1.71  # its top under the slab, the column under it
    assert round(free(column, [beam])[0], 6) == 3.12  # all four sides: the beam sits on its head
    assert sorted(neighbours({'s': slab, 'b': beam, 'c': column})['b']) == ['c', 's']


def test_a_tall_wall_loses_only_the_strip_a_floor_meets():
    wall = box((0, 0, 0), (1.4, 0.225, 11.4))
    floor = box((-10, -10, 3.53), (10, 10, 3.8))  # its box runs past the wall at one level
    lost = wall.area(0) - free(wall, [floor])[0]
    assert abs(lost - 0.27 * 3.25) < 0.01  # the 0.27m band around the wall's 3.25m girth, not a whole face


def test_a_build_up_in_layers_has_one_underside():
    slab = boxes(((0, 0, 0), (5, 4, 0.15)), ((0, 0, 0.15), (5, 4, 0.17)))  # concrete with a screed on it
    assert round(slab.area(-1), 6) == 20.0 and round(slab.area(1), 6) == 20.0
    assert round(slab.volume, 6) == 3.4
