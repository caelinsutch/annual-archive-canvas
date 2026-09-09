import "./style.css";
import { ArchiveCanvas } from "./canvas.js";
import {
  createIcons,
  Search,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  X,
  Plus,
  Minus,
  MoveUpRight,
  Grid2X2,
  Move,
  Bookmark,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  BookOpen,
  Maximize2,
  Check,
  Shuffle,
  Download,
  Info,
} from "lucide";
const icons = {
  Search,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  X,
  Plus,
  Minus,
  MoveUpRight,
  Grid2x2: Grid2X2,
  Move,
  Bookmark,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  BookOpen,
  Maximize2,
  Check,
  Shuffle,
  Download,
  Info,
};
const icon = (n) => `<i data-lucide="${n}"></i>`;
const paintIcons = () => createIcons({ icons, attrs: { "stroke-width": 1.5 } });
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let data = [],
  filtered = [],
  canvas,
  view = "canvas",
  saved = new Set(),
  savedOnly = false,
  query = "",
  decade = "",
  industry = "",
  color = "",
  readerCanvas,
  active = null,
  manifest = null,
  page = 0,
  readerMode = "pages",
  requestId = 0,
  previousFocus,
  gridLimit = 90;
try {
  saved = new Set(JSON.parse(localStorage.getItem("annual-saved") || "[]"));
} catch {}
const app = document.querySelector("#app");
app.innerHTML = `<header class="masthead"><a class="wordmark" href="/" aria-label="Annual Archive home"><span class="brand-mark">a<span>↗</span></span><span>Annual<br>Archive<span class="brand-dot">®</span></span></a><div class="masthead-note">CORPORATE DOCUMENTS.<br>EXTRAORDINARY DESIGN.</div><nav><button id="about">About the archive ${icon("arrow-up-right")}</button><button id="saved" aria-pressed="false">${icon("bookmark")} <span>Collection</span> <span id="saved-count">${saved.size.toString().padStart(2, "0")}</span></button></nav></header>
<main><section class="intro"><div><div class="eyebrow"><span class="status-dot"></span> A LIVING ARCHIVE OF PRINTED MATTER</div><h1>Business, <em>by design.</em></h1></div><div class="intro-copy">Before everything went digital,<br>companies made things worth keeping.<br><span>Get lost in the art of the annual report.</span></div></section>
<section class="filterbar" aria-label="Filter archive"><div class="filter-left"><span id="result-count" aria-live="polite">Loading the archive</span><span class="filter-divider"></span><label class="select-wrap"><select id="decade" aria-label="Decade"><option value="">All decades</option>${[1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020].map((d) => `<option value="${d}">${d}s</option>`).join("")}</select>${icon("chevron-down")}</label><label class="select-wrap"><select id="industry" aria-label="Industry"><option value="">All industries</option></select>${icon("chevron-down")}</label><label class="select-wrap color-filter"><select id="color" aria-label="Color"><option value="">Any color</option>${["red", "orange", "yellow", "green", "blue", "neutral"].map((c) => `<option value="${c}">${c[0].toUpperCase() + c.slice(1)}</option>`).join("")}</select>${icon("chevron-down")}</label><button id="clear" class="clear hidden">Clear filters ${icon("x")}</button></div><button class="shuffle" id="shuffle">A little serendipity ${icon("shuffle")}</button></section>
<section id="gallery" class="gallery" tabindex="0" aria-label="Infinite report canvas. Drag or use arrow keys to explore. Select a cover to read."></section><section id="grid" class="grid-view hidden" aria-label="Report grid"></section><div id="empty" class="empty hidden"><span>Nothing here. Yet.</span><p>Try a different company, decade, or design detail.</p><button class="primary" id="empty-clear">Reset the archive ${icon("arrow-right")}</button></div>
<div class="canvas-caption"><span class="tiny-cross">✳</span> A NEW PERSPECTIVE ON OLD PAGES</div><div class="explore-hint">${icon("move")} Drag to explore <span>·</span> Scroll to wander</div>
<div class="dock"><div class="view-switch" aria-label="Gallery layout"><button id="canvas-view" class="selected" aria-label="Canvas view" aria-pressed="true">${icon("move")}<span>Canvas</span></button><button id="grid-view" aria-label="Grid view" aria-pressed="false">${icon("grid-2x2")}<span>Grid</span></button></div><span class="dock-line"></span><button id="open-search" class="search-trigger">${icon("search")}<span>Find something good</span><kbd>/</kbd></button><span class="dock-line zoom-controls"></span><div class="zoom-controls"><button id="zoom-out" aria-label="Zoom out">${icon("minus")}</button><button id="zoom-value" aria-label="Reset canvas">100%</button><button id="zoom-in" aria-label="Zoom in">${icon("plus")}</button></div></div></main>
<dialog id="search-dialog" class="search-dialog" aria-label="Search the archive"><div class="search-line">${icon("search")}<input id="search-input" placeholder="A company, a year, a feeling…" aria-label="Search reports" autocomplete="off"><button class="icon-button" data-close="search-dialog" aria-label="Close search">${icon("x")}</button></div><div class="search-body"><div class="eyebrow">FOLLOW YOUR CURIOSITY</div><div class="suggestions">${["Geometric", "IBM", "1972", "Illustration", "Photography", "Paul Rand"].map((t) => `<button data-search="${t}">${t} ${icon("arrow-up-right")}</button>`).join("")}</div><p id="search-count">Search all 3,002 artifacts</p><button id="search-done" class="primary">Explore results ${icon("arrow-right")}</button></div></dialog>
<dialog id="about-dialog" class="about-dialog" aria-label="About Annual Archive"><button class="icon-button dialog-close" data-close="about-dialog" aria-label="Close about">${icon("x")}</button><div class="eyebrow">ANNUAL ARCHIVE / A DESIGN FIELD TRIP</div><h2>Even business<br>had an <em>art department.</em></h2><p>For decades, the annual report was a canvas for extraordinary graphic design. Artists, photographers, and typographers turned company stories into objects worth keeping.</p><p>This is a place to wander through that history. Explore the covers, unfold the pages, and collect what catches your eye.</p><div class="about-stats"><span><strong>3,002</strong>artifacts</span><span><strong>1945–2023</strong>years of design</span></div><p class="source-note">Catalogue and cover images from <a href="https://annualreport.gallery/" target="_blank" rel="noreferrer">Annual Report Archive by Phil Hedayatnia ↗</a>. Original documents are credited to their source collections. Rights remain with their respective owners.</p><p class="source-note">Full-page reading is available when the source provides public scans or a PDF. Other entries link to their original collection. Your collection is saved in this browser.</p></dialog>
<dialog id="reader" class="reader" aria-label="Report reading room"><header class="reader-header"><button id="close-reader">${icon("arrow-left")} <span>Back to archive</span></button><span class="reader-breadcrumb">ANNUAL ARCHIVE <span>/</span> READING ROOM</span><button id="save-report">${icon("bookmark")} Save report</button></header><div class="reader-body"><aside class="report-info" id="report-info"></aside><section class="report-stage"><div id="page-canvas" class="page-canvas" tabindex="0" aria-label="Report pages canvas. Drag or use arrow keys to browse."></div><div id="page-strip" class="page-strip hidden" aria-label="Horizontal report pages"></div><div id="page-reader" class="page-reader hidden"></div><div id="report-status" class="report-status" role="status"></div><div class="reader-dock"><div class="view-switch"><button id="strip-mode">${icon("book-open")} Scroll</button><button id="pages-mode" class="selected">${icon("grid-2x2")} All pages</button><button id="read-mode">${icon("book-open")} Read</button></div><span class="dock-line"></span><div id="page-navigation"><button id="prev-page" aria-label="Previous page">${icon("arrow-left")}</button><span id="page-number">—</span><button id="next-page" aria-label="Next page">${icon("arrow-right")}</button></div><div id="page-zoom"><button id="page-minus" aria-label="Zoom out pages">${icon("minus")}</button><button id="page-reset" aria-label="Reset pages canvas">100%</button><button id="page-plus" aria-label="Zoom in pages">${icon("plus")}</button></div></div></section></div></dialog><div id="toast" class="toast" role="status"></div>`;
paintIcons();
const $ = (s) => document.querySelector(s);
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("show"), 2600);
}
function showDialog(id) {
  $("#" + id).showModal();
}
document
  .querySelectorAll("[data-close]")
  .forEach((b) => (b.onclick = () => $("#" + b.dataset.close).close()));
