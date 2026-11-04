"""Each tool the sidekick may call, as the model sees it: its name, what it answers, its parameters, and whether its
answer has money in it (left out for who may not see the estimate)."""

def function(name: str, description: str, money: bool, /, **parameters: dict) -> tuple[str, dict]:
    return name, {
        'money': money,
        'schema': {
            'type': 'function',
            'function': {
                'name': name,
                'description': description,
                'parameters': {'type': 'object', 'properties': parameters, 'additionalProperties': False},
            },
        },
    }


TEXT = {'type': 'string'}
TOOLS = dict(
    [
        function(
            'project_info',
            'The project as described: brief, facts (client, location, use, frame, exclusions), city, models, and the '
            'rate card and percentages used.',
            False,
        ),
        function('model_overview', 'The models, storeys and element counts by IFC class.', False),
        function(
            'query_elements',
            'Count elements by IFC class (e.g. IfcDoor), storey name and words in their type or family; grouped by '
            'type, storey or class. Gives some element refs to link to.',
            False,
            ifc_class=TEXT,
            storey=TEXT,
            name=TEXT,
            group_by={'type': 'string', 'enum': ['type', 'storey', 'class']},
        ),
        function(
            'element_details',
            'One element by its ref or GlobalId: type, storey, what it was measured as.',
            False,
            ref=TEXT,
        ),
        function(
            'takeoff_summary', 'The measured quantities, line by line, optionally for one section.', True, section=TEXT
        ),
        function('not_measured', 'Types in the model that were not measured, each with why.', False),
        function(
            'boq_lines',
            'BOQ items with ref, quantity, unit, rate and amount, with their count and total_amount worked out here; '
            'filter by bill, section or element (Electrical) or words; sort amount, qty or rate (largest first) or '
            'cheapest, and limit to the first few: use these for any top or bottom ranking.',
            True,
            bill=TEXT,
            search=TEXT,
            sort={'type': 'string', 'enum': ['amount', 'qty', 'rate', 'cheapest']},
            limit={'type': 'integer'},
        ),
        function(
            'boq_line',
            'One BOQ item by its ref (e.g. B1A): rate and the rate card item it came from, confidence, elements, the '
            'programme activities that do its work with their dates, and review questions about it.',
            True,
            ref=TEXT,
        ),
        function(
            'review_questions',
            'The questions the review left for the QS (high, medium, low severity), with the BOQ items each is about.',
            True,
            severity=TEXT,
        ),
        function(
            'provisional_items',
            'Items the design does not show (site clearance, excavation, fence...), proposed with quantity, basis and '
            'reason, and whether the QS has added each to the BOQ.',
            True,
        ),
        function('boq_totals', 'The BOQ summary: each bill, preliminaries, contingency, VAT and the total.', True),
        function(
            'programme_at',
            'What the programme shows in a week (1 = the first week) or on a date (YYYY-MM-DD): activities under way, '
            'starting and finishing, and the value of the work done to date and in it.',
            False,
            week={'type': 'integer'},
            day=TEXT,
        ),
        function(
            'programme_overview',
            'The programme: start and finish dates, working days, the critical path, and measured work it leaves out.',
            False,
        ),
        function(
            'programme_activities',
            'Programme activities (or those with these words in code or name, e.g. "Ground Floor", or only critical '
            'ones) with start, finish, working days, float and cost, plus their count and total_cost worked out '
            'here. Sort cost, working_days or float (largest first) or start, and limit. Names carry the work and the '
            'level.',
            False,
            search=TEXT,
            sort={'type': 'string', 'enum': ['cost', 'working_days', 'float', 'start']},
            critical={'type': 'boolean'},
            limit={'type': 'integer'},
        ),
        function(
            'activity',
            'One programme activity by its ID (the number before its name): dates, float, critical or not, the '
            'activities it follows and that follow it, and the BOQ items it does with its cost.',
            False,
            code=TEXT,
        ),
        function(
            'cash_flow',
            'The cash flow by month (YYYY-MM) and peak_month, the month needing the most money; for one month also its '
            'activities and their amounts.',
            True,
            month=TEXT,
        ),
    ]
)
