# OmVersions

Centralized version management API for GitHub releases, built on Cloudflare Workers, Hono, and TypeScript.

Hosted at `https://version.omhackz.top`.

## Overview

OmVersions is a lightweight, centralized version API that automatically fetches releases from registered
GitHub repositories. Register a project once in `projects.json` and the API exposes its releases, latest
version, assets, and update checks — no manual version entry required.

It supports any GitHub-hosted project: launchers, plugins, CLIs, tools, and libraries.

## Features

- Single-file project configuration: editing `projects.json` is all it takes to add a project
- Automatic GitHub release fetching (tags, versions, changelogs, assets, download URLs)
- Stable and prerelease release channels (`stable`, `beta`, `alpha`, `rc`, `nightly`)
- Semantic version comparison for update checks (`1.10.0` > `1.9.0`)
- Cloudflare Workers Cache API to reduce GitHub API usage (default 5-minute TTL)
- Standardized JSON error responses
- Landing page and full API documentation
- No database, no login, no frontend framework
- GitHub Actions CI/CD with automatic deployment on push to `main`

## Technology stack

- TypeScript
- Cloudflare Workers
- Hono
- GitHub REST API
- Vitest
- wrangler
- npm

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

Adding a project requires editing only `projects.json`:

```json
{
  "id": "myproject",
  "repo": "https://github.com/username/myproject"
}
```

Then commit and push. Once deployed, the project is available at:

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
| GET | `/api/v1/:id/releases/:tag` | Specific release |
| GET | `/api/v1/:id/changelog` | Latest changelog |
| GET | `/api/v1/:id/assets` | Latest release assets |
| GET | `/api/v1/:id/check?current=1.0.0` | Check for updates |
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

Uses proper semantic version comparison. Optional `v` prefixes are supported.

## Cloudflare deployment

```bash
npm install
npm run build
npm run deploy
```

Attach the custom domain `version.omhackz.top` through the Cloudflare dashboard:
Workers → Domains / Workers Routes, or add a DNS CNAME pointing to your Workers route.

Optional secret (never committed):

```bash
wrangler secret put GITHUB_TOKEN
```

## GitHub Actions

On push to `main`: install dependencies, typecheck, test, build, and deploy (when `CLOUDFLARE_API_TOKEN`
and `CLOUDFLARE_ACCOUNT_ID` secrets are configured). Pull requests run validation only.

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

MIT License
