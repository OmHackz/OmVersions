export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[] | null;
  build: string[] | null;
}

const SEMVER_REGEX =
  /^(?:v)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

export function parseSemVer(version: string): SemVer | null {
  if (typeof version !== "string") {
    return null;
  }

  const match = version.match(SEMVER_REGEX);
  if (!match) {
    return null;
  }

  const prereleaseRaw = match[4] ?? undefined;
  const buildRaw = match[5] ?? undefined;

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: prereleaseRaw ? prereleaseRaw.split(".") : null,
    build: buildRaw ? buildRaw.split(".") : null,
  };
}

export function isValidSemVer(version: string): boolean {
  return parseSemVer(version) !== null;
}

export function compareSemVer(a: string, b: string): number {
  const va = parseSemVer(a);
  const vb = parseSemVer(b);

  if (!va || !vb) {
    throw new Error("Invalid semantic version");
  }

  if (va.major !== vb.major) return va.major - vb.major;
  if (va.minor !== vb.minor) return va.minor - vb.minor;
  if (va.patch !== vb.patch) return va.patch - vb.patch;

  if (va.prerelease === null && vb.prerelease === null) return 0;
  if (va.prerelease === null) return 1;
  if (vb.prerelease === null) return -1;

  const pa = va.prerelease;
  const pb = vb.prerelease;
  const len = Math.min(pa.length, pb.length);

  for (let i = 0; i < len; i++) {
    const aIsNum = /^\d+$/.test(pa[i]);
    const bIsNum = /^\d+$/.test(pb[i]);

    if (aIsNum && bIsNum) {
      const diff = parseInt(pa[i], 10) - parseInt(pb[i], 10);
      if (diff !== 0) return diff;
    } else if (aIsNum && !bIsNum) {
      return -1;
    } else if (!aIsNum && bIsNum) {
      return 1;
    } else {
      if (pa[i] < pb[i]) return -1;
      if (pa[i] > pb[i]) return 1;
    }
  }

  return pa.length - pb.length;
}
