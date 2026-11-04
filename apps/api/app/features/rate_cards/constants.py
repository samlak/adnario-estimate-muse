from datetime import date

LIBRARY = 'Adnario Market Rates'  # the card every firm starts from, copied from overview/rate-card
PRICES_OF = date(2026, 11, 2)  # the date the library's prices are from
KINDS = ('MATERIAL', 'LABOUR', 'PLANT', 'RATE')
JSON_FIELDS = ('lines', 'additions')
DAY_UNITS = ('day', 'gang-day')  # labour priced by the day gives an item its output per day
