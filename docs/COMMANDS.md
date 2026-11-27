# Apka Bill: everyday commands

Run these in the normal Terminal app. Nothing here contains a password.

## 1. Deploy (put new code live)

Deploy happens by itself when code reaches the `main` branch on GitHub.

```bash
cd /Users/ayush/Code/ApkaBill/orion-pulse
git status                      # see what changed
git add -A
git commit -m "describe the change"
git push origin HEAD:main       # this starts the production deploy
```

What happens next, automatically (about 6 minutes):

1. Tests run.
2. Backend deploys, but only if `backend/` changed.
3. Website deploys, but only if `frontend/` changed.
4. Health checks run. If a check fails, the deploy stops and the run shows red.

To deploy without a code change: GitHub, then Actions, then "Production Deploy", then "Run workflow", and type `CONFIRM`.

## 2. Check whether it is deployed

```bash
cd /Users/ayush/Code/ApkaBill/orion-pulse

# Latest deploy: "completed success" means it is live.
gh run list --branch main --limit 3

# Watch the running deploy until it ends.
gh run watch

# Which commit is live on each Worker ("ci <commit>").
cd backend
npx wrangler deployments status --name orion-pos-api
npx wrangler deployments status --name apkabill

# Is the live site answering? Each line should print 200.
curl -s -o /dev/null -w "%{http_code} api\n"      https://orion-pos-api.ayushpalworkplace2006.workers.dev/health
curl -s -o /dev/null -w "%{http_code} database\n" https://orion-pos-api.ayushpalworkplace2006.workers.dev/health/db
curl -s -o /dev/null -w "%{http_code} website\n"  https://apkabill.ayushpalworkplace2006.workers.dev/
curl -s -o /dev/null -w "%{http_code} login\n"    https://apkabill.ayushpalworkplace2006.workers.dev/login
```

If the browser still shows the old page, refresh once or use an incognito window.

## 3. Set or change the super-admin password

The super-admin password is a Cloudflare secret, not a setting inside the app. Changing it needs no deploy and works at once.

```bash
cd /Users/ayush/Code/ApkaBill/orion-pulse/backend
npx wrangler secret put SUPER_ADMIN_PASSWORD --name orion-pos-api
```

1. Terminal shows `Enter a secret value:`. Type the new password and press Enter. Nothing appears while you type.
2. Wait for `Success! Uploaded secret SUPER_ADMIN_PASSWORD`.
3. Write the new password on the `Password:` line of your private file, so it is not lost:
   ```bash
   open -e /Users/ayush/Code/ApkaBill/security/super-admin-credentials.txt
   ```
4. Log in at https://apkabill.ayushpalworkplace2006.workers.dev/login with email `superadmin@orion.com` and the new password.

Rules:

- Use 16 or more characters. This account controls every shop.
- Never put the password in code, in this file, or in a chat.
- The old short demo passwords were removed on purpose and will not come back.

To set the secret from the private file instead of typing it:

```bash
cd /Users/ayush/Code/ApkaBill/orion-pulse/backend
awk -F': *' '$1=="Password"{printf "%s",$2}' ../../security/super-admin-credentials.txt | npx wrangler secret put SUPER_ADMIN_PASSWORD --name orion-pos-api
```

## 4. Reset a shop owner's password

Log in as super admin, open Organizations, and press **Password** on that shop's row. Do not reset passwords in the database by hand.

## 5. Roll back (only if a deploy broke something)

```bash
cd /Users/ayush/Code/ApkaBill/orion-pulse/backend
npx wrangler deployments list --name apkabill          # find the last good version id
npx wrangler rollback <version-id> --name apkabill -m "rollback: reason"
```

Use `--name orion-pos-api` for the backend. Never roll back to a version older than 2026-11-26: those accept a known demo password for super admin.

## 6. Build the Android APK

```bash
cd /Users/ayush/Code/ApkaBill/orion-pulse/frontend
npm run cap:sync
cd android
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ./gradlew assembleDebug
# result: app/build/outputs/apk/debug/app-debug.apk
```

More detail on the pipeline, secrets and rollback limits: [DEPLOYMENT.md](DEPLOYMENT.md).
