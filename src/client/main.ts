import { changeDock, initDockMotion } from "./dock-motion";
import { initMagneticControls } from "./magnetic-controls";
import { matchesFilters, SearchGeneration } from "../search/control";
import { manageSplash, waitForArtwork } from "./loading";
import {
  imageGhost,
  moveImage,
  fitArtwork,
  reducedMotion,
} from "./image-transition";
import { cx, syncStyles } from "../styles/ui";
import { motion } from "../lib/motion";
import type {
  Report,
  ReportPage,
  ReaderManifest,
  GalleryView,
  ReaderView,
  CoverRect,
} from "../lib/types";
import { ArchiveCanvas } from "./canvas";
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
const icon = (n: string) => `<i data-lucide="${n}"></i>`;
const paintIcons = () => {
  createIcons({ icons, attrs: { "stroke-width": 1.5 } });
  syncStyles();
};
const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] || c,
  );
let data: Report[] = [],
  filtered: Report[] = [],
  canvas: ArchiveCanvas<Report> | null = null,
  view: GalleryView = "canvas",
  saved = new Set<string>(),
  savedOnly = false,
  query = "",
  decade = "",
  industry = "",
  color = "",
  readerCanvas: ArchiveCanvas<ReportPage> | null = null,
  active: Report | null = null,
  manifest: ReaderManifest | null = null,
  page = 0,
  readerMode: ReaderView = "pages",
  requestId = 0,
  previousFocus: HTMLElement | null = null;
try {
  saved = new Set(JSON.parse(localStorage.getItem("annual-saved") || "[]"));
} catch {}
type ElementFor<S extends string> = S extends
  "#reader" | "#search-dialog" | "#about-dialog" | "dialog[open]"
  ? HTMLDialogElement
  : S extends "#search-input"
    ? HTMLInputElement
    : S extends "#decade" | "#industry" | "#color"
      ? HTMLSelectElement
      : S extends "#read-mode" | "#strip-mode" | "#prev-page" | "#next-page"
        ? HTMLButtonElement
        : HTMLElement;
function $<S extends string>(selector: S): ElementFor<S> {
  return document.querySelector(selector) as ElementFor<S>;
}
paintIcons();
let toastTimer: ReturnType<typeof setTimeout>;

function toast(message: string) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 2600);
}
function showDialog(id: string) {
  (document.getElementById(id) as HTMLDialogElement).showModal();
}
document
  .querySelectorAll<HTMLElement>("[data-close]")
  .forEach(
    (b) =>
      (b.onclick = () =>
        (
          document.getElementById(b.dataset.close!) as HTMLDialogElement
        ).close()),
  );
