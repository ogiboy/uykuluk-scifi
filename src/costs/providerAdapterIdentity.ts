import { z } from "zod";

export const executionBindingDigestSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const providerAdapterIdentitySchema = z.strictObject({
  provider: z.string().min(1),
  model: z.string().min(1).optional(),
  bindingDigest: executionBindingDigestSchema.optional(),
});

export type ProviderAdapterIdentity = z.infer<typeof providerAdapterIdentitySchema>;

/**
 * Determines whether two provider adapter identities match.
 *
 * @param left - The first provider adapter identity
 * @param right - The second provider adapter identity
 * @returns `true` if all identity fields match, `false` otherwise.
 */
export function providerAdapterIdentitiesMatch(
  left: ProviderAdapterIdentity,
  right: ProviderAdapterIdentity,
): boolean {
  return (
    left.provider === right.provider &&
    left.model === right.model &&
    left.bindingDigest === right.bindingDigest
  );
}
