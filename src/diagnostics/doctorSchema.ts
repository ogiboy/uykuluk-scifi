import { z } from "zod";

export const doctorCheckSchema = z.strictObject({
  name: z.string().min(1),
  nextAction: z.string().min(1).optional(),
  status: z.enum(["pass", "warn", "block"]),
  message: z.string().min(1),
});

export const doctorReportSchema = z.strictObject({
  createdAt: z.iso.datetime(),
  durationMs: z.number().nonnegative(),
  passed: z.boolean(),
  checks: z.array(doctorCheckSchema),
});

export type DoctorCheck = z.infer<typeof doctorCheckSchema>;

export type DoctorReport = z.infer<typeof doctorReportSchema>;
