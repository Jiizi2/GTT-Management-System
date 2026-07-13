import * as z from "zod/v4";
import { getMinimumBusCountForPax } from "../../../shared/app-domain";

export function createGroupEditModalSchema() {
  return z
    .object({
      code: z.string().trim().min(1, "Group number tidak boleh kosong."),
      name: z.string().trim().min(1, "Group name tidak boleh kosong."),
      parentGroupId: z.string().optional(),
      pax: z
        .string()
        .trim()
        .min(1, "Total pax wajib diisi.")
        .refine((value) => {
          const parsed = Number.parseInt(value, 10);
          return Number.isFinite(parsed) && parsed > 0;
        }, "Total pax harus lebih dari 0."),
      totalBuses: z
        .string()
        .trim()
        .min(1, "Required bus wajib diisi.")
        .refine((value) => {
          const parsed = Number.parseInt(value, 10);
          return Number.isFinite(parsed) && parsed > 0;
        }, "Required bus harus lebih dari 0."),
      arrivalDate: z.string().trim().min(1, "Start Date wajib diisi."),
      returnDate: z.string().trim().min(1, "End Date wajib diisi."),
    })
    .superRefine((values, context) => {
      const parsedPax = Number.parseInt(values.pax, 10);
      const parsedTotalBuses = Number.parseInt(values.totalBuses, 10);
      if (
        !Number.isFinite(parsedPax) ||
        parsedPax <= 0 ||
        !Number.isFinite(parsedTotalBuses) ||
        parsedTotalBuses <= 0
      ) {
        return;
      }

      const minimumRequiredBusCount = getMinimumBusCountForPax(parsedPax);
      if (parsedTotalBuses < minimumRequiredBusCount) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["totalBuses"],
          message: `Minimal ${minimumRequiredBusCount} bus diperlukan untuk ${parsedPax} pax.`,
        });
      }

      if (values.returnDate < values.arrivalDate) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["returnDate"],
          message: "End Date tidak boleh sebelum Start Date.",
        });
      }
    });
}
