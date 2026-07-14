// Tiny static server for the TSUKIBOYS desktop. Serves this folder.
// Run: node serve.js   ->   http://localhost:4599
// Supports HTTP Range requests so <audio> can seek and read duration.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = process.env.PORT || 4599;
const TYPES = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json",
  ".gif": "image/gif", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".wav": "audio/wav", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".ogg": "audio/ogg",
};

http
  .createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
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
        });
        fs.createReadStream(filePath).pipe(res);
      }
    });
  })
  .listen(PORT, () => console.log(`TSUKIBOYS running on http://localhost:${PORT}`));
