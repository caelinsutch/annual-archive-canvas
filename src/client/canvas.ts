import { cx } from "../styles/ui";
import { motion } from "../lib/motion";
import type { Report, ReportPage, CoverRect } from "../lib/types";
type CanvasItem = Report | ReportPage;
interface Card<T> {
  el: HTMLButtonElement;
  item: T;
  hover: number;
  target: number;
  aspect?: number;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null;
}
interface CanvasOptions<T> {
  items?: T[];
  pages?: boolean;
  onSelect: (item: T, origin: CoverRect) => void;
  onZoom?: (zoom: number) => void;
}
import * as THREE from "three";
const mod = (n: number, m: number) => ((n % m) + m) % m;
const cardAspect = (card: { aspect?: number }, item: CanvasItem) =>
  card.aspect || ("height" in item ? item.height / item.width : item.a || 1.3);
export class ArchiveCanvas<T extends CanvasItem = Report> {
  root: HTMLElement;
  items: T[];
  pages: boolean;
  onSelect: CanvasOptions<T>["onSelect"];
  onZoom?: CanvasOptions<T>["onZoom"];
  cards = new Map<string, Card<T>>();
  textures = new Map<string, Promise<THREE.Texture>>();
  disposed = false;
  paused = false;
  x = 0;
  y = 0;
  tx = 0;
  ty = 0;
  defaultZoom = 1;
  zoom = 1;
  tz = 1;
  moved = false;
  reduced = false;
  pointers = new Map<number, { x: number; y: number }>();
  layer: HTMLElement;
  renderer?: THREE.WebGLRenderer;
  scene!: THREE.Scene;
  camera!: THREE.OrthographicCamera;
  geometry?: THREE.PlaneGeometry;
  resize: ResizeObserver;
  abort: AbortController;
  frame = 0;
  w = 0;
  h = 0;
  drag = false;
  down = { x: 0, y: 0, tx: 0, ty: 0 };
  pinchDistance = 0;
  pinchZoom = 1;
  constructor(
    root: HTMLElement,
    { items = [], pages = false, onSelect, onZoom }: CanvasOptions<T>,
  ) {
    this.root = root;
    this.items = items;
    this.pages = pages;
    this.onSelect = onSelect;
    this.onZoom = onZoom;
    this.cards = new Map();
    this.textures = new Map();
    this.disposed = false;
    this.x = 0;
    this.y = pages ? 0 : -60;
    this.tx = 0;
    this.ty = this.pages ? 0 : -60;
    this.defaultZoom = !pages && innerWidth < 700 ? 0.72 : 1;
    this.zoom = this.defaultZoom;
    this.tz = this.defaultZoom;
    this.moved = false;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.pointers = new Map();
    root.innerHTML = `<canvas class="webgl ${cx("webgl")}" aria-hidden="true"></canvas><div class="canvas-cards ${cx("cards")}"></div>`;
    this.layer = root.lastElementChild as HTMLElement;
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: root.firstElementChild as HTMLCanvasElement,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(0, 0, 0, 0, -1000, 1000);
      this.geometry = new THREE.PlaneGeometry(1, 1);
    } catch {
      root.classList.add("no-webgl");
    }
    this.resize = new ResizeObserver(() => {
      this.w = root.clientWidth;
      this.h = root.clientHeight;
      this.renderer?.setSize(this.w, this.h);
      if (this.camera) {
        Object.assign(this.camera, {
          left: -this.w / 2,
          right: this.w / 2,
          top: this.h / 2,
          bottom: -this.h / 2,
        });
        this.camera.updateProjectionMatrix();
      }
    });
    this.resize.observe(root);
    this.abort = new AbortController();
    const signal = this.abort.signal;
    root.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey)
          this.setZoom(
            this.tz * Math.exp(-e.deltaY * 0.007),
            e.clientX,
            e.clientY,
          );
        else {
          this.tx += e.deltaX / this.zoom;
          this.ty += e.deltaY / this.zoom;
        }
      },
      { passive: false, signal },
    );
    root.addEventListener(
      "pointerdown",
      (e) => {
        if (e.button !== 0) return;
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        this.down = { x: e.clientX, y: e.clientY, tx: this.tx, ty: this.ty };
        this.moved = false;
        this.drag = true;
        root.setPointerCapture(e.pointerId);
        root.classList.add("dragging");
        if (this.pointers.size === 2) {
          this.pinchDistance = this.distance();
          this.pinchZoom = this.tz;
        }
      },
      { signal },
    );
    root.addEventListener(
      "pointermove",
      (e) => {
        if (!this.pointers.has(e.pointerId)) return;
        const previous = this.pointers.get(e.pointerId)!;
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this.pointers.size === 2) {
          this.moved = true;
          this.setZoom((this.pinchZoom * this.distance()) / this.pinchDistance);
        } else {
          const dx = e.clientX - previous.x,
            dy = e.clientY - previous.y;
          if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 5)
            this.moved = true;
          this.tx -= dx / this.zoom;
          this.ty -= dy / this.zoom;
        }
      },
      { signal },
    );
    const up = (e: PointerEvent) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.delete(e.pointerId);
      if (!this.moved && e.type !== "pointercancel") {
        const el = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest<HTMLElement>("[data-tile]");
        const card = el && this.cards.get(el.dataset.tile!);
        if (card) this.onSelect(card.item, card.el.getBoundingClientRect());
      }
      if (!this.pointers.size) {
        this.drag = false;
        root.classList.remove("dragging");
      }
    };
    root.addEventListener("pointerup", up, { signal });
    root.addEventListener("pointercancel", up, { signal });
    root.addEventListener(
      "keydown",
      (e) => {
        if (e.target !== root) return;
        const directions: Record<string, [number, number]> = {
          ArrowDown: [0, 180],
          ArrowUp: [0, -180],
          ArrowLeft: [-180, 0],
          ArrowRight: [180, 0],
        };
        if (directions[e.key]) {
          e.preventDefault();
          this.tx += directions[e.key][0];
          this.ty += directions[e.key][1];
        }
      },
      { signal },
    );
    this.tick = this.tick.bind(this);
    this.frame = requestAnimationFrame(this.tick);
  }
  distance() {
    const p = [...this.pointers.values()];
    return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
  }
  setZoom(z: number, clientX?: number, clientY?: number) {
    const next = Math.min(2, Math.max(0.45, z));
    const rect = this.root.getBoundingClientRect();
    const anchorX = clientX == null ? rect.width / 2 : clientX - rect.left;
    const anchorY = clientY == null ? rect.height / 2 : clientY - rect.top;
    this.tx += anchorX / this.tz - anchorX / next;
    this.ty += anchorY / this.tz - anchorY / next;
    this.tz = next;
    this.onZoom?.(this.tz);
  }
  reset() {
    this.setZoom(this.defaultZoom);
    this.tx = 0;
    this.ty = this.pages ? 0 : -60;
  }
  setItems(items: T[]) {
    this.items = items;
    this.clear();
    this.reset();
  }
  clear() {
    for (const c of this.cards.values()) {
      c.el.remove();
      if (c.mesh) {
        this.scene.remove(c.mesh);
        c.mesh.material.dispose();
      }
    }
    this.cards.clear();
  }
  create(key: string, item: T) {
    const el = document.createElement("button");
    el.className = "artifact " + cx("artifact");
    el.dataset.tile = key;
    el.type = "button";
    el.setAttribute(
      "aria-label",
      "label" in item
        ? "Read page " + item.label
        : `Open ${item.o}, ${item.y || "undated"}`,
    );
    const picture = document.createElement("span");
    picture.className = "artifact-paper " + cx("paper");
    const img = document.createElement("img");
    img.className = cx("artifactImage");
    img.alt = "";
    img.draggable = false;
    img.src =
      "thumb" in item
        ? item.thumb
        : "/api/cover?id=" + encodeURIComponent(item.id);
    picture.append(img);
    el.append(picture);
    this.layer.append(el);
    const card: Card<T> = { el, item, hover: 0, target: 0, mesh: null };
    img.addEventListener("load", () => {
      card.aspect = img.naturalHeight / img.naturalWidth;
    });
    if (img.complete && img.naturalWidth)
      card.aspect = img.naturalHeight / img.naturalWidth;
    el.addEventListener("pointerenter", () => (card.target = 1));
    el.addEventListener("pointerleave", () => (card.target = 0));
    el.addEventListener("focus", () => (card.target = 1));
    el.addEventListener("blur", () => (card.target = 0));
    el.addEventListener("click", (e) => {
      if (e.detail === 0) this.onSelect(item, el.getBoundingClientRect());
    });
    if (this.renderer) {
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uTexture: { value: null },
        },
        vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `uniform sampler2D uTexture; varying vec2 vUv; void main(){gl_FragColor=texture2D(uTexture,vUv);}`,
      });
      card.mesh = new THREE.Mesh(this.geometry, material);
      card.mesh.visible = false;
      this.scene.add(card.mesh);
      const url = img.src;
      let promise = this.textures.get(url);
      if (!promise) {
        promise = new THREE.TextureLoader().loadAsync(url);
        this.textures.set(url, promise);
        promise.catch(() => {
          this.textures.delete(url);
        });
      }
      promise
        .then((texture) => {
          if (this.disposed || !el.isConnected) return;
          material.uniforms.uTexture.value = texture;
          card.mesh!.visible = true;
          img.style.opacity = "0";
        })
        .catch(() => {});
    }
    img.onerror = () => {
      picture.classList.add("image-failed");
      picture.textContent = "o" in item ? item.o : "Page scan unavailable";
    };
    this.cards.set(key, card);
    return card;
  }
  tick() {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.tick);
    if (this.paused || document.hidden || !this.root.offsetParent) return;
    if (!this.w || !this.items.length) {
      this.renderer?.clear();
      return;
    }
    const ease = this.reduced ? 1 : motion.cameraEase;
    const vx = this.tx - this.x,
      vy = this.ty - this.y;
    this.x += vx * ease;
    this.y += vy * ease;
    this.zoom += (this.tz - this.zoom) * ease;
    const cellW = this.pages ? 270 : 285,
      cellH = this.pages ? 380 : 345;
    const startC = Math.floor((this.x - 240) / cellW),
      endC = Math.ceil((this.x + this.w / this.zoom + 100) / cellW),
      startR = Math.floor((this.y - 280) / cellH),
      endR = Math.ceil((this.y + this.h / this.zoom + 120) / cellH);
    const visible = new Set();
    for (let row = startR; row <= endR; row++)
      for (let col = startC; col <= endC; col++) {
        if (
          this.pages &&
          (col < 0 || col >= 5 || row < 0 || row * 5 + col >= this.items.length)
        )
          continue;
        const index = this.pages
          ? row * 5 + col
          : mod(row * 17 + col, this.items.length);
        const item = this.items[index];
        const key = row + ":" + col;
        visible.add(key);
        const c = this.cards.get(key) || this.create(key, item);
        const aspect = cardAspect(c, item);
        const maxW = this.pages ? 210 : 202;
        const height = Math.min(this.pages ? 300 : 250, maxW * aspect);
        const width = height / aspect;
        const stagger = 0;
        const cx = (col * cellW + 145 - this.x) * this.zoom,
          cy = (row * cellH + 150 + stagger - this.y) * this.zoom;
        c.hover += (c.target - c.hover) * (this.reduced ? 1 : 0.16);
        const scale = 1;
        const dw = width * this.zoom * scale,
          dh = height * this.zoom * scale;
        c.el.style.visibility = cy + dh / 2 < 0 ? "hidden" : "visible";
        c.el.style.width = dw + "px";
        c.el.style.height = dh + "px";
        c.el.style.transform = `translate3d(${cx - dw / 2}px,${cy - dh / 2}px,0)`;

        if (c.mesh) {
          c.mesh.position.set(cx - this.w / 2, this.h / 2 - cy, c.hover);
          c.mesh.scale.set(dw, dh, 1);
        }
      }
    for (const [key, c] of this.cards)
      if (!visible.has(key)) {
        c.el.remove();
        if (c.mesh) {
          this.scene.remove(c.mesh);
          c.mesh.material.dispose();
        }
        this.cards.delete(key);
      }
    if (this.textures.size > 120) {
      const used = new Set(
        [...this.cards.values()].map((c) => c.el.querySelector("img")?.src),
      );
      for (const [url, promise] of this.textures) {
        if (!used.has(url)) {
          this.textures.delete(url);
          promise.then((t) => t.dispose()).catch(() => {});
          if (this.textures.size <= 90) break;
        }
      }
    }
    this.renderer?.render(this.scene, this.camera);
  }
  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.abort.abort();
    this.resize.disconnect();
    this.clear();
    for (const p of this.textures.values())
      p.then((t) => t.dispose()).catch(() => {});
    this.textures.clear();
    this.geometry?.dispose();
    this.renderer?.dispose();
    this.root.innerHTML = "";
  }
}
