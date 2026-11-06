import { describe, it, expect } from "vitest";
import {
  isValidProjectId,
  parseGitHubRepoUrl,
  validateProjectConfig,
  classifyChannel,
  extractVersion,
  isSupportedChannel,
} from "../src/utils/validation";
import { loadProjects } from "../src/config/loader";
import { compareSemVer, isValidSemVer } from "../src/utils/versions";
import { HttpError, ErrorCodes } from "../src/utils/errors";

describe("project ID validation", () => {
  it("accepts valid lowercase ids", () => {
    expect(isValidProjectId("helio")).toBe(true);
    expect(isValidProjectId("my-project")).toBe(true);
    expect(isValidProjectId("a")).toBe(true);
  });

  it("rejects uppercase and unsafe ids", () => {
    expect(isValidProjectId("Helio")).toBe(false);
    expect(isValidProjectId("my project")).toBe(false);
    expect(isValidProjectId("")).toBe(false);
    expect(isValidProjectId("-leading")).toBe(false);
    expect(isValidProjectId("trailing-")).toBe(false);
  });
});

describe("GitHub repo URL parsing", () => {
  it("parses owner and repo", () => {
    expect(parseGitHubRepoUrl("https://github.com/OmHackz-dev/Helio")).toEqual({
      owner: "OmHackz-dev",
      repo: "Helio",
    });
  });

  it("strips trailing .git and slash", () => {
    expect(parseGitHubRepoUrl("https://github.com/owner/repo.git/")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("rejects malformed URLs", () => {
    expect(parseGitHubRepoUrl("not-a-url")).toBeNull();
    expect(parseGitHubRepoUrl("https://github.com/onlyone")).toBeNull();
    expect(parseGitHubRepoUrl("")).toBeNull();
  });
});

describe("configuration validation", () => {
  it("accepts two-field format", () => {
    const result = validateProjectConfig({ id: "helio", repo: "https://github.com/OmHackz-dev/Helio" });
    expect(result).not.toBeNull();
    expect(result!.project.id).toBe("helio");
    expect(result!.project.repo).toBe("https://github.com/OmHackz-dev/Helio");
  });

  it("accepts optional fields", () => {
    const result = validateProjectConfig({
      id: "helio",
      repo: "https://github.com/OmHackz-dev/Helio",
      displayName: "Helio",
      description: "A launcher",
      website: "https://example.com",
    });
    expect(result!.project.displayName).toBe("Helio");
    expect(result!.project.description).toBe("A launcher");
    expect(result!.project.website).toBe("https://example.com");
  });

  it("rejects missing fields", () => {
    expect(validateProjectConfig({ id: "x" })).toBeNull();
    expect(validateProjectConfig({ repo: "https://github.com/o/r" })).toBeNull();
    expect(validateProjectConfig(null)).toBeNull();
  });
});

describe("loadProjects", () => {
  it("normalizes IDs and rejects duplicates", () => {
    const result = loadProjects({
      projects: [
        { id: "Helio", repo: "https://github.com/o/Helio" },
        { id: "helio", repo: "https://github.com/o/Other" },
        { id: "valid", repo: "https://github.com/o/valid" },
      ],
    });

    expect(result.projects.map((p) => p.id)).toEqual(["helio", "valid"]);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain("Duplicate");
  });

  it("rejects invalid entries", () => {
    const result = loadProjects({
      projects: [
        { id: "bad id", repo: "https://github.com/o/r" },
        { id: "good", repo: "not-a-url" },
      ],
    });

    expect(result.projects.length).toBe(0);
    expect(result.errors.length).toBe(2);
  });
});

describe("channel classification", () => {
  it("classifies tags by convention", () => {
    expect(classifyChannel("v1.0.0")).toBe("stable");
    expect(classifyChannel("v1.1.0-beta.1")).toBe("beta");
    expect(classifyChannel("v1.2.0-alpha.2")).toBe("alpha");
    expect(classifyChannel("v2.0.0-rc.1")).toBe("rc");
    expect(classifyChannel("v2.1.0-nightly.20261106")).toBe("nightly");
  });

  it("treats unrecognized prerelease as prerelease, not stable", () => {
    expect(classifyChannel("v1.0.0-frobnicate.1")).toBe("stable");
  });
});

describe("semantic versions", () => {
  it("compares correctly", () => {
    expect(compareSemVer("1.10.0", "1.9.0")).toBe(1);
    expect(compareSemVer("1.9.0", "1.10.0")).toBe(-1);
    expect(compareSemVer("1.0.0", "1.0.0")).toBe(0);
    expect(compareSemVer("1.0.0", "1.0.1")).toBe(-1);
  });

  it("handles v prefixes", () => {
    expect(compareSemVer("v1.10.0", "1.9.0")).toBe(1);
  });

  it("rejects invalid versions", () => {
    expect(isValidSemVer("1.0")).toBe(false);
    expect(isValidSemVer("abc")).toBe(false);
    expect(isValidSemVer("1.0.0")).toBe(true);
  });
});

describe("error codes", () => {
  it("maps codes to status and message", () => {
    const err = HttpError.for("PROJECT_NOT_FOUND");
    expect(err.code).toBe("PROJECT_NOT_FOUND");
    expect(err.status).toBe(404);
    expect(err.message).toBe("The requested project is not registered.");

    expect(ErrorCodes.GITHUB_RATE_LIMITED.status).toBe(429);
    expect(ErrorCodes.INVALID_VERSION.status).toBe(400);
  });
});
