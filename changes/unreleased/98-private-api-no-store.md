---
type: security
issue: 98
---

Marked every API response, including authentication and error responses, as `Cache-Control: private, no-store` and stopped conditional `304` reuse, so browsers, proxies and service workers never store private data.
