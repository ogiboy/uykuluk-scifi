import { readFile } from "node:fs/promises";
import { artifactPath } from "../src/core/artifacts";
import { prepareVoiceoverText } from "../src/stages/voice/voiceoverPreparation";

export { approvedQuote, reservedProvider } from "./voiceExecutionProviderFixtures";

export async function exactPreparation(runId: string) {
  return prepareVoiceoverText({
    runId,
    sourceText: await readFile(artifactPath(runId, "production/voiceover.txt"), "utf8"),
    pronunciationReplacements: {},
  });
}
