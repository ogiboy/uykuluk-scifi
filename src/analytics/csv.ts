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

type CsvParserState = {
  current: string;
  inQuotes: boolean;
  row: string[];
  rows: string[][];
};

function parseCsv(input: string): string[][] {
  const state: CsvParserState = {
    current: "",
    inQuotes: false,
    row: [],
    rows: [],
  };
  let index = 0;
  while (index < input.length) {
    index = readCsvCharacter(input, index, state);
  }
  finishCell(state);
  finishRow(state);
  return state.rows;
}

function readCsvCharacter(input: string, index: number, state: CsvParserState): number {
  const char = input[index];
  const next = input[index + 1];
  if (char === '"' && state.inQuotes && next === '"') {
    state.current += '"';
    return index + 2;
  }
  if (char === '"') {
    state.inQuotes = !state.inQuotes;
    return index + 1;
  }
  if (char === "," && !state.inQuotes) {
    finishCell(state);
    return index + 1;
  }
  if (isRowBreak(char) && !state.inQuotes) {
    finishCell(state);
    finishRow(state);
    return char === "\r" && next === "\n" ? index + 2 : index + 1;
  }
  state.current += char;
  return index + 1;
}

function finishCell(state: CsvParserState): void {
  state.row.push(state.current);
  state.current = "";
}

function finishRow(state: CsvParserState): void {
  state.rows.push(state.row);
  state.row = [];
}

function isRowBreak(char: string): boolean {
  return char === "\n" || char === "\r";
}
