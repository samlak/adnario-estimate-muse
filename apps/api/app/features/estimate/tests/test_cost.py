"""Link to cost: units that count the same, sized items scaled to the card's unit, and a link refused when it can't be
priced honestly."""

from app.features.estimate.cost import check_link, same_unit, scale, size


def test_units_that_mean_the_same():
    assert same_unit('m2', 'm²') and same_unit('nr', 'point') and same_unit('tonne', 't')
    assert not same_unit('m', 'm²')


def test_sizes_are_read_from_descriptions():
    assert size('Casement window, 819 x 759mm, glazed') == (0.819, 0.759)
    assert size('Base cabinet, 1000mm wide') == (1.0, None)
    assert size('Door set') is None


def test_a_counted_sized_line_scales_to_the_cards_unit():
    window = {'unit': 'nr', 'description': 'Casement window, 819 x 759mm, glazed'}
    assert scale(window, {'unit': 'm²', 'name': 'Aluminium windows'}) == 0.6216
    assert scale(window, {'unit': 'nr', 'name': 'Casement window, 1200 x 1200mm'}) == round(0.819 * 0.759 / 1.44, 4)
    assert scale({'unit': 'nr', 'description': 'Base cabinet, 1000mm wide'}, {'unit': 'm', 'name': 'Base units'}) == 1
    assert scale({'unit': 'nr', 'description': 'Door, 915 x 2134mm'}, {'unit': 'nr', 'name': 'Door set'}) == 1


def test_no_size_no_scale():
    assert scale({'unit': 'nr', 'description': 'Shade support'}, {'unit': 'm', 'name': 'Posts'}) is None


def test_a_link_is_refused_with_its_reason():
    assert check_link({'unit': 'm³'}, None) == 'no rate card item is the same work'
    assert check_link({'unit': 'm³', 'description': ''}, {'code': 'C1', 'unit': 'm²', 'rate': 5}).startswith('C1 is priced')
    assert 'price missing' in check_link({'unit': 'm³', 'description': ''}, {'code': 'C1', 'unit': 'm³', 'name': '', 'rate': None})
    assert check_link({'unit': 'm³', 'description': ''}, {'code': 'C1', 'unit': 'm³', 'name': '', 'rate': 5}) is None


def test_derived_lines_are_priced_from_their_own_card_item_without_the_ai(monkeypatch):
    import asyncio

    from app.features.estimate import ai, cost

    asked = []

    async def fake_link(items, lines):
        asked.extend(line['line'] for line in lines)
        return {'links': [{'line': line['line'], 'item': 'BLK-01', 'why': 'blockwork'} for line in lines]}

    monkeypatch.setattr(ai, 'link', fake_link)
    card = {'name': 'Card', 'rows': [{'kind': 'RATE', 'code': 'FOR-04', 'id': 1, 'section': 'Formwork', 'name': 'Soffit formwork', 'unit': 'm²', 'rate': 5000},
                                     {'kind': 'RATE', 'code': 'BLK-01', 'id': 2, 'section': 'Walls', 'name': 'Blockwork', 'unit': 'm²', 'rate': 9000}]}
    boq = [{'code': 'G001', 'section': 'Upper floors', 'description': 'Formwork to soffits', 'unit': 'm²', 'rate_code': 'FOR-04'},
           {'code': 'G002', 'section': 'Walls', 'description': '225mm blockwork', 'unit': 'm²'}]
    priced, _ = asyncio.run(cost.link(boq, card))
    assert asked == ['G002']  # only the line code cannot price itself
    assert [line['rate'] for line in priced] == [5000, 9000]
