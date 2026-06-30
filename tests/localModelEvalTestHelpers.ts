import { writeFile } from "node:fs/promises";
import { defaultConfig } from "../src/config/config";

export async function writeLlmConfig(
  llm: Partial<(typeof defaultConfig.providers)["llm"]>,
): Promise<void> {
  await writeFile(
    "producer.config.json",
    `${JSON.stringify(
      {
        ...defaultConfig,
        providers: {
          ...defaultConfig.providers,
          llm: {
            ...defaultConfig.providers.llm,
            ...llm,
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

export function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
