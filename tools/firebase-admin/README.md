# Firebase Admin helpers

This folder contains helper scripts to manage Firebase Authentication custom claims for admin users.

Important: These scripts use the Firebase Admin SDK and MUST be run in a trusted environment (server, CI runner, or your local machine with secure service-account). Do not run these in a browser or on an untrusted machine.

Prerequisites
- Node.js (recommended LTS)
- A Firebase Service Account JSON (keep it secret, do not commit to git)

Usage (example)
1. Install dependencies in this folder (or globally):

```bash
cd tools/firebase-admin
npm install firebase-admin
```

2. Configure your environment (one of these is required):
- Set GOOGLE_APPLICATION_CREDENTIALS to the path of your service account JSON file (recommended):

  ```bash
  export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
  ```

3. Run the script to set or remove `admin` claim:

```bash
# Set admin claim for a UID
node set-admin.js --uid <USER_UID> --admin true

# Remove admin claim
node set-admin.js --uid <USER_UID> --admin false

# Alternate by email (resolves to UID)
node set-admin.js --email admin@example.com --admin true
```

Security notes
- Make sure to revoke old service account keys if leaked.
- Prefer to run this from a secure server or via CI with secret management.
