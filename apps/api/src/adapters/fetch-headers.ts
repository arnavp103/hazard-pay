/**
 * Fastify's raw header shape (`Record<string, string | string[] | undefined>`)
 * → a fetch `Headers` instance. The one conversion every boundary crossing
 * into better-auth's fetch-shaped API needs: `routes/auth.ts`'s handler
 * translation and, per request, the session lookup better-auth's
 * `auth.api.getSession({ headers })` needs (#50).
 */
export function toFetchHeaders(
  headers: Record<string, string | string[] | undefined>,
): Headers {
  const result = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string") {
      result.append(key, value);
    } else if (Array.isArray(value)) {
      for (const entry of value) {
        result.append(key, entry);
      }
    }
  }
  return result;
}
