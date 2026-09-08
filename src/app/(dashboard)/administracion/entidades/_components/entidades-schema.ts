import { z } from "zod/v4";

export const entidadSchema = z.object({
  id: z.string(),
  name: z.string(),
  is_active: z.boolean(),
  autonomous_community: z.string().nullable().optional(),
  created_at: z.string(),
  maps: z.object({
    parking: z.boolean(),
    office: z.boolean(),
  }),
});
export type Entidad = z.infer<typeof entidadSchema>;

export const entidadFormSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(100),
  is_active: z.boolean(),
  autonomous_community: z.string().optional().nullable(),
});
export type EntidadForm = z.infer<typeof entidadFormSchema>;
