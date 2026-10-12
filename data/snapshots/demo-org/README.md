# Demo organization snapshot

Frozen development snapshot for offline `infer/` runs (Spec M4).

- `snapshot.json` — pseudonymised developers + artifacts (GitHub + Jira-shaped)
- `mapping.json` — demo identity mapping (plaintext logins are synthetic only)

Partner mappings must never be committed; live ingest redacts plaintext logins.

Regenerate:

```bash
npm run ingest
npm run infer
```
