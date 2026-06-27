import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/admin/StubPage";

export const Route = createFileRoute("/admin/_shell/espionar-ofertas")({
  component: () => <StubPage title="Espionar Ofertas" />,
});