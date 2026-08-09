import { createFileRoute } from "@tanstack/react-router";
import { findMcpTool } from "@/lib/mcp-tools";

/** Contrast ratio between two hex colours (WCAG relative luminance). */
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return null;
    const v = parseInt(m[1], 16);
    const chan = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
  };
  const la = lum(a);
  const lb = lum(b);
  if (la === null || lb === null) return null;
  return Math.round(((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)) * 10) / 10;
}

/**
 * Sandbox executor for the in-dashboard MCP test console. It validates the
 * tool name and required arguments, then returns a representative response.
 * No customer data is read or written here.
 */
export const Route = createFileRoute("/api/public/mcp/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body, null, 2), {
            status,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });

        let payload: { tool?: string; args?: Record<string, unknown> };
        try {
          payload = (await request.json()) as typeof payload;
        } catch {
          return json({ error: "invalid_json" }, 400);
        }

        const tool = findMcpTool(String(payload?.tool ?? ""));
        if (!tool) return json({ error: "unknown_tool" }, 404);

        const args = payload.args ?? {};
        const missing = tool.params
          .filter((p) => p.required)
          .map((p) => p.name)
          .filter((name) => args[name] === undefined || args[name] === "");
        if (missing.length) return json({ error: "missing_arguments", missing }, 422);

        if (tool.name === "check_qr_scannability") {
          const ratio = contrast(String(args.foreground_color), String(args.background_color));
          if (ratio === null)
            return json({ error: "invalid_color", hint: "Use hex like #0B1120" }, 422);
          const size = Number(args.target_print_size_mm ?? 25);
          const warnings: string[] = [];
          if (ratio < 7) warnings.push("Contrast below the 7:1 scan.safe threshold.");
          if (size < 20) warnings.push("Printing under 20 mm reduces scan reliability.");
          return json({
            sandbox: true,
            safe: warnings.length === 0,
            contrast_ratio: ratio,
            warnings,
          });
        }

        return json({ sandbox: true, tool: tool.name, echo: args, result: tool.sampleOutput });
      },
    },
  },
});
