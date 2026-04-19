# Apps Script deployment

This folder gives Macaron Hobby a safer local deployment structure for Google Apps Script using `clasp`.

## Folders

- `prod/` → production Apps Script project
- `test/` → test Apps Script project
- `reference-snapshots/` → read-only pulled snapshots from remote Apps Script projects for comparison/debugging

Each folder contains:
- `Code.js` → script source for that environment
- `appsscript.json` → Apps Script manifest
- `.clasp.json` → links the folder to the correct remote Apps Script project

## Local deployment flow

Use the helper script from the website repo to push, version, and redeploy in one command.

### Test
```bash
cd /home/vncr/.openclaw/workspace/main/macaron-business/website
APPS_SCRIPT_TEST_DEPLOYMENT_ID="<test deployment id>" \
./scripts/deploy-apps-script.sh test "Update test Apps Script"
```

### Production
```bash
cd /home/vncr/.openclaw/workspace/main/macaron-business/website
APPS_SCRIPT_PROD_DEPLOYMENT_ID="<prod deployment id>" \
./scripts/deploy-apps-script.sh prod "Update production Apps Script"
```

You can also pass the deployment ID as the third argument instead of an environment variable:

```bash
./scripts/deploy-apps-script.sh test "Update test Apps Script" "<deployment-id>"
./scripts/deploy-apps-script.sh prod "Update production Apps Script" "<deployment-id>"
```

What the script does:
1. `clasp status`
2. `clasp push --force`
3. `clasp version "..."`
4. `clasp deploy --deploymentId ... --description "..."`
5. `clasp deployments`

## GitHub Actions flow

The repo already includes two manual workflows:
- `.github/workflows/deploy-apps-script-test.yml`
- `.github/workflows/deploy-apps-script-prod.yml`

They do the same sequence in GitHub Actions:
1. restore `~/.clasprc.json`
2. `clasp push --force`
3. `clasp version`
4. `clasp deploy --deploymentId ...`

Required GitHub Actions secrets:
- `CLASP_CREDENTIALS_JSON`
- `APPS_SCRIPT_TEST_DEPLOYMENT_ID`
- `APPS_SCRIPT_PROD_DEPLOYMENT_ID`

## Important note

These folders are intentionally separated so production and test code cannot accidentally overwrite each other.
Double-check that:
- `apps-script/test/.clasp.json` points to the real TEST script ID
- `apps-script/prod/.clasp.json` points to the real PROD script ID
- the web app `/exec` URLs you use belong to the matching deployments
