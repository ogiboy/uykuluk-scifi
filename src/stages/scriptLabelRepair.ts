export type ScriptLabelRepairEvidence = {
  count: number;
  variants: string[];
};

type ScriptLabelRepairRule = {
  pattern: RegExp;
  replacement: string;
  variantSuffix: ":" | " -";
};

const narratorLabelRule: ScriptLabelRepairRule = {
  pattern: /(^|[^\p{L}\p{N}_])(Anlatici|Anlatyıcı|Anlatı)\s*:/gu,
  replacement: "Anlatıcı:",
  variantSuffix: ":",
};

const visualColonLabelRule: ScriptLabelRepairRule = {
  pattern: /(^|[^\p{L}\p{N}_])(Gorsel)\s*:/gu,
  replacement: "Görsel:",
  variantSuffix: ":",
};

const visualDashLabelRule: ScriptLabelRepairRule = {
  pattern: /(^|[^\p{L}\p{N}_])(Görsel|Gorsel)\s*-\s*/gu,
  replacement: "Görsel: ",
  variantSuffix: " -",
};

const scriptLabelRepairRules = [narratorLabelRule, visualColonLabelRule, visualDashLabelRule];

export function repairScriptProductionLabels(text: string): {
  labelRepair?: ScriptLabelRepairEvidence;
  text: string;
} {
  let repairedText = text;
  let count = 0;
  const variants = new Set<string>();

  for (const rule of scriptLabelRepairRules) {
    repairedText = repairedText.replaceAll(
      rule.pattern,
      (_match, prefix: string, variant: string) => {
        count += 1;
        variants.add(`${variant}${rule.variantSuffix}`);
        return `${prefix}${rule.replacement}`;
      },
    );
  }

  return {
    text: repairedText,
    labelRepair:
      count > 0
        ? { count, variants: [...variants].sort((left, right) => left.localeCompare(right)) }
        : undefined,
  };
}
