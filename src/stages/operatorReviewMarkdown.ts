import { bulletList } from "../utils/markdown.js";

type OperatorDecisionSection = {
  reviewGates: string[];
  acceptableNextSteps: string[];
  revisionSteps: string[];
  blockedActions: string[];
};

export function renderOperatorDecisionSection(section: OperatorDecisionSection): string[] {
  return [
    "## Operator Decision",
    "",
    "Review gates:",
    "",
    bulletList(section.reviewGates),
    "",
    "If acceptable:",
    "",
    bulletList(section.acceptableNextSteps),
    "",
    "If not acceptable:",
    "",
    bulletList(section.revisionSteps),
    "",
    "Still blocked:",
    "",
    bulletList(section.blockedActions),
    "",
  ];
}
