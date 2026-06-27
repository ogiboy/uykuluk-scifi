import { bulletList } from "../utils/markdown.js";

type OperatorDecisionSection = {
  reviewGates: string[];
  acceptableNextSteps: string[];
  revisionSteps: string[];
  blockedActions: string[];
};

/**
 * Builds the Markdown lines for an operator decision section.
 *
 * @param section - The section content to render
 * @returns The Markdown lines for the operator decision section
 */
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
