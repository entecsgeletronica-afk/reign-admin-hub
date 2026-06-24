import { useQuery } from "@tanstack/react-query";
import {
  listLessonsByProduct,
  listModulesByProduct,
  type CourseLessonRow,
  type CourseModuleRow,
} from "@/services/courses";

export function useCourseModules(productId: string | undefined) {
  return useQuery<CourseModuleRow[]>({
    queryKey: ["course", "modules", productId],
    queryFn: () => listModulesByProduct(productId!),
    enabled: !!productId,
  });
}

export function useCourseLessons(productId: string | undefined) {
  return useQuery<CourseLessonRow[]>({
    queryKey: ["course", "lessons", productId],
    queryFn: () => listLessonsByProduct(productId!),
    enabled: !!productId,
  });
}
