import { SafeExitError } from "../../core/errors.js";
import type { PackageProviderPayload } from "../provider/providerPayloads.js";

const englishTagPattern =
  /\b(?:analysis|exoplanet|extraterrestrial|fiction|geological|geology|science|space|turkish)\b/iu;
const doctorNamePattern = /\bDr\.\s+([A-ZÇĞİÖŞÜ][\p{L}'’.-]+)/gu;

export function assertProductionPackageProviderQuality(
  payload: PackageProviderPayload,
  approvedScript: string,
): void {
  const humanFacingText = [
    ...payload.popupCards,
    ...payload.lowerThirds,
    payload.youtube.title,
    payload.youtube.description,
    ...payload.youtube.tags,
  ].join("\n");

  for (const match of humanFacingText.matchAll(doctorNamePattern)) {
    const firstName = match[1] ?? "";
    if (firstName && !approvedScript.includes(firstName)) {
      throw packageQualityError("introduces a named person absent from the approved script");
    }
  }
  if (payload.youtube.tags.some((tag) => englishTagPattern.test(tag))) {
    throw packageQualityError("contains English YouTube tags despite the Turkish-only contract");
  }
}

function packageQualityError(reason: string): SafeExitError {
  return new SafeExitError(`Invalid production package provider response: ${reason}.`);
}
