// server/realtime.ts
import type { Express, Request, Response } from "express";

// In-memory subscribers per topic
type Client = { id: string; res: Response; topics: Set<string>; };
const clients = new Map<string, Client>();

// 👉 yeh list admin panel ke realtime modules cover karti hai
export const TOPICS = new Set([
  "rides",     // fleet (assign/transfer/cancel/complete)
  "drivers",   // driver status/updates
  "rates",     // fares (distance, route, hourly, extras)
  "settings",  // system settings
  "promos",    // promotions / promo-codes
  "surge",     // surge rules/updates
  "partners",  // partner applications / approvals
  "airport",   // airport fixed/route fares
]);

// Broadcast helper
export function emit(topic: string, payload: any) {
  if (!TOPICS.has(topic)) return; // unknown topic => ignore silently
  const data = `event: ${topic}\n` + `data: ${JSON.stringify(payload)}\n\n`;
  for (const c of clients.values()) {
    if (c.topics.has(topic)) {
      try { c.res.write(data); } catch { /* ignore broken pipe */ }
    }
  }
}

// Mount SSE endpoint
export function initRealtime(app: Express) {
  app.get("/api/events", (req: Request, res: Response) => {
    // topics=rides,drivers,settings,...
    const topicsParam = String(req.query.topics || "");
    const topics = new Set(
      topicsParam
        .split(",")
        .map(s => s.trim())
        .filter(s => s.length && TOPICS.has(s))
    );
    // agr client ne topics nahi diye, sab de do (admin pages main useful)
    if (topics.size === 0) {
      for (const t of TOPICS) topics.add(t);
    }

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    clients.set(id, { id, res, topics });

    // hello + heartbeat
    res.write(`event: hello\ndata: ${JSON.stringify({ ok: true, id, topics: Array.from(topics) })}\n\n`);
    const iv = setInterval(() => {
      try { res.write(`event: tick\ndata: {}\n\n`); } catch {}
    }, 5000);

    req.on("close", () => {
      clearInterval(iv);
      clients.delete(id);
      try { res.end(); } catch {}
    });
  });
}
