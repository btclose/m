---
name: Bitunix API guard pattern
description: All routes that call Bitunix must check isConfigured() first or they 500-error continuously on server startup before the user enters their API key.
---

# Bitunix API guard pattern

Every route that calls BitunixClient must start with:

```typescript
if (!BitunixClient.isConfigured()) { res.json([]); return; }
```

Or for account: return a zero-balance account object. For write routes: return 400.

**Why:** The server starts with empty settings (no API key). The mobile app polls every 5s. Without this guard the server spams 500 errors to Bitunix with an empty API key on every request, filling logs with "Token invalid" errors and potentially triggering Bitunix rate limiting.

**How to apply:** Any new route that calls `BitunixClient.fromSettings()` must add the isConfigured() check at the top. The `BitunixClient.isConfigured()` static method checks `settings.apiKey` is non-empty.
