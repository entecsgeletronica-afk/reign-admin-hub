import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/admin/StubPage";

export const Route = createFileRoute("/admin/_shell/areas-membros")({
  component: () => <StubPage title="Áreas de membros" />,
});