import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/admin/StubPage";

export const Route = createFileRoute("/admin/_shell/cadastrar-perfect-pay")({
  component: () => <StubPage title="Cadastrar na Perfect Pay" />,
});