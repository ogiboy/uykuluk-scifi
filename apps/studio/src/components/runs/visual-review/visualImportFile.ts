import type { StudioGuardedActionClientErrorInput } from "../../../lib/mutations/useStudioGuardedActionSubmit";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("error", () => reject(new Error("Visual file could not be read.")));
    reader.addEventListener("load", () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      const separator = value.indexOf(",");
      if (separator < 0) reject(new Error("Visual file encoding is invalid."));
      else resolve(value.slice(separator + 1));
    });
    reader.readAsDataURL(file);
  });
}

/** Encodes one operator-selected image and reports browser read failures through the guarded UI. */
export async function encodeVisualImportFile(
  file: File,
  action: Readonly<{ actionId: string; routePath: string }>,
  setFileError: (message: string) => void,
  reportError: (input: StudioGuardedActionClientErrorInput) => void,
  encode: (file: File) => Promise<string> = fileToBase64,
): Promise<string | null> {
  try {
    return await encode(file);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Visual file could not be read.";
    setFileError(message);
    reportError({
      actionId: action.actionId,
      message,
      routePath: action.routePath,
      toastTitle: "Visual import blocked",
    });
    return null;
  }
}
