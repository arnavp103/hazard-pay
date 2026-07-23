import env from "@hazard-pay/env";

/** `error instanceof Error ? error.message : String(error)`, named once. */
export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function configuration(): { apiUrl: string; repository: string; token: string } {
  if (env.GITHUB_TOKEN === undefined || env.GITHUB_REPOSITORY === undefined) {
    throw new Error("GitHub access requires GITHUB_TOKEN and GITHUB_REPOSITORY=owner/repo");
  }
  return { apiUrl: env.GITHUB_API_URL, repository: env.GITHUB_REPOSITORY, token: env.GITHUB_TOKEN };
}

export function githubRepository(): string {
  return configuration().repository;
}

function nextLink(link: string | null): string | undefined {
  if (link === null) { return undefined; }
  return link.split(",").map((part) => part.trim()).find((part) => part.endsWith("rel=\"next\""))?.match(/^<([^>]+)>/)?.[1];
}

/** Authenticated GitHub REST GET without relying on a preinstalled `gh`. */
export async function githubApiGet<T>(
  endpoint: string,
  params: Record<string, string> = {},
  options: { paginate?: boolean } = {},
): Promise<T> {
  const { apiUrl, repository, token } = configuration();
  let url: string | undefined = `${apiUrl}/${endpoint.replace("{repo}", repository).replace(/^\//, "")}`;
  const initial = new URL(url);
  for (const [key, value] of Object.entries(params)) { initial.searchParams.set(key, value); }
  url = initial.toString();
  const pages: unknown[] = [];
  do {
    const response = await fetch(url, {
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!response.ok) { throw new Error(`GitHub GET ${endpoint} failed (${response.status}): ${await response.text()}`); }
    const value = await response.json() as unknown;
    if (options.paginate === true && Array.isArray(value)) {
      pages.push(...value);
    } else {
      return value as T;
    }
    url = nextLink(response.headers.get("link"));
  } while (url !== undefined);
  return pages as T;
}
