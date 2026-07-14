// Tiny static server for the TSUKIBOYS desktop. Serves this folder.
// Run: node serve.js   ->   http://localhost:4599
// Supports HTTP Range requests so <audio> can seek and read duration.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const PORT = process.env.PORT || 4599;
const TRASH_PASSWORD = "tsukiboyzgang";
// In-memory only: restarting the server invalidates every unlocked session.
const sessions = new Set();
const TYPES = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json",
  ".gif": "image/gif", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".wav": "audio/wav", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".ogg": "audio/ogg",
};

function parseCookies(header) {
  const out = {};
  (header || "").split(";").forEach((pair) => {
    const i = pair.indexOf("=");
    if (i === -1) return;
    out[pair.slice(0, i).trim()] = decodeURIComponent(pair.slice(i + 1).trim());
  });
  return out;
}

http
  .createServer((req, res) => {
    const urlPath0 = decodeURIComponent(req.url.split("?")[0]);

    // Password check happens here, not in client JS — the client can't be
    // trusted to gate access to the actual audio file.
    if (req.method === "POST" && urlPath0 === "/api/unlock") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
        if (body.length > 1e4) req.destroy();
      });
      req.on("end", () => {
        let password = "";
        try { password = JSON.parse(body).password; } catch { /* malformed body */ }
        if (password === TRASH_PASSWORD) {
          const token = crypto.randomBytes(24).toString("hex");
          sessions.add(token);
          res.writeHead(200, {
            "Content-Type": "application/json",
            "Set-Cookie": `session=${token}; HttpOnly; Path=/; SameSite=Lax`,
          });
          res.end(JSON.stringify({ ok: true }));
        } else {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false }));
        }
      });
      return;
    }

    let urlPath = urlPath0;
    if (urlPath === "/") urlPath = "/index.html";

    if (urlPath.startsWith("/lock/")) {
      const { session } = parseCookies(req.headers.cookie);
      if (!sessions.has(session)) {
        res.writeHead(403);
        return res.end("forbidden");
      }
    }

    const filePath = path.join(ROOT, urlPath);
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      return res.end("forbidden");
    }
    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404);
        return res.end("not found");
      }
      const type = TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
      const range = req.headers.range;
      if (range) {
        // e.g. "bytes=0-" — stream a partial response (206) for media seeking.
        const m = /bytes=(\d+)-(\d*)/.exec(range);
        const start = m ? parseInt(m[1], 10) : 0;
        const end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;
        res.writeHead(206, {
          "Content-Type": type,
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": end - start + 1,
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          "Content-Type": type,
          "Content-Length": stat.size,
          "Accept-Ranges": "bytes",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        });
        fs.createReadStream(filePath).pipe(res);
      }
    });
  })
  .listen(PORT, () => console.log(`TSUKIBOYS running on http://localhost:${PORT}`));
