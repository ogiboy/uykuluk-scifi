export function parseCsvRows(input: string): Record<string, string>[] {
  const rows = parseCsv(input).filter((row) => row.some((cell) => cell.trim().length > 0));
  const [headers, ...records] = rows;
  if (!headers || headers.length === 0) {
    return [];
  }
  const normalizedHeaders = headers.map((header) => header.trim());
  return records.map((row) =>
    Object.fromEntries(
      normalizedHeaders.map((header, index) => [header, row[index]?.trim() ?? ""]),
    ),
  );
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(current);
      rows.push(row);
      current = "";
      row = [];
      continue;
    }
    current += char;
  }
  row.push(current);
  rows.push(row);
  return rows;
}
