export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Erro inesperado</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #0a0a0a; color: #f5f5f5; padding: 24px; }
  .card { max-width: 480px; text-align: center; }
  h1 { font-size: 28px; margin: 0 0 12px; }
  p { color: #a3a3a3; margin: 0 0 24px; line-height: 1.5; }
  .row { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
  button, a { display: inline-block; padding: 12px 20px; border-radius: 10px;
    font-weight: 600; font-size: 14px; text-decoration: none; cursor: pointer;
    border: 1px solid #2a2a2a; background: #1a1a1a; color: #f5f5f5; }
  button.primary { background: #f5f5f5; color: #0a0a0a; border-color: #f5f5f5; }
</style>
</head>
<body>
  <div class="card">
    <h1>Algo deu errado</h1>
    <p>Ocorreu um erro inesperado ao carregar esta página. Tente novamente em instantes.</p>
    <div class="row">
      <button class="primary" onclick="location.reload()">Tentar novamente</button>
      <a href="/">Voltar ao início</a>
    </div>
  </div>
</body>
</html>`;
}
