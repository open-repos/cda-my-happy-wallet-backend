---
type: fixed
issue: 80
---

Retried concurrent recalculations of the same closed month up to five times with a short random backoff instead of failing intermittently with a server error.
