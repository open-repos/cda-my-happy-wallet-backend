---
type: fixed
issue: 80
user: Enregistrer plusieurs opérations en même temps ne provoque plus d'erreur passagère.
---

Retried concurrent recalculations of the same closed month up to five times with a short random backoff instead of failing intermittently with a server error.
