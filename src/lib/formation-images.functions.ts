import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const UploadSchema = z.object({
  fileBase64: z.string(),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
});

export const uploadFormationImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => UploadSchema.parse(data))
  .handler(async ({ data, context }) => {
    const isAdmin = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const isSuperAdmin = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isAdmin.data && !isSuperAdmin.data) {
      throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const buffer = Buffer.from(data.fileBase64, "base64");
    const path = `modules/${Date.now()}-${data.fileName}`;

    const { error } = await supabaseAdmin.storage
      .from("formation-images")
      .upload(path, buffer, { contentType: data.contentType, upsert: false });

    if (error) throw new Error(error.message);

    const { data: signedData, error: signError } = await supabaseAdmin.storage
      .from("formation-images")
      .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year

    if (signError) throw new Error(signError.message);

    return { path, signedUrl: signedData.signedUrl };
  });
