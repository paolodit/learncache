export function buildFtsQuery(input: string): string {
  const tokens = input
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9_]+/i)
    .filter((token) => token.length >= 2)
    .slice(0, 8);

  return tokens.map((token) => `"${token.replaceAll('"', '""')}"*`).join(" AND ");
}
