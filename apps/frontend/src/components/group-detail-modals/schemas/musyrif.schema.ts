import * as z from "zod/v4";

export const musyrifModalSchema = z.object({
  name: z.string().trim().min(1, "Musyrif name wajib diisi."),
  phone: z.string().trim().min(1, "Phone number wajib diisi."),
});
