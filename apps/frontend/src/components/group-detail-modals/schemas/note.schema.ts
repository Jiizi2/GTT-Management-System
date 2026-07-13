import * as z from "zod/v4";

export const noteModalSchema = z.object({
  text: z.string().trim().min(1, "Operational note wajib diisi.").max(2000, "Maksimal 2000 karakter."),
  pinned: z.boolean(),
});
