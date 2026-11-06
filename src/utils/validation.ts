import { ProjectConfig } from "../types";

export const PROJECT_ID_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export const SUPPORTED_CHANNELS = ["stable", "beta", "alpha", "rc", "nightly"] as const;

export type ChannelName = (typeof SUPPORTED_CHANNELS)[number];

export function normalizeProjectId(id: string): string {
  return id.toLowerCase().trim();
}

export function isValidProjectId(id: string): boolean {
  if (!id || typeof id !== "string") {
    return false;
  }
  const normalized = normalizeProjectId(id);
  return PROJECT_ID_REGEX.test(normalized) && normalized.length <= 64;
}

export function isSupportedChannel(channel: string): channel is ChannelName {
  return SUPPORTED_CHANNELS.includes(channel as ChannelName);
}

export function parseGitHubRepoUrl(repoUrl: string): { owner: string; repo: string } | null {
  if (typeof repoUrl !== "string" || !repoUrl.trim()) {
    return null;
  }

  const trimmed = repoUrl.trim();

  try {
    const url = new URL(trimmed);
    const pathname = url.pathname.replace(/\/+$/, "").replace(/^\//, "");
    const parts = pathname.split("/").filter(Boolean);

    if (parts.length < 2) {
      return null;
    }

    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/i, "");

    if (!owner || !repo) {
      return null;
    }

    if (parts.length > 2) {
      return null;
    }

    return { owner, repo };
  } catch {
    return null;
  }
}

export function validateProjectConfig(entry: unknown): { project: ProjectConfig; warnings: string[] } | null {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }

  const raw = entry as Record<string, unknown>;
  const id = raw["id"];
  const repo = raw["repo"];

  if (typeof id !== "string" || typeof repo !== "string") {
    return null;
  }

  const normalizedId = normalizeProjectId(id);
  if (!isValidProjectId(normalizedId)) {
    return null;
  }

  const parsed = parseGitHubRepoUrl(repo);
  if (!parsed) {
    return null;
  }

  const warnings: string[] = [];
  const project: ProjectConfig = {
    id: normalizedId,
    repo: `https://github.com/${parsed.owner}/${parsed.repo}`,
  };

  if (typeof raw["displayName"] === "string" && raw["displayName"].trim()) {
    project.displayName = raw["displayName"].trim();
  }
  if (typeof raw["description"] === "string" && raw["description"].trim()) {
    project.description = raw["description"].trim();
  }
  const websiteRaw = raw["website"];
  if (typeof websiteRaw === "string" && websiteRaw.trim()) {
    try {
      new URL(websiteRaw.trim());
      project.website = websiteRaw.trim();
    } catch {
      warnings.push(`Invalid website URL for project ${normalizedId}`);
    }
  }

  return { project, warnings };
}

export function channelRegex(channel: ChannelName): RegExp {
  switch (channel) {
    case "stable":
      return /^(?:v)?\d+\.\d+\.\d+(?:\+.+)?$/;
    case "beta":
      return /^(?:v)?\d+\.\d+\.\d+-beta(?:\.\d+)?$/i;
    case "alpha":
      return /^(?:v)?\d+\.\d+\.\d+-alpha(?:\.\d+)?$/i;
    case "rc":
      return /^(?:v)?\d+\.\d+\.\d+-rc(?:\.\d+)?$/i;
    case "nightly":
      return /^(?:v)?\d+\.\d+\.\d+-nightly(?:\.\d+)?$/i;
    default:
      return /^(?:v)?\d+\.\d+\.\d+/;
  }
}

export function classifyChannel(tag: string): ChannelName {
  const lower = tag.toLowerCase();

  if (/-nightly/i.test(lower)) return "nightly";
  if (/-rc/i.test(lower)) return "rc";
  if (/-beta/i.test(lower)) return "beta";
  if (/-alpha/i.test(lower)) return "alpha";

  if (/-.+/i.test(lower)) return "stable";

  return "stable";
}

export function extractVersion(tag: string): string {
  return tag.replace(/^v/i, "");
}
