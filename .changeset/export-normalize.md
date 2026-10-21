---
'penciled': minor
---

Export `normalize()`, which checks and upgrades annotation data without a running instance: it fills in defaults, drops unknown fields and returns `undefined` for anything that isn't an annotation. Use it to validate uploads or stored data on your server.
