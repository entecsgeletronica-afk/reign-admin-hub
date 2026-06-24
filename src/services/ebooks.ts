// Ebook (PDF) catalog service.
// Tables: ebook_modules, ebook_files, ebook_progress
// Storage bucket: ebook-files (PRIVATE) — never expose file_path directly to
// the user; reading happens through a server-issued signed URL.

import { supabase } from "@/integrations/supabase/client";

export type EbookMode = "single_pdf" | "modules";
export type EbookStatus = "draft" | "published";

export interface EbookModuleRow {
  id: string;
  product_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  status: EbookStatus;
  created_at: string;
  updated_at: string;
}

export interface EbookFileRow {
  id: string;
  product_id: string;
  module_id: string | null;
  title: string;
  description: string | null;
  file_path: string;
  file_name: string | null;
  file_size: number | null;
  total_pages: number | null;
  allow_download: boolean;
  sort_order: number;
  status: EbookStatus;
  created_at: string;
  updated_at: string;
}

export interface EbookProgressRow {
  id: string;
  user_id: string;
  product_id: string;
  ebook_file_id: string;
  last_page: number;
  total_pages: number | null;
  progress_percentage: number;
  last_opened_at: string;
  created_at: string;
  updated_at: string;
}

/* ---------------- Modules ---------------- */

export async function listEbookModulesByProduct(
  productId: string,
): Promise<EbookModuleRow[]> {
  const { data, error } = await supabase
    .from("ebook_modules" as never)
    .select("*")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EbookModuleRow[];
}

export async function createEbookModule(input: {
  product_id: string;
  title: string;
  description?: string | null;
  sort_order?: number;
}): Promise<EbookModuleRow> {
  const { data, error } = await supabase
    .from("ebook_modules" as never)
    .insert({
      product_id: input.product_id,
      title: input.title,
      description: input.description ?? null,
      sort_order: input.sort_order ?? 0,
    } as never)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as EbookModuleRow;
}

export async function updateEbookModule(
  id: string,
  patch: Partial<Pick<EbookModuleRow, "title" | "description" | "sort_order" | "status">>,
): Promise<void> {
  const { error } = await supabase
    .from("ebook_modules" as never)
    .update(patch as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteEbookModule(id: string): Promise<void> {
  const { error } = await supabase.from("ebook_modules" as never).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ---------------- Files ---------------- */

export async function listEbookFilesByProduct(
  productId: string,
): Promise<EbookFileRow[]> {
  const { data, error } = await supabase
    .from("ebook_files" as never)
    .select("*")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EbookFileRow[];
}

export async function createEbookFile(input: {
  product_id: string;
  module_id?: string | null;
  title: string;
  description?: string | null;
  file_path: string;
  file_name?: string | null;
  file_size?: number | null;
  allow_download?: boolean;
  sort_order?: number;
  status?: EbookStatus;
}): Promise<EbookFileRow> {
  const { data, error } = await supabase
    .from("ebook_files" as never)
    .insert({
      product_id: input.product_id,
      module_id: input.module_id ?? null,
      title: input.title,
      description: input.description ?? null,
      file_path: input.file_path,
      file_name: input.file_name ?? null,
      file_size: input.file_size ?? null,
      allow_download: input.allow_download ?? false,
      sort_order: input.sort_order ?? 0,
      status: input.status ?? "published",
    } as never)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as EbookFileRow;
}

export async function updateEbookFile(
  id: string,
  patch: Partial<
    Pick<
      EbookFileRow,
      | "title"
      | "description"
      | "module_id"
      | "allow_download"
      | "sort_order"
      | "status"
      | "total_pages"
    >
  >,
): Promise<void> {
  const { error } = await supabase
    .from("ebook_files" as never)
    .update(patch as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteEbookFile(id: string, file_path?: string): Promise<void> {
  // Best-effort: remove from storage too. RLS allows admins.
  if (file_path) {
    await supabase.storage.from("ebook-files").remove([file_path]).catch(() => {});
  }
  const { error } = await supabase.from("ebook_files" as never).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ---------------- Storage upload (admin) ---------------- */

export async function uploadEbookPdf(
  productId: string,
  file: File,
): Promise<{ file_path: string; file_size: number; file_name: string }> {
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    throw new Error("Apenas arquivos PDF são aceitos.");
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80);
  const file_path = `${productId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}-${safeName}`;
  const { error } = await supabase.storage
    .from("ebook-files")
    .upload(file_path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: "application/pdf",
    });
  if (error) throw new Error(error.message);
  return { file_path, file_size: file.size, file_name: file.name };
}

/* ---------------- Signed URL for reading ----------------
 * Generated CLIENT-SIDE for admins (RLS allows it) and via the storage policy
 * "Users read entitled ebook-files objects" for authenticated learners. We
 * always go through createSignedUrl so the raw `file_path` is not leaked
 * through markup, network logs or `view-source`. */

export async function createEbookSignedUrl(
  file_path: string,
  expiresInSeconds = 60 * 30,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from("ebook-files")
    .createSignedUrl(file_path, expiresInSeconds);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

/* ---------------- Progress ---------------- */

export async function getEbookProgressForProduct(
  userId: string,
  productId: string,
): Promise<EbookProgressRow[]> {
  const { data, error } = await supabase
    .from("ebook_progress" as never)
    .select("*")
    .eq("user_id", userId)
    .eq("product_id", productId);
  if (error) return [];
  return (data ?? []) as unknown as EbookProgressRow[];
}

export async function upsertEbookProgress(input: {
  user_id: string;
  product_id: string;
  ebook_file_id: string;
  last_page: number;
  total_pages: number | null;
}): Promise<void> {
  const pct =
    input.total_pages && input.total_pages > 0
      ? Math.round((input.last_page / input.total_pages) * 100)
      : 0;
  const { error } = await supabase
    .from("ebook_progress" as never)
    .upsert(
      {
        user_id: input.user_id,
        product_id: input.product_id,
        ebook_file_id: input.ebook_file_id,
        last_page: input.last_page,
        total_pages: input.total_pages,
        progress_percentage: pct,
        last_opened_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id,ebook_file_id" },
    );
  if (error) throw new Error(error.message);
}
