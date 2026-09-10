import type { DesignTag } from "../search/taxonomy";
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from "pdfjs-dist";

export interface Report {
  id: string;
  o: string;
  y: string;
  c: string;
  s: string;
  i: string;
  k: string;
  img: string;
  a: number;
  r?: string;
  dsg?: string;
  d?: string;
}
export interface ArchiveItem extends Report {
  reportId?: string;
  pageIndex?: number;
  preview?: string;
}
export interface ArchivePage {
  reportId: string;
  pageIndex: number;
  image: string;
}
export interface ReportPage {
  index: number;
  leaf?: number;
  label: string;
  width: number;
  height: number;
  thumb: string;
  image: string;
}
export interface ReportManifest {
  kind: "scans" | "pdf" | "external";
  pages: ReportPage[];
  source: string;
  pdf?: string;
  design?: Record<number, DesignTag[]>;
  download?: {
    url: string;
    sha256: string;
    bytes: number;
    pageCount: number;
    cachedAt: string;
  };
}
export interface ReaderManifest extends ReportManifest {
  pdfDocument?: PDFDocumentProxy;
  pdfTask?: PDFDocumentLoadingTask;
}
export type GalleryView = "canvas" | "grid";
export type ReaderView = "pages" | "strip" | "read";
export type CoverRect = Pick<DOMRect, "left" | "top" | "width" | "height">;