document
  .querySelectorAll<HTMLDialogElement>("dialog:not(#reader)")
  .forEach((d) =>
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
  query = (e.target as HTMLInputElement).value;
  applyFilters();
};
$("#search-input").onkeydown = (e) => {
  if (e.key === "Enter") {
    if (searchScope === "pages") $("#page-search-results button")?.focus();
    else $("#search-dialog").close();
  }
};
document.querySelectorAll<HTMLElement>("[data-search]").forEach(
  (b) =>
    (b.onclick = () => {
      query = b.dataset.search || "";
      $("#search-input").value = query;
      applyFilters();
      if (searchScope === "reports") $("#search-dialog").close();
    }),
);
for (const name of ["decade", "industry", "color"] as const)
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
  $("#saved").setAttribute("aria-pressed", String(savedOnly));
  applyFilters();
};
const searchGeneration = new SearchGeneration();
const pageGeneration = new SearchGeneration();
let semanticQuery = "";
let semanticHits: string[] = [];
let searchTimer: ReturnType<typeof setTimeout>;
let searchRequest: AbortController | undefined;
let searchScope: "reports" | "pages" = "reports";
let pageSearchTimer: ReturnType<typeof setTimeout>;
let pageSearchAbort: AbortController | undefined;
function searchPages() {
  const generation = pageGeneration.next();
  clearTimeout(pageSearchTimer);
  pageSearchAbort?.abort();
  const results = $("#page-search-results");
  results.className = cx("pageResults");
  if (query.trim().length < 2) {
    results.replaceChildren();
    $("#search-count").textContent =
      "Search page layouts, typography, or imagery";
    return;
  }
  const requested = query;
  pageSearchTimer = setTimeout(async () => {
    pageSearchAbort = new AbortController();
    $("#search-count").textContent = "Finding related pages…";
    try {
      const response = await fetch(
        "/api/page-search?q=" + encodeURIComponent(requested),
        { signal: pageSearchAbort.signal },
      );
      const result = (await response.json()) as {
        hits: {
          reportId: string;
          pageIndex: number;
          image: string;
          tags: { label: string }[];
        }[];
        indexedPages: number;
      };
      if (
        searchScope !== "pages" ||
        query !== requested ||
        !pageGeneration.isCurrent(generation)
      )
        return;
      if (!response.ok) throw new Error("Index preparing");
      results.replaceChildren();
      for (const hit of result.hits) {
        const report = data.find((r) => r.id === hit.reportId);
        if (
          !report ||
          !matchesFilters(report, { decade, industry, color, savedOnly, saved })
        )
          continue;
        const button = document.createElement("button");
        button.className = cx("pageResult");
        button.setAttribute(
          "aria-label",
          `${report.o}, page ${hit.pageIndex + 1}: ${hit.tags.map((t) => t.label).join(", ")}`,
        );
        const image = document.createElement("img");
        image.className = cx("pageResultImage");
        image.src = hit.image;
        image.alt = "";
        image.loading = "lazy";
        button.append(image);
        button.onclick = async () => {
          $("#search-dialog").close();
          await openReport(report);
          if (active?.id === report.id && manifest?.pages[hit.pageIndex]) {
            page = hit.pageIndex;
            setReaderMode("read");
          }
        };
        results.append(button);
      }
      $("#result-count").textContent = `${results.childElementCount} pages`;
      $("#search-count").textContent =
        `${results.childElementCount} matches · ${result.indexedPages.toLocaleString()} pages indexed`;
    } catch {
      if (searchScope === "pages" && query === requested)
        $("#search-count").textContent =
          "The page index is preparing. Try again shortly.";
    }
  }, 220);
}
for (const scope of ["reports", "pages"] as const) {
  $("#search-" + scope).onclick = () => {
    searchScope = scope;
    searchGeneration.next();
    pageGeneration.next();
    searchRequest?.abort();
    pageSearchAbort?.abort();
    clearTimeout(searchTimer);
    clearTimeout(pageSearchTimer);
    for (const item of ["reports", "pages"]) {
      $("#search-" + item).className = cx(
        "switchButton",
        ...(item === scope ? ["selected" as const] : []),
      );
      $("#search-" + item).setAttribute("aria-pressed", String(item === scope));
    }
    $("#page-search-results").classList.toggle("hidden", scope === "reports");
    applyFilters();
  };
}
function applyFilters(semanticUpdate = false) {
  if (searchScope === "pages") {
    filtered = data.filter((r) =>
      matchesFilters(r, { decade, industry, color, savedOnly, saved }),
    );
    canvas?.setItems(filtered);
    $("#empty").classList.toggle("hidden", filtered.length > 0);
    $("#search-done").classList.add("hidden");
    searchPages();
    return;
  }
  $("#search-done").classList.remove("hidden");
  if (!semanticUpdate) {
    const generation = searchGeneration.next();
    clearTimeout(searchTimer);
    searchRequest?.abort();
    if (query.trim().length > 1 && semanticQuery !== query) {
      const requestedQuery = query;
      searchTimer = setTimeout(async () => {
        searchRequest = new AbortController();
        try {
          $("#search-count").textContent = "Finding related styles…";
          const response = await fetch(
            `/api/search?q=${encodeURIComponent(requestedQuery)}`,
            { signal: searchRequest.signal },
          );
          if (!response.ok) throw new Error("Search unavailable");
          const result = (await response.json()) as { hits: { id: string }[] };
          if (
            query !== requestedQuery ||
            !searchGeneration.isCurrent(generation)
          )
            return;
          semanticQuery = requestedQuery;
          semanticHits = result.hits.map((hit) => hit.id);
          applyFilters(true);
        } catch {
          if (query === requestedQuery)
            $("#search-count").textContent =
              `${filtered.length.toLocaleString()} matching artifacts`;
        }
      }, 220);
    }
  }
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  filtered = data.filter((e) => {
    const hay = [e.o, e.y, e.i, e.d, e.dsg, e.k].join(" ").toLowerCase();
    return (
      (query && semanticQuery === query
        ? semanticHits.includes(e.id)
        : terms.every((t) => hay.includes(t))) &&
      matchesFilters(e, { decade, industry, color, savedOnly, saved })
    );
  });
  if (query && semanticQuery === query) {
    const order = new Map(semanticHits.map((id, index) => [id, index]));
    filtered.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  }
  $("#result-count").textContent =
    `${filtered.length.toLocaleString()} ${savedOnly ? "collected" : "artifacts"}`;
  $("#search-count").textContent =
    `${filtered.length.toLocaleString()} artifacts to explore`;
  $("#clear").classList.toggle(
    "hidden",
    !(query || decade || industry || color || savedOnly),
  );
  $("#empty").classList.toggle("hidden", filtered.length > 0);
  if (canvas) canvas.setItems(filtered);
  $("#open-search").classList.toggle("has-query", !!query);
  $("#open-search span").textContent = query || "Search the archive";
  syncStyles();
}
function visibleCovers(_mode: GalleryView) {
  const entries = [...(canvas?.cards.values() || [])].map((c) => ({
    id: c.item.id,
    el: c.el,
    src: c.el.querySelector("img")?.src,
  }));
  const result = new Map<string, CoverPosition>();
  for (const entry of entries) {
    if (!entry.src) continue;
    const rect = entry.el.getBoundingClientRect();
    let { left, top, width, height } = rect;
    if (entry.el instanceof HTMLImageElement && entry.el.naturalWidth) {
      const scale = Math.min(
        width / entry.el.naturalWidth,
        height / entry.el.naturalHeight,
      );
      const w = entry.el.naturalWidth * scale,
        h = entry.el.naturalHeight * scale;
      left += (width - w) / 2;
      top += (height - h) / 2;
      width = w;
      height = h;
    }
    if (
      left + width < 0 ||
      top + height < 0 ||
      left > innerWidth ||
      top > innerHeight ||
      !width
    )
      continue;
    if (!result.has(entry.id))
      result.set(entry.id, {
        id: entry.id,
        src: entry.src,
        left,
        top,
        width,
        height,
      });
  }
  return result;
}
function setView(next: GalleryView) {
  if (next === view) return;
  const finishDock = changeDock(".dock");
  view = next;
  document.body.classList.toggle("is-grid", next === "grid");
  for (const mode of ["canvas", "grid"]) {
    $("#" + mode + "-view").classList.toggle("selected", mode === next);
    $("#" + mode + "-view").setAttribute("aria-pressed", String(mode === next));
  }
  canvas?.setCoverLayout(next);
  syncStyles();
  finishDock();
}
$("#canvas-view").onclick = () => setView("canvas");
$("#grid-view").onclick = () => setView("grid");
$("#zoom-out").onclick = () => canvas?.setZoom(canvas.tz - 0.15);
$("#zoom-in").onclick = () => canvas?.setZoom(canvas.tz + 0.15);
$("#zoom-value").onclick = () => canvas?.reset();
function initCanvas() {
  canvas = new ArchiveCanvas($("#gallery"), {
    items: filtered,
    onSelect: openReport,
    onZoom: (z) => ($("#zoom-value").textContent = Math.round(z * 100) + "%"),
  });
}
function updateSaved() {
  const isSaved = saved.has(active?.id || "");
  $("#save-report").innerHTML =
    icon(isSaved ? "check" : "bookmark") +
    (isSaved ? " Saved to collection" : " Save report");
  $("#save-report").setAttribute("aria-pressed", String(isSaved));
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
async function openReport(report: Report | undefined, origin?: CoverRect) {
  if (!report) return;
  const current = ++requestId;
  manifest?.pdfTask?.destroy();
  pdfRenders.clear();
  active = report;
  if (canvas) canvas.paused = true;
  manifest = null;
  page = 0;
  readerMode = "pages";
  previousFocus = document.activeElement as HTMLElement | null;
  readerCanvas?.destroy();
  readerCanvas = null;
  $("#page-canvas").innerHTML = "";
  $("#reader").classList.remove("details-open", "transitioning");
  $("#reader").showModal();
  const arrival = beginReportTransition(report, origin);
  $("#report-info").innerHTML =
    `<div class="eyebrow">THE ANNUAL REPORT / ${esc(report.y || "UNDATED")}</div><h2>${esc(report.o)}</h2><span class="report-industry">${esc(report.i)}</span><div class="report-cover"><img src="/api/cover?id=${encodeURIComponent(report.id)}" alt="${esc(report.o)} cover"></div><p class="report-description">${esc(report.d)}</p>${report.dsg ? `<div class="info-pair"><span>DESIGN</span><strong>${esc(report.dsg)}</strong></div>` : ""}<div class="info-pair"><span>COLLECTION</span><strong>${esc(report.c)}</strong></div><a class="source-link" href="${esc(report.s)}" target="_blank" rel="noreferrer">Visit original source ${icon("arrow-up-right")}</a><p class="availability" id="availability">Finding the original pages…</p><div id="page-design"></div>`;
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
    if (!manifest) return;
    if (manifest.pages.length) {
      $("#availability").textContent =
        manifest.pages.length === 1
          ? "Click to read"
          : `${manifest.pages.length} original pages · click any page to read`;
      $("#report-status").classList.add("hidden");
      readerCanvas = new ArchiveCanvas($("#page-canvas"), {
        items: manifest.pages,
        pages: true,
        onSelect: (p, origin) => {
          page = p.index;
          setReaderMode("read", origin);
        },
        onZoom: (z) =>
          ($("#page-reset").textContent = Math.round(z * 100) + "%"),
      });
      if (innerWidth < 700) readerCanvas.setZoom(0.7);
      setReaderMode("pages");
      await arrival.finish();
    } else {
      await arrival.finish();
      $("#availability").textContent =
        "This collection provides a cover and source record; full page scans are not available here.";
      $("#report-status").innerHTML =
        `<img class="unavailable-cover" src="/api/cover?id=${encodeURIComponent(report.id)}" alt="${esc(report.o)} report"><h3>A cover worth keeping.</h3><p>This source does not provide page scans.<br>You can browse its original record below.</p><a class="primary" href="${esc(report.s)}" target="_blank" rel="noreferrer">Open source collection ${icon("arrow-up-right")}</a>`;
      $("#read-mode").disabled = true;
      paintIcons();
    }
  } catch {
    await arrival.finish();
    if (current !== requestId) return;
    $("#availability").textContent =
      "The original collection is temporarily unavailable.";
    $("#report-status").innerHTML =
      `<h3>The archive is taking a moment.</h3><p>We couldn’t retrieve these pages from the source.</p><button class="primary" id="retry-report">Try again ${icon("rotate-ccw")}</button><a class="source-link" href="${esc(report.s)}" target="_blank" rel="noreferrer">Open the original report ↗</a>`;
    $("#retry-report").onclick = () => openReport(report);
    paintIcons();
  }
}
async function loadPDF(report: Report, current: number) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).href;
  const task = pdfjs.getDocument({
    url: "/api/pdf?id=" + encodeURIComponent(report.id),
  });
  const pdf = await task.promise;
  if (current !== requestId || !manifest) {
    task.destroy();
    return;
  }
  const currentManifest = manifest;
  currentManifest.pdfTask = task;
  currentManifest.pdfDocument = pdf;
  const first = await pdf.getPage(1);
  const vp = first.getViewport({ scale: 1 });
  currentManifest.pages = Array.from({ length: pdf.numPages }, (_, i) => ({
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
    await p.render({
      canvas: c,
      canvasContext: c.getContext("2d")!,
      viewport: v,
    }).promise;
    const url = c.toDataURL("image/jpeg", 0.8);
    Object.assign(currentManifest.pages[i], {
      thumb: url,
      image: url,
      width: v.width,
      height: v.height,
    });
    $("#report-status p").textContent =
      `Preparing page ${i + 1} of ${pdf.numPages}…`;
  }
}
function setReaderMode(mode: ReaderView, _origin?: CoverRect) {
  const finishDock = changeDock(".reader-dock");
  if (readerMode === "strip" && mode !== "strip" && !_origin && readerCanvas)
    page = readerCanvas.nearestPage();
  readerMode = mode;
  for (const option of ["strip", "pages", "read"]) {
    $("#" + option + "-mode").setAttribute(
      "aria-pressed",
      String(option === mode),
    );
    $("#" + option + "-mode").classList.toggle("selected", option === mode);
  }
  $("#strip-mode").disabled = !manifest?.pages.length;
  $("#read-mode").disabled = !manifest?.pages.length;
  $("#page-canvas").classList.remove("hidden");
  $("#page-canvas").inert = false;
  $("#reader").classList.toggle("reading-page", mode === "read");
  $("#page-navigation").classList.toggle("hidden", mode !== "read");
  $("#page-zoom").classList.toggle("hidden", mode !== "pages");
  document
    .querySelector(".reader-dock .dock-line")
    ?.classList.toggle("hidden", mode === "strip");
  if (readerCanvas) {
    readerCanvas.paused = false;
    readerCanvas.setPageLayout(mode, page);
  }
  if (mode === "read") renderPage();
  updatePageDesign();
  syncStyles();
  finishDock();
}
function updatePageDesign() {
  const container = $("#page-design");
  if (!container) return;
  container.replaceChildren();
  const tags = manifest?.design?.[page];
  if (!tags?.length) return;
  const title = document.createElement("p");
  title.className = cx("eyebrow");
  title.textContent = `Page ${page + 1} · suggested design`;
  const group = document.createElement("div");
  group.className = cx("suggestions");
  for (const tag of tags) {
    const button = document.createElement("button");
    button.className = cx("suggestion");
    button.textContent = tag.label;
    button.onclick = () => {
      query = tag.label;
      openSearch();
      $("#search-pages").click();
    };
    group.append(button);
  }
  container.append(title, group);
}
const pdfRenders = new Map<number, Promise<string>>();
function renderPage() {
  if (!manifest?.pages.length) return;
  page = Math.max(0, Math.min(page, manifest.pages.length - 1));
  readerCanvas?.setPageLayout("read", page);
  $("#page-number").textContent = `${page + 1} / ${manifest.pages.length}`;
  $("#prev-page").disabled = page === 0;
  $("#next-page").disabled = page === manifest.pages.length - 1;
  updatePageDesign();
  if (manifest.pdfDocument) void renderPDFPage(page).catch(() => {});
  else {
    const item = manifest.pages[page];
    if (item.image !== item.thumb)
      void readerCanvas?.upgradePage(page, item.image).catch(() => {});
  }
}
async function renderPDFPage(index: number) {
  const pdf = manifest?.pdfDocument;
  if (!pdf) return;
  let rendered = pdfRenders.get(index);
  if (!rendered) {
    rendered = (async () => {
      const p = await pdf.getPage(index + 1);
      const v = p.getViewport({ scale: 1.8 });
      const canvas = document.createElement("canvas");
      canvas.width = v.width;
      canvas.height = v.height;
      await p.render({
        canvas,
        canvasContext: canvas.getContext("2d")!,
        viewport: v,
      }).promise;
      return canvas.toDataURL("image/jpeg", 0.94);
    })();
    pdfRenders.set(index, rendered);
  }
  const image = await rendered;
  if (manifest?.pdfDocument === pdf)
    await readerCanvas?.upgradePage(index, image);
}
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
let closingReader = false;
async function closeReader() {
  if (closingReader || !$("#reader").open) return;
  closingReader = true;
  const report = active;
  const destination = report ? visibleCovers(view).get(report.id) : undefined;
  const openingHero = $("#reader").querySelector<HTMLElement>(".report-hero");
  const pageElement =
    openingHero ||
    $("#page-canvas").querySelector<HTMLElement>(".focused-page") ||
    [...$("#page-canvas").querySelectorAll<HTMLElement>(".artifact")].find(
      (el) => {
        const r = el.getBoundingClientRect();
        return (
          r.right > 0 &&
          r.left < innerWidth &&
          r.bottom > 0 &&
          r.top < innerHeight
        );
      },
    );
  const from = pageElement?.getBoundingClientRect();
  const ghost = document.createElement("img");
  ghost.className = cx("transitionCover");
  ghost.alt = "";
  const visibleImage = pageElement?.querySelector<HTMLImageElement>("img");
  if (report)
    ghost.src =
      visibleImage?.src || "/api/cover?id=" + encodeURIComponent(report.id);
  const start =
    from && from.width > 0
      ? from
      : {
          left: innerWidth / 2 - 55,
          top: innerHeight / 2 - 75,
          width: 110,
          height: 150,
        };
  Object.assign(ghost.style, {
    left: start.left + "px",
    top: start.top + "px",
    width: start.width + "px",
    height: start.height + "px",
    zIndex: "101",
  });
  const dialog = $("#reader");
  dialog.classList.add("closing-report");
  dialog.append(ghost);
  if (openingHero) openingHero.style.visibility = "hidden";
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const transform = destination
      ? `translate(${destination.left - start.left}px,${destination.top - start.top}px) scale(${destination.width / start.width})`
      : "scale(.94)";
    const fade = dialog.animate(
      [{ opacity: 1 }, { opacity: 1, offset: 0.12 }, { opacity: 0 }],
      { duration: motion.readerClose, easing: motion.ease, fill: "forwards" },
    );
    await Promise.allSettled([
      fade.finished,
      ghost.animate([{ transform: "none" }, { transform }], {
        duration: motion.readerClose,
        easing: motion.ease,
        fill: "forwards",
      }).finished,
    ]);
    dialog.close();
    dialog.classList.remove("closing-report");
    fade.cancel();
  } else {
    dialog.close();
    dialog.classList.remove("closing-report");
  }
  ghost.remove();
  closingReader = false;
}

