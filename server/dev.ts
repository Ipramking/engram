// Local dev API server. Mounts the same handler functions that Vercel serves
// from /api in production, so we run one code path everywhere.
import "dotenv/config";
import express from "express";
import cors from "cors";
import chat from "../api/chat.js";
import remember from "../api/remember.js";
import recall from "../api/recall.js";
import health from "../api/health.js";
import provision from "../api/provision.js";
import auth from "../api/auth.js";
import keys from "../api/keys.js";
import teams from "../api/teams.js";
import usage from "../api/usage.js";
import memories from "../api/memories.js";
import storage from "../api/storage.js";
import continuity from "../api/continuity.js";
import mcp from "../api/mcp.js";

const app = express();
app.disable('etag'); // Prevent 304 Not Modified empty responses that break browser fetch .json()
app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const wrap =
  (h: (req: any, res: any) => any) =>
  (req: any, res: any) =>
    Promise.resolve(h(req, res)).catch((e: any) => {
      console.error(e);
      if (!res.headersSent) res.status(500).json({ error: String(e?.message ?? e) });
    });

app.post("/api/chat", wrap(chat));
app.all("/api/mcp", wrap(mcp));
app.all("/mcp", wrap(mcp));
app.post("/api/remember", wrap(remember));
app.post("/api/recall", wrap(recall));
app.post("/api/provision", wrap(provision));
app.all(/^\/api\/auth(?:\/.*)?$/, wrap(auth));
app.all(/^\/api\/keys(?:\/.*)?$/, wrap(keys));
app.all(/^\/api\/teams(?:\/.*)?$/, wrap(teams));
app.all(/^\/api\/usage(?:\/.*)?$/, wrap(usage));
app.all(/^\/api\/memories(?:\/.*)?$/, wrap(memories));
app.all(/^\/api\/storage(?:\/.*)?$/, wrap(storage));
app.all(/^\/api\/continuity(?:\/.*)?$/, wrap(continuity));
app.all("/api/health", wrap(health));

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => console.log(`[engram] api dev server → http://localhost:${port}`));
