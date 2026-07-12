export type NamedRoleContinuityDetails = { distinctNameCount: string; role: string };

const namedRolePattern =
  /\b([Jj]eolog|[Aa]rkeolog|[Mm]ühendis|[Aa]stronom|[Oo]şinograf|[Aa]raştırmacı)\s+(?:Dr\.\s+)?([A-ZÇĞİÖŞÜ][\p{Ll}çğıöşü]+)/gu;

export function namedRoleContinuityDetails(script: string): NamedRoleContinuityDetails | undefined {
  const namesByRole = new Map<string, Set<string>>();
  for (const match of script.matchAll(namedRolePattern)) {
    const role = (match[1] ?? "").toLocaleLowerCase("tr");
    const firstName = (match[2] ?? "").toLocaleLowerCase("tr");
    if (!role || !firstName) {
      continue;
    }
    const names = namesByRole.get(role) ?? new Set<string>();
    names.add(firstName);
    namesByRole.set(role, names);
    if (names.size > 1) {
      return { role, distinctNameCount: String(names.size) };
    }
  }
  return undefined;
}
