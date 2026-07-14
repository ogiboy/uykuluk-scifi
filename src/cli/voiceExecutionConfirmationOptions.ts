import { SafeExitError } from "../core/errors.js";
import {
  hostedVoiceExecutionConfirmationSchema,
  type HostedVoiceExecutionConfirmation,
} from "../stages/voice/voiceExecutionConfirmation.js";

export type VoiceExecutionConfirmationOptions = Readonly<{
  approvalId?: string;
  bindingDigest?: string;
  confirmPaidOperation?: boolean;
  quoteDigest?: string;
}>;

/** Parses the all-or-none CLI flags that explicitly authorize one exact hosted voice operation. */
export function voiceExecutionConfirmationFromOptions(
  options: VoiceExecutionConfirmationOptions,
): HostedVoiceExecutionConfirmation | undefined {
  const anyProvided =
    Boolean(options.approvalId) ||
    Boolean(options.bindingDigest) ||
    options.confirmPaidOperation === true ||
    Boolean(options.quoteDigest);
  if (!anyProvided) return undefined;

  const result = hostedVoiceExecutionConfirmationSchema.safeParse({
    approvalId: options.approvalId,
    bindingDigest: options.bindingDigest,
    confirmPaidOperation: options.confirmPaidOperation,
    quoteDigest: options.quoteDigest,
  });
  if (!result.success) {
    throw new SafeExitError(
      "Hosted voice execution requires --binding-digest, --quote-digest, --approval-id, and --confirm-paid-operation together.",
    );
  }
  return result.data;
}
