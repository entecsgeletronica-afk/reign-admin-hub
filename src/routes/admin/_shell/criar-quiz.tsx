import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/admin/StubPage";

export const Route = createFileRoute("/admin/_shell/criar-quiz")({
  component: () => <StubPage title="Criar Quiz" />,
});