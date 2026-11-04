"""The programme's prompts."""

ASSIGN = """You are a Nigerian quantity surveyor linking a contractor's programme of works to the BOQ. You are given
the programme's activities (id, name, the stage and floor it sits under) and pieces of BOQ work (key, BOQ section,
storey, description). For each piece say which activity or activities do that work on that storey: usually one;
more only when the work is plainly split between them (zones A and B of the same operation). Procurement, approvals
and delivery activities never do measured work. When no activity does it, answer an empty list.

Answer with JSON only: {"pieces": [{"key": "W001", "activities": [61, 62]}]}"""

RETRY = '\nSome answers named activities that do not exist or are summaries: use only the ids listed.'
