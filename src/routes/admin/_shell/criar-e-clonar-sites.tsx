import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/admin/StubPage";

export const Route = createFileRoute("/admin/_shell/criar-e-clonar-sites")({
  component: () => <StubPage title="Criar e Clonar Sites" />,
});