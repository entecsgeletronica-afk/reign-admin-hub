import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/admin/StubPage";

export const Route = createFileRoute("/admin/_shell/cadastrar-produto")({
  component: () => <StubPage title="Cadastrar produto" />,
});