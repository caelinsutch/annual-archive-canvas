import { cx } from "../styles/ui";
import { motion } from "../lib/motion";
import type { Report, ReportPage, CoverRect } from "../lib/types";
type CanvasItem = Report | ReportPage;
interface Card<T> {
  el: HTMLButtonElement;
  item: T;
  loadingTexture?: boolean;
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
  coverLayout: "canvas" | "grid" = "canvas";
  coverCamera = { x: 0, y: -60, zoom: 1 };
  coverPositions = new Map<
    string,
    { x: number; y: number; width: number; height: number }
  >();
  pageLayout: "pages" | "strip" | "read" = "pages";
  selectedPage = 0;
  readBackground = new Map<
    number,
    { x: number; y: number; width: number; height: number }
  >();
  gridCamera = { x: 0, y: 0, zoom: 1 };
  pagePositions = new Map<
    number,
    { x: number; y: number; width: number; height: number }
  >();
  stripCenters: number[] = [];

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
  lastTick = performance.now();
  frameRatio = 1;
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
        else if (this.pages && this.pageLayout === "strip")
          this.tx += (e.deltaX || e.deltaY) / this.zoom;
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
    const now = performance.now();
    this.frameRatio = Math.min(4, (now - this.lastTick) / (1000 / 60));
    this.lastTick = now;
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
    this.coverPositions.clear();
    this.pagePositions.clear();
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
          if (this.disposed || !el.isConnected || img.src !== url) return;
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
    const now = performance.now();
    this.frameRatio = Math.min(4, (now - this.lastTick) / (1000 / 60));
    this.lastTick = now;
    if (this.paused || document.hidden || !this.root.offsetParent) return;
    if (!this.w || !this.items.length) {
      this.renderer?.clear();
      return;
    }
    const ease = this.reduced
      ? 1
      : 1 - Math.pow(1 - motion.cameraEase, this.frameRatio);
    const vx = this.tx - this.x,
      vy = this.ty - this.y;
    this.x += vx * ease;
    this.y += vy * ease;
    this.zoom += (this.tz - this.zoom) * ease;
    if (this.pages) {
      this.tickPages();
      return;
    }
    this.tickCovers();
  }
  setCoverLayout(layout: "canvas" | "grid") {
    if (this.pages || layout === this.coverLayout) return;
    if (layout === "grid")
      this.coverCamera = { x: this.tx, y: this.ty, zoom: this.tz };
    this.coverLayout = layout;
    const target =
      layout === "canvas" ? this.coverCamera : { x: 0, y: 0, zoom: 1 };
    this.x = this.tx = target.x;
    this.y = this.ty = target.y;
    this.zoom = this.tz = target.zoom;
    this.root.dataset.layout = layout;
  }
  tickCovers() {
    type Position = { x: number; y: number; width: number; height: number };
    const targets = new Map<string, { item: T; position: Position }>();
    const positionFor = (
      item: T,
      x: number,
      y: number,
      maxWidth: number,
      maxHeight: number,
      zoom: number,
    ): Position => {
      const key = (item as Report).id;
      const aspect = cardAspect(this.cards.get(key) || {}, item);
      const height = Math.min(maxHeight, maxWidth * aspect) * zoom;
      return { x, y, width: height / aspect, height };
    };
    const columns = Math.max(2, Math.floor(this.w / 250));
    const cellW = this.w / columns;
    if (this.coverLayout === "grid") {
      this.tx = this.x = 0;
      this.tz = this.zoom = 1;
      const maxScroll = Math.max(
        0,
        Math.ceil(this.items.length / columns) * 330 + 180 - this.h,
      );
      this.ty = Math.max(0, Math.min(maxScroll, this.ty));
      for (let i = 0; i < this.items.length; i++) {
        const item = this.items[i],
          key = (item as Report).id;
        targets.set(key, {
          item,
          position: positionFor(
            item,
            ((i % columns) + 0.5) * cellW,
            Math.floor(i / columns) * 330 + 230 - this.y,
            Math.min(202, cellW - 40),
            250,
            1,
          ),
        });
      }
    } else {
      const startC = Math.floor((this.x - 240) / 285),
        endC = Math.ceil((this.x + this.w / this.zoom + 100) / 285);
      const startR = Math.floor((this.y - 280) / 345),
        endR = Math.ceil((this.y + this.h / this.zoom + 120) / 345);
      for (let row = startR; row <= endR; row++)
        for (let col = startC; col <= endC; col++) {
          const item = this.items[mod(row * 17 + col, this.items.length)],
            key = (item as Report).id;
          const position = positionFor(
            item,
            (col * 285 + 145 - this.x) * this.zoom,
            (row * 345 + 150 - this.y) * this.zoom,
            202,
            250,
            this.zoom,
          );
          const old = targets.get(key)?.position;
          if (
            !old ||
            Math.hypot(position.x - this.w / 2, position.y - this.h / 2) <
              Math.hypot(old.x - this.w / 2, old.y - this.h / 2)
          )
            targets.set(key, { item, position });
        }
      // Visited objects outside this viewport travel out of view, without being replaced.
      for (const [key, card] of this.cards)
        if (!targets.has(key)) {
          const current = this.coverPositions.get(key);
          if (current)
            targets.set(key, {
              item: card.item,
              position: {
                ...current,
                y: current.y < this.h / 2 ? -500 : this.h + 500,
              },
            });
        }
    }
    const visibleKeys = new Set<string>();
    const near = (p: Position) =>
      p.x + p.width / 2 > -100 &&
      p.x - p.width / 2 < this.w + 100 &&
      p.y + p.height / 2 > -100 &&
      p.y - p.height / 2 < this.h + 100;
    for (const [key, { item, position: target }] of targets) {
      let card = this.cards.get(key);
      const current = this.coverPositions.get(key) || {
        ...target,
        y: this.coverLayout === "grid" ? this.h + target.height : target.y,
      };
      const ease = this.reduced ? 1 : 1 - Math.pow(0.84, this.frameRatio);
      for (const axis of ["x", "y", "width", "height"] as const)
        current[axis] += (target[axis] - current[axis]) * ease;
      this.coverPositions.set(key, current);
      if (!card && !near(current) && !near(target)) continue;
      card ||= this.create(key, item);
      const visible =
        current.x + current.width / 2 > 0 &&
        current.x - current.width / 2 < this.w &&
        current.y + current.height / 2 > 0 &&
        current.y - current.height / 2 < this.h;
      if (visible) visibleKeys.add(key);
      card.el.style.visibility = visible ? "visible" : "hidden";
      card.el.tabIndex = visible ? 0 : -1;
      card.el.style.width = current.width + "px";
      card.el.style.height = current.height + "px";
      card.el.style.transform = `translate3d(${current.x - current.width / 2}px,${current.y - current.height / 2}px,0)`;
      if (card.mesh) {
        card.mesh.position.set(
          current.x - this.w / 2,
          this.h / 2 - current.y,
          0,
        );
        card.mesh.scale.set(current.width, current.height, 1);
        card.mesh.visible =
          visible && !!card.mesh.material.uniforms.uTexture.value;
        const img = card.el.querySelector("img")!;
        img.style.opacity = card.mesh.material.uniforms.uTexture.value
          ? "0"
          : "1";
        if (
          visible &&
          !card.mesh.material.uniforms.uTexture.value &&
          !card.loadingTexture
        ) {
          card.loadingTexture = true;
          let promise = this.textures.get(img.src);
          if (!promise) {
            promise = new THREE.TextureLoader().loadAsync(img.src);
            this.textures.set(img.src, promise);
          }
          const material = card.mesh.material;
          void promise
            .then((texture) => {
              if (!this.disposed) material.uniforms.uTexture.value = texture;
            })
            .catch(() => this.textures.delete(img.src))
            .finally(() => {
              card!.loadingTexture = false;
            });
        }
      }
    }
    if (this.textures.size > 120) {
      const visibleUrls = new Set(
        [...visibleKeys].map(
          (key) => this.cards.get(key)!.el.querySelector("img")!.src,
        ),
      );
      for (const [url, promise] of this.textures) {
        if (visibleUrls.has(url)) continue;
        this.textures.delete(url);
        for (const card of this.cards.values())
          if (card.el.querySelector("img")!.src === url && card.mesh)
            card.mesh.material.uniforms.uTexture.value = null;
        void promise.then((texture) => texture.dispose()).catch(() => {});
        if (this.textures.size <= 90) break;
      }
    }
    this.renderer?.render(this.scene, this.camera);
  }
  nearestPage() {
    let nearest = this.selectedPage,
      distance = Infinity;
    for (const [index, position] of this.pagePositions) {
      const d = Math.hypot(position.x - this.w / 2, position.y - this.h / 2);
      if (d < distance) {
        nearest = index;
        distance = d;
      }
    }
    return nearest;
  }
  setPageLayout(layout: "pages" | "strip" | "read", selected: number) {
    if (!this.pages) return;
    const previous = this.pageLayout;
    if (previous === "pages" && layout !== "pages")
      this.gridCamera = { x: this.tx, y: this.ty, zoom: this.tz };
    if (layout === "read" && previous !== "read")
      this.readBackground = new Map(
        [...this.pagePositions].map(([index, p]) => [index, { ...p }]),
      );
    this.pageLayout = layout;
    this.selectedPage = selected;
    if (layout === "pages" && previous !== "pages") {
      this.tx = this.gridCamera.x;
      this.ty = this.gridCamera.y;
      this.tz = this.gridCamera.zoom;
      const selectedX = ((selected % 5) * 270 + 145 - this.tx) * this.tz;
      const selectedY =
        (Math.floor(selected / 5) * 380 + 150 - this.ty) * this.tz;
      if (
        previous === "strip" ||
        selectedX < 0 ||
        selectedX > this.w ||
        selectedY < 0 ||
        selectedY > this.h
      ) {
        this.tx = (selected % 5) * 270 + 145 - this.w / (2 * this.tz);
        this.ty = Math.floor(selected / 5) * 380 + 150 - this.h / (2 * this.tz);
      }
    }
    if (layout === "strip") {
      this.tx = this.stripCenters[selected] || 0;
      this.ty = 0;
      this.tz = 1;
    }
    if (layout === "read") {
      this.tx = 0;
      this.ty = 0;
      this.tz = 1;
    }
    if (previous !== layout) {
      this.x = this.tx;
      this.y = this.ty;
      this.zoom = this.tz;
    }
    this.root.classList.toggle("page-focus", layout === "read");
    this.root.dataset.layout = layout;
  }
  async upgradePage(index: number, url: string) {
    const item = this.items[index];
    if (!item) return;
    const key = Math.floor(index / 5) + ":" + (index % 5);
    const card = this.cards.get(key) || this.create(key, item);
    const img = card.el.querySelector("img")!;
    if (img.src === url) return;
    const full = new Image();
    full.src = url;
    await full.decode();
    if (this.disposed || !card.el.isConnected) return;
    img.src = url;
    if (card.mesh) {
      let texture = this.textures.get(url);
      if (!texture) {
        texture = new THREE.TextureLoader().loadAsync(url);
        this.textures.set(url, texture);
      }
      const value = await texture;
      if (!this.disposed) card.mesh.material.uniforms.uTexture.value = value;
    }
  }
  tickPages() {
    const stripHeight = Math.min(this.h - 140, 620);
    let cursor = 0;
    this.stripCenters = this.items.map((item) => {
      const aspect = "height" in item ? item.height / item.width : 1.3;
      const width = stripHeight / aspect;
      const center = cursor + width / 2;
      cursor += width + 56;
      return center;
    });
    for (let index = 0; index < this.items.length; index++) {
      const item = this.items[index];
      const key = Math.floor(index / 5) + ":" + (index % 5);
      let card = this.cards.get(key);
      const aspect = card
        ? cardAspect(card, item)
        : "height" in item
          ? item.height / item.width
          : 1.3;
      let height = Math.min(300, 210 * aspect),
        width = height / aspect;
      let x = ((index % 5) * 270 + 145 - this.x) * this.zoom,
        y = (Math.floor(index / 5) * 380 + 150 - this.y) * this.zoom;
      width *= this.zoom;
      height *= this.zoom;
      if (this.pageLayout === "strip") {
        height = stripHeight * this.zoom;
        width = height / aspect;
        x = (this.stripCenters[index] - this.x) * this.zoom + this.w / 2;
        y = this.h / 2 - 25;
      }
      if (this.pageLayout === "read") {
        if (index === this.selectedPage) {
          height = Math.min(this.h - 130, (this.w - 64) * aspect) * this.zoom;
          width = height / aspect;
          x = this.w / 2 - this.x;
          y = (this.h - 50) / 2 - this.y;
        } else {
          const background = this.readBackground.get(index);
          if (background) {
            ({ x, y, width, height } = background);
          } else {
            x = -1000;
            y = -1000;
          }
        }
      }
      const onScreen =
        x + width / 2 > -300 &&
        x - width / 2 < this.w + 300 &&
        y + height / 2 > -300 &&
        y - height / 2 < this.h + 300;
      const current = this.pagePositions.get(index) || { x, y, width, height };
      const ease = this.reduced ? 1 : 1 - Math.pow(0.84, this.frameRatio);
      current.x += (x - current.x) * ease;
      current.y += (y - current.y) * ease;
      current.width += (width - current.width) * ease;
      current.height += (height - current.height) * ease;
      this.pagePositions.set(index, current);
      const visible =
        current.x + current.width / 2 > 0 &&
        current.x - current.width / 2 < this.w &&
        current.y + current.height / 2 > 0 &&
        current.y - current.height / 2 < this.h;
      if (!card && !onScreen && !visible && index !== this.selectedPage)
        continue;
      if (!card) card = this.create(key, item);
      const focused = this.pageLayout === "read" && index === this.selectedPage;
      card.el.classList.toggle("focused-page", focused);
      card.el.tabIndex =
        visible && (this.pageLayout !== "read" || focused) ? 0 : -1;
      card.el.style.visibility = visible ? "visible" : "hidden";
      card.el.style.width = current.width + "px";
      card.el.style.height = current.height + "px";
      card.el.style.transform = `translate3d(${current.x - current.width / 2}px,${current.y - current.height / 2}px,0)`;
      const img = card.el.querySelector<HTMLImageElement>("img");
      if (img)
        img.style.opacity =
          focused || !card.mesh?.material.uniforms.uTexture.value ? "1" : "0";
      if (card.mesh) {
        card.mesh.position.set(
          current.x - this.w / 2,
          this.h / 2 - current.y,
          0,
        );
        card.mesh.scale.set(current.width, current.height, 1);
        card.mesh.visible =
          visible && !focused && !!card.mesh.material.uniforms.uTexture.value;
      }
    }
    this.renderer?.render(this.scene, this.camera);
  }
  concealForExit(element: HTMLElement) {
    this.paused = true;
    const card = [...this.cards.values()].find((card) => card.el === element);
    if (card) {
      card.el.style.visibility = "hidden";
      if (card.mesh) card.mesh.visible = false;
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