$("#close-reader").onclick = closeReader;
$("#reader").addEventListener("cancel", (e) => {
  e.preventDefault();
  if (readerMode === "read") setReaderMode("pages");
  else closeReader();
});
$("#report-details").onclick = () => {
  const expanded = $("#reader").classList.toggle("details-open");
  $("#report-details").setAttribute("aria-expanded", String(expanded));
  syncStyles();
};
$("#reader").addEventListener("close", () => {
  if ($("#reader").open) return;
  $("#reader").classList.remove(
    "transitioning",
    "opening-report",
    "reading-page",
  );
  $("#reader")
    .querySelectorAll(".image-transition,.report-loading")
    .forEach((el) => el.remove());
  $("#reader")
    .querySelectorAll(".splash")
    .forEach((el) => el.remove());
  $("#reader")
    .querySelectorAll(".transition-cover")
    .forEach((el) => el.remove());
  ++requestId;
  readerCanvas?.destroy();
  readerCanvas = null;
  manifest?.pdfTask?.destroy();
  manifest = null;
  active = null;
  if (canvas) canvas.paused = false;
  history.replaceState(null, "", location.pathname);
  previousFocus?.focus();
});
document.addEventListener("keydown", (e) => {
  const input = /INPUT|SELECT|TEXTAREA/.test(
    document.activeElement?.tagName || "",
  );
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && !e.altKey) {
    e.preventDefault();
    if ($("#search-dialog").open) $("#search-dialog").close();
    else openSearch();
    return;
  }
  if (e.key === "/" && !input && !$("dialog[open]")) {
    e.preventDefault();
    openSearch();
  }
  if ($("#reader").open && manifest && !input && readerMode === "read") {
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
const appSplash = manageSplash($("#app-splash"));
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
  await appSplash.finish($("#gallery"));
  const id = new URLSearchParams(location.hash.slice(1)).get("report");
  if (id) openReport(data.find((e) => e.id === id));
} catch {
  $("#result-count").textContent = "Archive unavailable";
  $("#empty").classList.remove("hidden");
  $("#empty p").textContent =
    "The catalogue couldn’t load. Please refresh to try again.";
  $("#empty-clear").onclick = () => location.reload();
  await appSplash.finish();
}

window.addEventListener("hashchange", () => {
  const id = new URLSearchParams(location.hash.slice(1)).get("report");
  if (id && id !== active?.id)
    openReport(data.find((report) => report.id === id));
  else if (!id && $("#reader").open) $("#reader").close();
});

function beginReportTransition(report: Report, origin?: CoverRect) {
  const dialog = $("#reader");
  dialog.classList.add("opening-report");
  const end = fitArtwork(report.a || 1.3);
  const start = origin && origin.width > 0 ? origin : end;
  const hero = imageGhost(
    "/api/cover?id=" + encodeURIComponent(report.id),
    start,
    dialog,
  );
  hero.classList.add("report-hero");
  const loading = document.createElement("span");
  loading.className = "report-loading " + cx("splashCaption");
  loading.innerHTML =
    '<span>Opening report</span><span class="loading-line"><span></span></span>';
  loading.setAttribute("role", "status");
  dialog.append(loading);
  const indicator = loading.querySelector<HTMLElement>(".loading-line span")!;
  const pulse = !reducedMotion()
    ? indicator.animate(
        [{ transform: "translateX(-110%)" }, { transform: "translateX(310%)" }],
        { duration: 1300, iterations: Infinity, easing: "ease-in-out" },
      )
    : null;
  const observer = new MutationObserver(() => {
    const text = $("#report-status").textContent || "";
    const progress = text.match(/Preparing page (\d+) of (\d+)/);
    if (progress) {
      loading.firstElementChild!.textContent = `${progress[1]} / ${progress[2]} pages`;
      pulse?.cancel();
      indicator.style.width = "100%";
      indicator.style.transformOrigin = "left";
      indicator.style.transform = `scaleX(${Number(progress[1]) / Number(progress[2])})`;
    }
  });
  observer.observe($("#report-status"), {
    subtree: true,
    characterData: true,
    childList: true,
  });
  const cleanup = () => {
    observer.disconnect();
    pulse?.cancel();
  };
  dialog.addEventListener("close", cleanup, { once: true });
  const entered = moveImage(hero, start, end, 520);
  const began = performance.now();
  return {
    async finish() {
      await Promise.all([
        entered,
        waitForArtwork($("#page-canvas")),
        new Promise((resolve) =>
          setTimeout(resolve, Math.max(0, 650 - (performance.now() - began))),
        ),
      ]);
      if (!hero.isConnected || !dialog.open) return;
      cleanup();
      dialog.removeEventListener("close", cleanup);
      const from = hero.getBoundingClientRect();
      hero.getAnimations().forEach((animation) => animation.cancel());
      Object.assign(hero.style, {
        left: from.left + "px",
        top: from.top + "px",
        width: from.width + "px",
        height: from.height + "px",
      });
      const target = [...(readerCanvas?.cards.values() || [])].find(
        (card) => card.item.index === 0,
      )?.el;
      dialog.classList.remove("opening-report");
      loading.remove();
      const content = $(".reader-body");
      if (!reducedMotion())
        content.animate(
          [{ opacity: 0 }, { opacity: 0, offset: 0.1 }, { opacity: 1 }],
          { duration: 380, easing: motion.ease },
        );
      if (target)
        await moveImage(hero, from, target.getBoundingClientRect(), 380);
      if (!reducedMotion())
        await hero
          .animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 100,
            fill: "forwards",
          })
          .finished.catch(() => {});
      hero.remove();
    },
  };
}

initMagneticControls();
initDockMotion();

const macKeyboard = /Mac|iPhone|iPad/.test(navigator.platform);
$("#open-search kbd").textContent = macKeyboard ? "⌘ K" : "Ctrl K";
$("#open-search").setAttribute(
  "aria-keyshortcuts",
  macKeyboard ? "Meta+K" : "Control+K",
);

interface CoverPosition {
  id: string;
  src: string;
  left: number;
  top: number;
  width: number;
  height: number;
}
