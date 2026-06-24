import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/admin/StubPage";

export const Route = createFileRoute("/admin/_shell/biblioteca/cursos")({
  component: () => <StubPage title="Cursos em Vídeo" />,
});
