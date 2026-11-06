---
type: added
issue: 179
---

Added `dailyRemaining` to each day of `GET /budget-periods/{month}/summary`: the base remaining-to-live accrued pro rata up to that day, minus expenses and plus income up to that day, recorded operations and unresolved planned events alike, the remainder of the division landing on the last day.
