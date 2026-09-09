import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveReport } from "./src/report-api.js";
const production = process.env.NODE_ENV === "production";
const catalog = JSON.parse(await fs.readFile("public/catalog.json", "utf8"));
const reports = new Map(catalog.map((x) => [x.id, x]));
const cache = new Map();
const vite = production
  ? null
  : await (
      await import("vite")
    ).createServer({ server: { middlewareMode: true }, appType: "spa" });
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      const report = reports.get(url.searchParams.get("id"));
      if (!report) {
        res.writeHead(404);
        return res.end("Report not found");
      }
      if (url.pathname === "/api/report") {
        let result = cache.get(report.id);
        if (!result) {
          result = await resolveReport(report);
          cache.set(report.id, result);
        }
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "public, max-age=3600");
        return res.end(
          JSON.stringify({
            ...result,
            pages: result.pages.map((page) => ({
              ...page,
              thumb:
                "/api/page?id=" +
                encodeURIComponent(report.id) +
                "&page=" +
                page.index,
              image:
                "/api/page?id=" +
                encodeURIComponent(report.id) +
                "&page=" +
                page.index +
                "&quality=full",
            })),
          }),
        );
      }
      if (url.pathname === "/api/page") {
        const index = Number(url.searchParams.get("page"));
        let result = cache.get(report.id);
        if (!result) {
          result = await resolveReport(report);
          cache.set(report.id, result);
        }
        if (!Number.isInteger(index) || index < 0 || !result.pages[index]) {
          res.writeHead(404);
          return res.end("Page not found");
        }
        const source =
          url.searchParams.get("quality") === "full"
            ? result.pages[index].image
            : result.pages[index].thumb;
        const upstream = await fetch(source, {
          signal: AbortSignal.timeout(45000),
        });
        if (!upstream.ok) throw new Error("Page unavailable");
        res.setHeader("Content-Type", "image/jpeg");
        res.setHeader("Cache-Control", "public, max-age=604800");
        return res.end(Buffer.from(await upstream.arrayBuffer()));
      }
      if (url.pathname === "/api/cover") {
        const upstream = await fetch(
          "https://annualreport.gallery/" + report.img,
          { signal: AbortSignal.timeout(20000) },
        );
        if (!upstream.ok) throw new Error("Cover unavailable");
        res.setHeader("Content-Type", "image/jpeg");
        res.setHeader("Cache-Control", "public, max-age=604800");
        return res.end(Buffer.from(await upstream.arrayBuffer()));
      }
      if (url.pathname === "/api/pdf" && /\.pdf(?:\?|$)/i.test(report.s)) {
        const upstream = await fetch(report.s, {
          signal: AbortSignal.timeout(60000),
        });
        if (!upstream.ok) throw new Error("PDF unavailable");
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Cache-Control", "public, max-age=86400");
        return res.end(Buffer.from(await upstream.arrayBuffer()));
      }
      res.writeHead(404);
      return res.end("Not found");
    }
    if (vite) return vite.middlewares(req, res);
    const root = path.resolve("dist");
    let file = path.resolve(root, "." + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + path.sep) && file !== root) {
      res.writeHead(403);
      return res.end();
    }
    try {
      if ((await fs.stat(file)).isDirectory())
        file = path.join(file, "index.html");
      await fs.access(file);
    } catch {
      file = path.join(root, "index.html");
    }
    const types = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".mjs": "text/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".svg": "image/svg+xml",
      ".jpg": "image/jpeg",
      ".png": "image/png",
      ".woff2": "font/woff2",
    };
    res.setHeader(
      "Content-Type",
      types[path.extname(file)] || "application/octet-stream",
    );
    res.end(await fs.readFile(file));
  } catch (error) {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "The source archive could not be reached. Please try again.",
      }),
    );
    console.error(error.message);
  }
});
server.listen(Number(process.env.PORT) || 3000, "0.0.0.0", () =>
  console.log(
    "Annual Archive → http://localhost:" + (process.env.PORT || 3000),
  ),
);
