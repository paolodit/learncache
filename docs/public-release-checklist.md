# Public Release Checklist

Use this before making the repository public.

## Safe To Track

- `.env.example`
- `extension/local.example.json`
- `docker-compose.example.yml`
- `personal.example/`
- Sanitized screenshots in `docs/screenshots/`

## Must Stay Private

- `.env`
- `docker-compose.yml`
- `personal/`
- `data/`
- `extension/local/`
- `extension/build/`
- YouTube cookies files
- SQLite databases
- SSH keys and `.ppk` files
- API keys, app passwords, session secrets, and extension tokens

## Audit Commands

```powershell
git status --short
git ls-files | Select-String -Pattern '(^|/)(\.env|data|personal|extension/build|extension/local|cookies|youtube-cookies|app\.db|\.ppk|id_rsa)'
rg -n --hidden --glob '!node_modules/**' --glob '!dist/**' --glob '!dist-server/**' --glob '!data/**' --glob '!extension/build/**' --glob '!extension/local/**' --glob '!extension/node_modules/**' --glob '!tools/bin/**' --glob '!.git/**' "your-domain|your-email|your-server-ip|known-secret-prefixes" .
git log -p --all -- . ':(exclude)docs/screenshots/*.png' | Select-String -Pattern 'your-domain|your-email|your-server-ip|known-secret-prefixes'
```

Git commit metadata may still show the author name and email used for previous commits. If that matters, rewrite history before making the repo public, then force-push while the repo is still private.
