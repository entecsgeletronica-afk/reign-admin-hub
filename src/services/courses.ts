// Course modules + lessons service.
// Tables: course_modules, course_lessons, course_lesson_progress

import { supabase } from "@/integrations/supabase/client";
import type { YouTubePlayerSettings } from "@/lib/youtube-player";

export type LessonProvider =
  | "youtube"
  | "vimeo"
  | "hostvsl"
  | "panda"
  | "vturb"
  | "iframe";

export type LessonStatus = "draft" | "published";

export interface CourseModuleRow {
  id: string;
  product_id: string;
  title: string;
  description: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface CourseLessonRow {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  provider: LessonProvider;
  video_url: string | null;
  embed_code: string | null;
  body_text: string | null;
  complementary_url: string | null;
  complementary_label: string | null;
  pdf_url: string | null;
  pdf_label: string | null;
  order_index: number;
  status: LessonStatus;
  /** Configurações do player do YouTube (jsonb na tabela). */
  youtube_settings: YouTubePlayerSettings | null;
  created_at: string;
  updated_at: string;
}

// ---------------- Modules ----------------

export async function listModulesByProduct(
  productId: string,
): Promise<CourseModuleRow[]> {
  const { data, error } = await supabase
    .from("course_modules")
    .select("*")
    .eq("product_id", productId)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CourseModuleRow[];
}

export async function createModule(input: {
  product_id: string;
  title: string;
  description?: string | null;
  order_index?: number;
}): Promise<CourseModuleRow> {
  const { data, error } = await supabase
    .from("course_modules")
    .insert({
      product_id: input.product_id,
      title: input.title,
      description: input.description ?? null,
      order_index: input.order_index ?? 0,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as CourseModuleRow;
}

export async function updateModule(
  id: string,
  patch: Partial<Pick<CourseModuleRow, "title" | "description" | "order_index">>,
): Promise<CourseModuleRow> {
  const { data, error } = await supabase
    .from("course_modules")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as CourseModuleRow;
}

export async function deleteModule(id: string): Promise<void> {
  const { error } = await supabase.from("course_modules").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------- Lessons ----------------

export async function listLessonsByProduct(
  productId: string,
): Promise<CourseLessonRow[]> {
  // Join via module → product. We do two queries to keep it simple and RLS-friendly.
  const modules = await listModulesByProduct(productId);
  if (modules.length === 0) return [];
  const moduleIds = modules.map((m) => m.id);
  const { data, error } = await supabase
    .from("course_lessons")
    .select("*")
    .in("module_id", moduleIds)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CourseLessonRow[];
}

export async function createLesson(input: {
  module_id: string;
  title: string;
  description?: string | null;
  provider?: LessonProvider;
  order_index?: number;
}): Promise<CourseLessonRow> {
  const { data, error } = await supabase
    .from("course_lessons")
    .insert({
      module_id: input.module_id,
      title: input.title,
      description: input.description ?? null,
      provider: input.provider ?? "youtube",
      order_index: input.order_index ?? 0,
      status: "draft",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as CourseLessonRow;
}

export async function updateLesson(
  id: string,
  patch: Partial<
    Pick<
      CourseLessonRow,
      | "title"
      | "description"
      | "provider"
      | "video_url"
      | "embed_code"
      | "body_text"
      | "complementary_url"
      | "complementary_label"
      | "pdf_url"
      | "pdf_label"
      | "order_index"
      | "status"
      | "youtube_settings"
    >
  >,
): Promise<CourseLessonRow> {
  // youtube_settings é jsonb no banco; o tipo gerado é Json e
  // diverge do shape tipado YouTubePlayerSettings, então fazemos cast.
  const { data, error } = await (supabase.from("course_lessons") as any)
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as CourseLessonRow;
}

export async function deleteLesson(id: string): Promise<void> {
  const { error } = await supabase.from("course_lessons").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function reorderModules(
  ids: string[],
): Promise<void> {
  // Sequential to keep things simple; small lists.
  await Promise.all(
    ids.map((id, idx) =>
      supabase
        .from("course_modules")
        .update({ order_index: idx })
        .eq("id", id),
    ),
  );
}

export async function reorderLessons(
  ids: string[],
): Promise<void> {
  await Promise.all(
    ids.map((id, idx) =>
      supabase
        .from("course_lessons")
        .update({ order_index: idx })
        .eq("id", id),
    ),
  );
}

export const LESSON_PROVIDERS: { value: LessonProvider; label: string }[] = [
  { value: "youtube", label: "YouTube" },
  { value: "vimeo", label: "Vimeo" },
  { value: "hostvsl", label: "Host VSL" },
  { value: "panda", label: "Panda Video" },
  { value: "vturb", label: "VTurb" },
  { value: "iframe", label: "Iframe customizado" },
];
