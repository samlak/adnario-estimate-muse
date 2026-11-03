MAX_ROWS = 40  # rows a tool answers with at most; it says how many more there are
MAX_STEPS = 10  # rounds of tool calls in one answer (trying another tool when one has no answer)
EFFORT = 'low'  # how long Muse reasons before each step (low or medium; see evaluate.py for how they compare)
MAX_TURNS = 20  # messages of the conversation sent back to the model
TITLE_LENGTH = 120  # a chat's title: its first question, cut to this, until the AI names it from its first answer
TITLE_WORDS = 12  # the most words in the name the AI gives a chat
TITLE_CONTEXT = 50  # words of the first answer the AI reads to name the chat (with the whole question)
RESULT_SHOWN = 4000  # characters of a look-up's answer the person sees under its step (the model gets it all)
# The orchestrator's specialists: what it is told each is for, and the look-ups each may use
SPECIALISTS = {
    'model': {
        'about': 'The building models and takeoff: elements by class, storey and type, what was measured and what not.',
        'tools': [
            'project_info',
            'model_overview',
            'query_elements',
            'element_details',
            'takeoff_summary',
            'not_measured',
        ],
        'money': False,
    },
    'cost': {
        'about': 'The BOQ and its pricing: bills, items, rates, totals, review questions and provisional items.',
        'tools': ['project_info', 'boq_lines', 'boq_line', 'boq_totals', 'review_questions', 'provisional_items'],
        'money': True,
    },
    'programme': {
        'about': 'The programme and the money over time: activities, dates, float, critical path, the BOQ work under '
        'each activity, what happens in a week, and the cash flow by month.',
        'tools': ['programme_overview', 'programme_activities', 'activity', 'programme_at', 'cash_flow', 'boq_line'],
        'money': False,
    },
}
