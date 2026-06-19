# Firebase Admin helpers

This folder contains helper scripts to manage Firebase Authentication custom claims for admin users.

Important: These scripts use the Firebase Admin SDK and MUST be run in a trusted environment (server, CI runner, or your local machine with secure service-account). Do not run these in a browser or on an untrusted machine.

Prerequisites
- Node.js (recommended LTS)
- A Firebase Service Account JSON (keep it secret, do not commit to git)

Usage (example)
1. Install dependencies in this folder (or globally):

```bash
# from repository root
cd tools/firebase-admin
npm install

# if you need to run the convenience script from functions/ you can install deps there too
cd functions
npm install
```

2. Configure your environment (one of these is required):
- Set GOOGLE_APPLICATION_CREDENTIALS to the path of your service account JSON file (recommended):

  ```bash
  export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
  ```

3. Run the script to set or remove `admin` claim:

```bash
# Set admin claim for a UID (example)
node set-admin.js --uid <USER_UID> --admin true

# Remove admin claim
node set-admin.js --uid <USER_UID> --admin false

# Alternate by email (resolves to UID)
node set-admin.js --email admin@example.com --admin true
```

Security notes
- Make sure to revoke old service account keys if leaked.
- Prefer to run this from a secure server or via CI with secret management.

Cloud Function deploy
---------------------
You can deploy a secure Cloud Function to set/remove admin custom claims. The function expects a server-side secret stored in Firebase functions config (`admin.token`) and will only accept requests with that token in the Authorization header.

Example deploy steps (requires firebase CLI & project selection):

```bash
# from tools/firebase-admin/functions
npm install
firebase deploy --only functions:setAdminClaim

# Set the secret token used to protect the endpoint
firebase functions:config:set admin.token="YOUR_STRONG_SECRET"
```

Invoke (server-to-server):

```bash
curl -X POST https://REGION-PROJECT.cloudfunctions.net/setAdminClaim \
  -H "Authorization: Bearer YOUR_STRONG_SECRET" \
  -H "Content-Type: application/json" \
  -d '{ "email":"admin@example.com", "admin": true }'
```

Security: make sure to restrict access and rotate the secret regularly. Do not expose this endpoint to end-user browsers.

Tip: If you are inside `tools/firebase-admin/functions` and want to run the local CLI script from there, you can use the convenience npm script or call the parent script directly:

```bash
# from tools/firebase-admin/functions
npm run set-admin -- --email admin@example.com --admin true

# or (directly, from any folder)
node tools/firebase-admin/set-admin.js --email admin@example.com --admin true
```

Release notice broadcast (in-app messages)
-----------------------------------------
You can publish a release notice to all customers by writing to the existing `messages` collection.

```bash
# from tools/firebase-admin
npm run send-release-notice -- \
  --title "【重要】アップデートのお知らせ" \
  --body "サービスメッセージ対応と連絡先表示を更新しました。" \
  --releaseUrl /releases \
  --version 1.1.0

# dry run (no write)
npm run send-release-notice -- \
  --title "test" --body "test" --dryRun true
```

Fields written to `messages`:
- `customer_id`
- `title`
- `body`
- `release_url` (default: `/releases`)
- `release_version`
- `is_read` (`false`)
- `created_at`

For full production runbook details, see:

- `tools/firebase-admin/README_RELEASE_NOTICE.md`
