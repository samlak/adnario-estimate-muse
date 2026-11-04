"""The demo's finished estimates, kept as JSON so the seed needs no AI. The ids in a result belong to one database
(its models, the firm's rate card and that card's rows), so on the way out they become names and rate codes, and on
the way in the new database's ids. Element refs (`<model id>#<GlobalId>`, what the viewer marks and colours) go the
same way: by model name in the JSON, by model id in a database."""

import json


def refs(data, swap: dict):
    """Data whose element refs `<old>#...` read `<new>#...`, for each old → new in swap (model ids ↔ names)."""
    text = json.dumps(data, ensure_ascii=False)
    for old, new in swap.items():
        text = text.replace(f'"{old}#', f'"{new}#')
    return json.loads(text)


def portable(result: dict) -> dict:
    """A result with no database ids: models by name, rate rows by code."""
    result = refs(result, {model['id']: model['name'] for model in result['models'] if model.get('id')})
    pricing = result['pricing']
    code = {row_id: source['code'] for row_id, source in (pricing.get('sources') or {}).items()}
    for line in result['boq']:
        if line.get('rate_item_id'):
            line['rate_item_id'] = code[line['rate_item_id']]
    pricing['sources'] = {code[row_id]: source for row_id, source in (pricing.get('sources') or {}).items()}
    if pricing.get('rate_card'):
        pricing['rate_card'] = {**pricing['rate_card'], 'id': None}
    for model in result['models']:
        model['id'] = None
    return result


def placed(result: dict, models: dict, card_id, rows: dict) -> dict:
    """A saved result given this database's ids: models {name: id}, the firm's card, its rate rows {code: id}."""
    result = refs(result, {name: str(model_id) for name, model_id in models.items()})
    pricing = result['pricing']
    for line in result['boq']:
        if line.get('rate_item_id'):
            line['rate_item_id'] = str(rows[line['rate_item_id']])
    pricing['sources'] = {str(rows[code]): source for code, source in (pricing.get('sources') or {}).items()}
    if pricing.get('rate_card'):
        pricing['rate_card'] = {**pricing['rate_card'], 'id': str(card_id)}
    for model in result['models']:
        model['id'] = str(models[model['name']])
    return result
