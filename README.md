# OmVersions

[![GitHub release](https://shieldcn.dev/badge/version/latest)](https://github.com/OmHackz-dev/OmVersions/releases/latest)
[![MIT License](https://shieldcn.dev/badge/license/MIT)](LICENSE)
[![Cloudflare Workers](https://shieldcn.dev/badge/deployed-on/Cloudflare%20Workers)](https://version.omhackz.top)
[![TypeScript](https://shieldcn.dev/badge/lang/TypeScript)](https://www.typescriptlang.org/)
[![Hono](https://shieldcn.dev/badge/framework/Hono)](https://hono.dev/)
[![Vitest](https://shieldcn.dev/badge/tested-with/Vitest)](https://vitest.dev/)

OmVersions is a centralized version API that automatically fetches releases from registered GitHub repositories. Register a project once in `projects.json` and the API exposes releases, latest versions, assets, and update checks — no manual version entry required.

Hosted at [version.omhackz.top](https://version.omhackz.top).

## The idea

Software projects release new versions on GitHub. Desktop apps, launchers, plugins, and CLIs need to know when an update is available. OmVersions removes the manual work: instead of entering version numbers, changelogs, and download links by hand, you point the API at a GitHub repository and it pulls everything automatically.

Adding a project requires editing exactly one file: `projects.json`.

## Quick start

```bash
git clone https://github.com/OmHackz-dev/OmVersions.git
cd OmVersions
npm install
npm run dev
```

The worker runs locally at `http://localhost:8787`.

## Configuration

### Adding a new project

Editing `projects.json` is all it takes:

```json
{
  "id": "myproject",
  "repo": "https://github.com/username/myproject"
}
```

Commit and push. Once deployed, the project is available at:

```
https://version.omhackz.top/api/v1/myproject/latest
```

### Full configuration example

```json
{
  "projects": [
    {
      "id": "helio",
      "repo": "https://github.com/OmHackz-dev/Helio",
      "displayName": "Helio",
      "description": "A Minecraft launcher",
      "website": "https://example.com"
    },
    {
      "id": "mangobanks",
      "repo": "https://github.com/OmHackz-dev/MangoBanks"
    }
  ]
}
```

- `id` (required): unique project identifier, normalized to lowercase.
- `repo` (required): GitHub repository URL.
- `displayName`, `description`, `website` (optional).

The original two-field format remains fully supported.

## API

Base URL: `https://version.omhackz.top/api/v1`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1` | API metadata |
| GET | `/api/v1/projects` | Registered projects |
| GET | `/api/v1/stats` | API statistics |
| GET | `/api/v1/:id` | Project details |
| GET | `/api/v1/:id/latest` | Latest stable version |
| GET | `/api/v1/:id/latest?channel=beta` | Latest release for a channel |
| GET | `/api/v1/:id/releases` | Release history |
| GET | `/api/v1/:id/releases?channel=rc` | Release history filtered by channel |
| GET | `/api/v1/:id/releases/:tag` | Specific release |
| GET | `/api/v1/:id/changelog` | Latest changelog |
| GET | `/api/v1/:id/assets` | Latest release assets |
| GET | `/api/v1/:id/check?current=1.0.0` | Check whether an update exists |
| GET | `/health` | Health status |

### Release channels

Supported: `stable`, `beta`, `alpha`, `rc`, `nightly`. Stable is the default.

Channels are classified from the release tag:

| Channel | Tag examples |
|---------|--------------|
| stable | `v1.0.0`, `1.2.0` |
| beta | `v1.1.0-beta.1` |
| alpha | `v1.2.0-alpha.2` |
| rc | `v2.0.0-rc.1` |
| nightly | `v2.1.0-nightly.20261106` |

Unrecognized prerelease identifiers are treated as prereleases, never as stable.

### Update checking

```
GET /api/v1/helio/check?current=1.0.0&channel=stable
```

Uses proper semantic version comparison, so `1.10.0` is correctly recognized as newer than `1.9.0`. Optional `v` prefixes are supported. Invalid versions return a documented `INVALID_VERSION` error.

## Desktop application: check for updates on startup

```javascript
async function checkForUpdate(projectId, currentVersion) {
  const res = await fetch(
    `https://version.omhackz.top/api/v1/${projectId}/check?current=${encodeURIComponent(currentVersion)}&channel=stable`
  );
  const json = await res.json();
  if (!json.success) return null;
  return json.data; // { project, currentVersion, latestVersion, updateAvailable, releaseUrl }
}
```

## Cloudflare deployment

```bash
npm install
npm run build
npm run deploy
```

Attach the custom domain `version.omhackz.top` through the Cloudflare dashboard: Workers → Domains / Workers Routes, or add a DNS CNAME pointing to your Workers route.

Optional secret (never committed):

```bash
wrangler secret put GITHUB_TOKEN
```

## GitHub Actions

On push to `main`: install dependencies, typecheck, test, build, and deploy (when `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets are configured). Pull requests run validation only.

Configuration-only updates (edits to `projects.json`) validate, test, build, and deploy automatically — no application code changes necessary.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | No | GitHub API token for higher rate limits (set via `wrangler secret put`) |
| `RELEASE_CACHE_TTL` | No | Cache TTL in seconds (default: 300) |

## Testing

```bash
npm run test
```

Tests mock GitHub API calls and do not require network access.

## License

[MIT](LICENSE)