document.querySelectorAll("dialog:not(#reader)").forEach((d) =>
  d.addEventListener("click", (e) => {
    if (e.target === d) {
      const r = d.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        d.close();
    }
  }),
);
$("#about").onclick = () => showDialog("about-dialog");
function openSearch() {
  showDialog("search-dialog");
  $("#search-input").value = query;
  $("#search-input").focus();
}
$("#open-search").onclick = openSearch;
$("#search-done").onclick = () => $("#search-dialog").close();
$("#search-input").oninput = (e) => {
  query = e.target.value;
  applyFilters();
};
$("#search-input").onkeydown = (e) => {
  if (e.key === "Enter") $("#search-dialog").close();
};
document.querySelectorAll("[data-search]").forEach(
  (b) =>
    (b.onclick = () => {
      query = b.dataset.search;
      $("#search-input").value = query;
      applyFilters();
      $("#search-dialog").close();
    }),
);
for (const name of ["decade", "industry", "color"])
  $("#" + name).onchange = () => {
    decade = $("#decade").value;
    industry = $("#industry").value;
    color = $("#color").value;
    applyFilters();
  };
function resetFilters() {
  query = decade = industry = color = "";
  savedOnly = false;
  $("#decade").value = $("#industry").value = $("#color").value = "";
  $("#saved").setAttribute("aria-pressed", "false");
  applyFilters();
}
$("#clear").onclick = resetFilters;
$("#empty-clear").onclick = resetFilters;
$("#saved").onclick = () => {
  savedOnly = !savedOnly;
  $("#saved").setAttribute("aria-pressed", savedOnly);
  applyFilters();
};
function applyFilters() {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  filtered = data.filter((e) => {
    const hay = [e.o, e.y, e.i, e.d, e.dsg, e.k].join(" ").toLowerCase();
    return (
      terms.every((t) => hay.includes(t)) &&
      (!decade || e.y.startsWith(decade.slice(0, 3))) &&
      (!industry || e.i === industry) &&
      (!color || e.k === color) &&
      (!savedOnly || saved.has(e.id))
    );
  });
  $("#result-count").textContent =
    `${filtered.length.toLocaleString()} ${savedOnly ? "collected" : "artifacts"}`;
  $("#search-count").textContent =
    `${filtered.length.toLocaleString()} artifacts to explore`;
  $("#clear").classList.toggle(
    "hidden",
    !(query || decade || industry || color || savedOnly),
  );
  $("#empty").classList.toggle("hidden", filtered.length > 0);
  gridLimit = 90;
  if (canvas) canvas.setItems(filtered);
  if (view === "grid") renderGrid();
  $("#open-search").classList.toggle("has-query", !!query);
  $("#open-search span").textContent = query || "Find something good";
}
function renderGrid() {
  const grid = $("#grid");
  grid.innerHTML =
    filtered
      .slice(0, gridLimit)
      .map(
        (e) =>
          `<button class="grid-card" data-id="${esc(e.id)}"><img src="/api/cover?id=${encodeURIComponent(e.id)}" loading="lazy" alt="${esc(e.o)} annual report cover, ${esc(e.y)}"><span><span>${esc(e.o)}</span><span>${esc(e.y || "—")}</span></span></button>`,
      )
      .join("") +
    (filtered.length > gridLimit
      ? '<button class="load-more primary">More to discover ↓</button>'
      : "");
  grid
    .querySelectorAll("[data-id]")
    .forEach(
      (b) =>
        (b.onclick = () => openReport(data.find((e) => e.id === b.dataset.id))),
    );
  grid.querySelector(".load-more")?.addEventListener("click", () => {
    gridLimit += 90;
    renderGrid();
  });
}
function setView(next) {
  view = next;
  $("#gallery").classList.toggle("hidden", next !== "canvas");
  $("#grid").classList.toggle("hidden", next !== "grid");
  document.body.classList.toggle("is-grid", next === "grid");
  for (const v of ["canvas", "grid"]) {
    $("#" + v + "-view").classList.toggle("selected", v === next);
    $("#" + v + "-view").setAttribute("aria-pressed", v === next);
  }
  if (next === "grid") {
    canvas?.destroy();
    canvas = null;
    renderGrid();
  } else if (!canvas) initCanvas();
}
$("#canvas-view").onclick = () => setView("canvas");
$("#grid-view").onclick = () => setView("grid");
$("#zoom-out").onclick = () => canvas?.setZoom(canvas.tz - 0.15);
$("#zoom-in").onclick = () => canvas?.setZoom(canvas.tz + 0.15);
$("#zoom-value").onclick = () => canvas?.reset();
$("#shuffle").onclick = () => {
  if (!filtered.length) return;
  const shift = 1 + Math.floor(Math.random() * (filtered.length - 1));
  filtered = [...filtered.slice(shift), ...filtered.slice(0, shift)];
  canvas?.setItems(filtered);
  if (view === "grid") renderGrid();
  toast("A fresh place to start.");
};
function initCanvas() {
  canvas = new ArchiveCanvas($("#gallery"), {
    items: filtered,
    onSelect: openReport,
    onZoom: (z) => ($("#zoom-value").textContent = Math.round(z * 100) + "%"),
  });
}
function updateSaved() {
  const isSaved = saved.has(active?.id);
  $("#save-report").innerHTML =
    icon(isSaved ? "check" : "bookmark") +
    (isSaved ? " Saved to collection" : " Save report");
  $("#save-report").setAttribute("aria-pressed", isSaved);
  $("#saved-count").textContent = String(saved.size).padStart(2, "0");
  paintIcons();
}
$("#save-report").onclick = () => {
  if (!active) return;
  if (saved.has(active.id)) {
    saved.delete(active.id);
    toast("Removed from your collection.");
  } else {
    saved.add(active.id);
    toast("A good find. Saved to your collection.");
  }
  try {
    localStorage.setItem("annual-saved", JSON.stringify([...saved]));
  } catch {
    toast("Browser storage is unavailable. Saved for this visit.");
  }
  updateSaved();
  if (savedOnly) applyFilters();
};
async function openReport(report) {
  if (!report) return;
  const current = ++requestId;
  manifest?.pdfDocument?.destroy();
  active = report;
  if (canvas) canvas.paused = true;
  manifest = null;
  page = 0;
  readerMode = "pages";
  previousFocus = document.activeElement;
  readerCanvas?.destroy();
  readerCanvas = null;
  $("#page-reader").innerHTML = "";
  $("#page-strip").innerHTML = "";
  $("#page-canvas").innerHTML = "";
  $("#reader").showModal();
  $("#report-info").innerHTML =
    `<div class="eyebrow">THE ANNUAL REPORT / ${esc(report.y || "UNDATED")}</div><h2>${esc(report.o)}</h2><span class="report-industry">${esc(report.i)}</span><div class="report-cover"><img src="/api/cover?id=${encodeURIComponent(report.id)}" alt="${esc(report.o)} cover"></div><p class="report-description">${esc(report.d)}</p>${report.dsg ? `<div class="info-pair"><span>DESIGN</span><strong>${esc(report.dsg)}</strong></div>` : ""}<div class="info-pair"><span>COLLECTION</span><strong>${esc(report.c)}</strong></div><a class="source-link" href="${esc(report.s)}" target="_blank" rel="noreferrer">Visit original source ${icon("arrow-up-right")}</a><p class="availability" id="availability">Finding the original pages…</p>`;
  updateSaved();
  setReaderMode("pages");
  $("#report-status").innerHTML =
    '<span class="loading-orbit"></span><h3>Unfolding the archive.</h3><p>Retrieving the original pages from their collection.</p>';
  $("#report-status").classList.remove("hidden");
  paintIcons();
  history.replaceState(null, "", "#report=" + encodeURIComponent(report.id));
  try {
    const response = await fetch(
      "/api/report?v=2&id=" + encodeURIComponent(report.id),
      { cache: "no-cache" },
    );
    if (!response.ok) throw new Error();
    const result = await response.json();
    if (current !== requestId) return;
    manifest = result;
    if (result.kind === "pdf") {
      await loadPDF(report, current);
      if (current !== requestId) return;
    }
    if (manifest.pages.length) {
      $("#availability").textContent =
        `${manifest.pages.length} original pages · click any page to read`;
      $("#report-status").classList.add("hidden");
      readerCanvas = new ArchiveCanvas($("#page-canvas"), {
        items: manifest.pages,
        pages: true,
        onSelect: (p) => {
          page = p.index;
          setReaderMode("read");
        },
        onZoom: (z) =>
          ($("#page-reset").textContent = Math.round(z * 100) + "%"),
      });
      if (innerWidth < 700) readerCanvas.setZoom(0.7);
      renderStrip();
      setReaderMode("pages");
    } else {
      $("#availability").textContent =
        "This collection provides a cover and source record; full page scans are not available here.";
      $("#report-status").innerHTML =
        `<img class="unavailable-cover" src="/api/cover?id=${encodeURIComponent(report.id)}" alt="${esc(report.o)} report"><h3>A cover worth keeping.</h3><p>This source does not provide page scans.<br>You can browse its original record below.</p><a class="primary" href="${esc(report.s)}" target="_blank" rel="noreferrer">Open source collection ${icon("arrow-up-right")}</a>`;
      $("#read-mode").disabled = true;
      paintIcons();
    }
  } catch {
    if (current !== requestId) return;
    $("#availability").textContent =
      "The original collection is temporarily unavailable.";
    $("#report-status").innerHTML =
      `<h3>The archive is taking a moment.</h3><p>We couldn’t retrieve these pages from the source.</p><button class="primary" id="retry-report">Try again ${icon("rotate-ccw")}</button><a class="source-link" href="${esc(report.s)}" target="_blank" rel="noreferrer">Open the original report ↗</a>`;
    $("#retry-report").onclick = () => openReport(report);
    paintIcons();
  }
}
async function loadPDF(report, current) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).href;
  const pdf = await pdfjs.getDocument({
    url: "/api/pdf?id=" + encodeURIComponent(report.id),
  }).promise;
  if (current !== requestId) {
    pdf.destroy();
    return;
  }
  manifest.pdfDocument = pdf;
  const first = await pdf.getPage(1);
  const vp = first.getViewport({ scale: 1 });
  manifest.pages = Array.from({ length: pdf.numPages }, (_, i) => ({
    index: i,
    label: String(i + 1),
    width: vp.width,
    height: vp.height,
    thumb: "",
    image: "",
  }));
  for (let i = 0; i < pdf.numPages; i++) {
    if (current !== requestId) return;
    const p = await pdf.getPage(i + 1);
    const v = p.getViewport({ scale: 0.65 });
    const c = document.createElement("canvas");
    c.width = v.width;
    c.height = v.height;
    await p.render({ canvasContext: c.getContext("2d"), viewport: v }).promise;
    const url = c.toDataURL("image/jpeg", 0.8);
    Object.assign(manifest.pages[i], {
      thumb: url,
      image: url,
      width: v.width,
      height: v.height,
    });
    $("#report-status p").textContent =
      `Preparing page ${i + 1} of ${pdf.numPages}…`;
  }
}
function setReaderMode(mode) {
  readerMode = mode;
  for (const option of ["strip", "pages", "read"]) {
    $("#" + option + "-mode").setAttribute("aria-pressed", option === mode);
  }
  $("#page-strip").classList.toggle("hidden", mode !== "strip");
  $("#strip-mode").classList.toggle("selected", mode === "strip");
  $("#strip-mode").disabled = !manifest?.pages.length;
  $("#page-canvas").classList.toggle("hidden", mode !== "pages");
  $("#page-reader").classList.toggle("hidden", mode !== "read");
  $("#pages-mode").classList.toggle("selected", mode === "pages");
  $("#read-mode").classList.toggle("selected", mode === "read");
  $("#read-mode").disabled = !manifest?.pages.length;
  $("#page-navigation").classList.toggle("hidden", mode !== "read");
  $("#page-zoom").classList.toggle("hidden", mode !== "pages");
  if (mode === "read") renderPage();
}
function renderPage() {
  if (!manifest?.pages.length) return;
  page = Math.max(0, Math.min(page, manifest.pages.length - 1));
  const p = manifest.pages[page];
  $("#page-reader").innerHTML =
    `<img src="${esc(p.image)}" alt="${esc(active.o)}, page ${esc(p.label)}"><p>PAGE ${esc(p.label)} / ${manifest.pages.length}</p>`;
  $("#page-reader").scrollTop = 0;
  $("#page-number").textContent = `${page + 1} / ${manifest.pages.length}`;
  $("#prev-page").disabled = page === 0;
  $("#next-page").disabled = page === manifest.pages.length - 1;
  $("#page-reader img").onerror = () => {
    $("#page-reader").innerHTML =
      '<div class="page-error"><h3>This scan couldn’t load.</h3><p>Try another page, or visit the original source.</p><button class="primary" id="retry-page">Retry page</button></div>';
    $("#retry-page").onclick = renderPage;
  };
  if (manifest.pdfDocument) renderPDFPage(p, page).catch(() => {});
}
async function renderPDFPage(p, index) {
  const pdf = manifest.pdfDocument;
  const pdfPage = await pdf.getPage(index + 1);
  const v = pdfPage.getViewport({ scale: 1.8 });
  const c = document.createElement("canvas");
  c.width = v.width;
  c.height = v.height;
  await pdfPage.render({ canvasContext: c.getContext("2d"), viewport: v })
    .promise;
  if (manifest?.pdfDocument === pdf && page === index && readerMode === "read")
    $("#page-reader img").src = c.toDataURL("image/jpeg", 0.94);
}
function renderStrip() {
  const strip = $("#page-strip");
  strip.innerHTML = manifest.pages
    .map(
      (p) =>
        `<button class="strip-page" data-page="${p.index}" aria-label="Read page ${esc(p.label)}"><img src="${esc(p.thumb)}" alt="Page ${esc(p.label)}" loading="lazy" width="${p.width}" height="${p.height}"><span>PAGE ${esc(p.label)} ${icon("arrow-up-right")}</span></button>`,
    )
    .join("");
  strip.querySelectorAll("img").forEach((img) =>
    img.addEventListener("error", () => {
      img.alt = "Scan unavailable — click to retry in reader";
      img.classList.add("scan-failed");
    }),
  );
  strip.querySelectorAll("button").forEach(
    (b) =>
      (b.onclick = () => {
        page = Number(b.dataset.page);
        setReaderMode("read");
      }),
  );
  paintIcons();
}
$("#page-strip").addEventListener(
  "wheel",
  (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && !e.ctrlKey) {
      e.preventDefault();
      const strip = $("#page-strip");
      strip.style.scrollSnapType = "none";
      strip.scrollLeft += e.deltaY;
      clearTimeout(strip.snapTimer);
      strip.snapTimer = setTimeout(() => {
        strip.style.scrollSnapType = "";
      }, 250);
    }
  },
  { passive: false },
);
$("#strip-mode").onclick = () => setReaderMode("strip");
$("#pages-mode").onclick = () => setReaderMode("pages");
$("#read-mode").onclick = () => setReaderMode("read");
$("#prev-page").onclick = () => {
  page--;
  renderPage();
};
$("#next-page").onclick = () => {
  page++;
  renderPage();
};
$("#page-minus").onclick = () => readerCanvas?.setZoom(readerCanvas.tz - 0.15);
$("#page-plus").onclick = () => readerCanvas?.setZoom(readerCanvas.tz + 0.15);
$("#page-reset").onclick = () => readerCanvas?.reset();
$("#close-reader").onclick = () => $("#reader").close();
$("#reader").addEventListener("close", () => {
  if ($("#reader").open) return;
  ++requestId;
  readerCanvas?.destroy();
  readerCanvas = null;
  manifest?.pdfDocument?.destroy();
  manifest = null;
  active = null;
  if (canvas) canvas.paused = false;
  history.replaceState(null, "", location.pathname);
  previousFocus?.focus();
});
document.addEventListener("keydown", (e) => {
  const input = /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
  if (e.key === "/" && !input && !$("dialog[open]")) {
    e.preventDefault();
    openSearch();
  }
  if ($("#reader").open && !input && readerMode === "read") {
    if (e.key === "ArrowRight" && page < manifest.pages.length - 1) {
      page++;
      renderPage();
    }
    if (e.key === "ArrowLeft" && page > 0) {
      page--;
      renderPage();
    }
  }
});
try {
  const r = await fetch("/catalog.json");
  if (!r.ok) throw new Error();
  data = await r.json();
  const industries = [...new Set(data.map((e) => e.i))].sort();
  $("#industry").insertAdjacentHTML(
    "beforeend",
    industries.map((i) => `<option>${esc(i)}</option>`).join(""),
  );
  applyFilters();
  initCanvas();
  const id = new URLSearchParams(location.hash.slice(1)).get("report");
  if (id) openReport(data.find((e) => e.id === id));
} catch {
  $("#result-count").textContent = "Archive unavailable";
  $("#empty").classList.remove("hidden");
  $("#empty p").textContent =
    "The catalogue couldn’t load. Please refresh to try again.";
  $("#empty-clear").onclick = () => location.reload();
}

const layoutObserver = new ResizeObserver(() => {
  document.documentElement.style.setProperty(
    "--gallery-top",
    Math.round($(".filterbar").getBoundingClientRect().bottom) + "px",
  );
});
layoutObserver.observe($(".intro"));
layoutObserver.observe($(".masthead"));

window.addEventListener("hashchange", () => {
  const id = new URLSearchParams(location.hash.slice(1)).get("report");
  if (id && id !== active?.id)
    openReport(data.find((report) => report.id === id));
  else if (!id && $("#reader").open) $("#reader").close();
});
