export function htmlPage(title: string, body: string): Response {
  return new Response(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; }
    main { width: min(92vw, 34rem); }
    .panel { border: 1px solid color-mix(in srgb, currentColor 16%, transparent); border-radius: 18px; padding: 2rem; }
    button, input { font: inherit; }
  </style>
</head>
<body><main>${body}</main></body>
</html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
