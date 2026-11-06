import { validateProjectConfig } from "../utils/validation";

export interface ProjectConfig {
  id: string;
  repo: string;
  displayName?: string;
  description?: string;
  website?: string;
}

export interface LoaderResult {
  projects: ProjectConfig[];
  errors: string[];
  warnings: string[];
}

export function loadProjects(config: unknown): LoaderResult {
  const projects: ProjectConfig[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    errors.push("Configuration must be a JSON object.");
    return { projects, errors, warnings };
  }

  const raw = config as Record<string, unknown>;
  const projectsRaw = raw["projects"];

  if (!Array.isArray(projectsRaw)) {
    errors.push("Configuration must contain a 'projects' array.");
    return { projects, errors, warnings };
  }

  const seenIds = new Set<string>();

  for (let i = 0; i < projectsRaw.length; i++) {
    const entry = projectsRaw[i];
    const result = validateProjectConfig(entry);

    if (!result) {
      errors.push(`Invalid project entry at index ${i}.`);
      continue;
    }

    if (seenIds.has(result.project.id)) {
      errors.push(`Duplicate project ID '${result.project.id}' at index ${i}.`);
      continue;
    }

    seenIds.add(result.project.id);
    projects.push(result.project);

    for (const warning of result.warnings) {
      warnings.push(warning);
    }
  }

  return { projects, errors, warnings };
}

export function findProject(projects: ProjectConfig[], id: string): ProjectConfig | undefined {
  const normalized = id.toLowerCase().trim();
  return projects.find((p) => p.id === normalized);
}

export function repoFromConfig(project: ProjectConfig): { owner: string; repo: string } {
  const url = new URL(project.repo);
  const parts = url.pathname.replace(/\/+$/, "").replace(/^\//, "").split("/");
  const owner = parts[0];
  const repo = parts[1]?.replace(/\.git$/i, "");
  if (!owner || !repo) {
    throw new Error("Invalid repository URL");
  }
  return { owner, repo };
}
