/* ===== TSUKIBOYS — macOS desktop clone ===== */
(() => {
  "use strict";

  const R2_BASE = "https://pub-27918abc0811493eacde574582dde648.r2.dev";
  const stage = document.getElementById("stage");
  const windowsLayer = document.getElementById("windows");
  const dockEl = document.getElementById("dock");
  const dropdown = document.getElementById("menu-dropdown");

  /* ---------- UI click sound ---------- */
  const _clickAudio = new Audio("assets/universfield-computer-mouse-click-02-383961.mp3");
  function playClick() {
    try {
      _clickAudio.currentTime = 0;
      _clickAudio.play();
    } catch {}
  }

  // Stage fills the viewport 1:1 — no scaling, no distortion. Coordinates are
  // plain viewport pixels. Helpers to center windows in the current viewport.
  const cx = (w) => Math.max(20, Math.round((window.innerWidth - w) / 2));
  const cy = (h) => Math.max(48, Math.round((window.innerHeight - h) / 2));

  function toStage(clientX, clientY) {
    const r = stage.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }

  /* ---------- Clock ---------- */
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function updateClock() {
    const d = new Date();
    let h = d.getHours();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    const m = String(d.getMinutes()).padStart(2, "0");
    document.getElementById("mb-date").textContent =
      `${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`;
    document.getElementById("mb-clock").textContent = `${h}:${m} ${ampm}`;
  }
  updateClock();
  setInterval(updateClock, 1000);

  /* ---------- Window manager ---------- */
  let zTop = 500;
  let winCounter = 0;
  const wins = {}; // id -> { el, appKey, minimized, prevRect }

  function focusWindow(id) {
    const w = wins[id];
    if (!w) return;
    w.el.style.zIndex = ++zTop;
    Object.values(wins).forEach((o) => {
      o.el.classList.toggle("blurred", o !== w);
    });
    updateDockDots();
  }

  // Decorative toolbar glyphs (no dedicated asset files — drawn inline so the
  // Finder-style chrome doesn't depend on new image assets).
  const TRAFFIC_HTML = `
    <div class="traffic">
      <img class="tl-close" src="assets/tl-close.svg" alt="close" />
      <img class="tl-min" src="assets/tl-min.svg" alt="minimize" />
      <img class="tl-max" src="assets/tl-expand.svg" alt="maximize" />
    </div>`;
  const TB_ICONS = {
    chevronLeft: `<svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    chevronRight: `<svg viewBox="0 0 24 24"><path d="M9 4l8 8-8 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    grid: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1.5" fill="currentColor"/><rect x="13" y="3" width="8" height="8" rx="1.5" fill="currentColor"/><rect x="3" y="13" width="8" height="8" rx="1.5" fill="currentColor"/><rect x="13" y="13" width="8" height="8" rx="1.5" fill="currentColor"/></svg>`,
    list: `<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="2.6" rx="1.3" fill="currentColor"/><rect x="3" y="11" width="18" height="2.6" rx="1.3" fill="currentColor"/><rect x="3" y="17" width="18" height="2.6" rx="1.3" fill="currentColor"/></svg>`,
    share: `<svg viewBox="0 0 24 24"><path d="M12 3v12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M7 8l5-5 5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    tag: `<svg viewBox="0 0 24 24"><path d="M11 3H5a2 2 0 0 0-2 2v6l10 10 8-8L11 3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/></svg>`,
    more: `<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>`,
  };

  function finderTitlebarHTML(title) {
    return `
      <div class="titlebar tb-finder">
        ${TRAFFIC_HTML}
        <div class="tb-nav">
          <button class="tb-btn" type="button">${TB_ICONS.chevronLeft}</button>
          <button class="tb-btn" type="button" disabled>${TB_ICONS.chevronRight}</button>
        </div>
        <div class="win-title">${title}</div>
        <div class="tb-icons">
          <button class="tb-btn" type="button">${TB_ICONS.grid}</button>
          <button class="tb-btn" type="button">${TB_ICONS.list}</button>
          <span class="tb-sep"></span>
          <button class="tb-btn" type="button">${TB_ICONS.share}</button>
          <button class="tb-btn" type="button">${TB_ICONS.tag}</button>
          <button class="tb-btn" type="button">${TB_ICONS.more}</button>
          <button class="tb-btn tb-search" type="button"><img src="assets/magnifyingglass.svg" alt="" /></button>
        </div>
      </div>
      <div class="pathbar">
        <span class="pathbar-label">${title}</span>
        <button class="pathbar-add" type="button">+</button>
      </div>`;
  }

  function plainTitlebarHTML(title) {
    return `
      <div class="titlebar">
        ${TRAFFIC_HTML}
        <div class="win-title">${title}</div>
      </div>`;
  }

  function createWindow({ id, title, x, y, w, h, bodyHTML, appKey, bodyClass, chrome }) {
    if (wins[id]) {
      // Already open: un-minimize + focus
      const ex = wins[id];
      ex.el.style.display = "flex";
      ex.minimized = false;
      focusWindow(id);
      return ex.el;
    }
    const el = document.createElement("div");
    el.id = id;
    el.className = "window opening";
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.width = w + "px";
    el.style.height = h + "px";
    el.style.zIndex = ++zTop;
    el.innerHTML = `
      ${chrome === "finder" ? finderTitlebarHTML(title) : plainTitlebarHTML(title)}
      <div class="win-body ${bodyClass || ""}">${bodyHTML}</div>
      <div class="rz rz-n"></div><div class="rz rz-s"></div>
      <div class="rz rz-e"></div><div class="rz rz-w"></div>
      <div class="rz rz-ne"></div><div class="rz rz-nw"></div>
      <div class="rz rz-se"></div><div class="rz rz-sw"></div>
    `;
    windowsLayer.appendChild(el);
    wins[id] = { el, appKey, minimized: false, prevRect: null };
    el.addEventListener("animationend", () => el.classList.remove("opening"), { once: true });

    // Focus on any interaction
    el.addEventListener("mousedown", () => focusWindow(id));

    // Traffic lights
    el.querySelector(".tl-close").addEventListener("click", (e) => {
      e.stopPropagation();
      closeWindow(id);
    });
    el.querySelector(".tl-min").addEventListener("click", (e) => {
      e.stopPropagation();
      minimizeWindow(id);
    });
    el.querySelector(".tl-max").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMaximize(id);
    });

    makeDraggable(el, id);
    makeResizable(el, id);
    focusWindow(id);
    return el;
  }

  function closeWindow(id) {
    const w = wins[id];
    if (!w) return;
    const a = w.el.querySelector("audio");
    if (a) { a.pause(); a.src = ""; }
    w.el.remove();
    delete wins[id];
    updateDockDots();
  }

  function minimizeWindow(id) {
    const w = wins[id];
    if (!w || w.minimized) return;
    const el = w.el;
    const wr = el.getBoundingClientRect();
    // Target: matching dock icon (fall back to dock center)
    const dockItem = dockEl.querySelector(`[data-key="${w.appKey}"]`) ||
      dockEl.querySelector(".dock-item");
    const dr = dockItem.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    const tx = dr.left + dr.width / 2 - (wr.left + wr.width / 2);
    const ty = dr.top + dr.height / 2 - (wr.top + wr.height / 2);
    el.classList.add("minimizing");
    el.style.transform = `translate(${tx}px, ${ty}px) scale(0.05)`;
    w.minimized = true;
    setTimeout(() => {
      el.style.display = "none";
      el.classList.remove("minimizing");
      el.style.transform = "";
    }, 420);
    updateDockDots();
  }

  function toggleMaximize(id) {
    const w = wins[id];
    if (!w) return;
    const el = w.el;
    if (w.prevRect) {
      Object.assign(el.style, w.prevRect);
      w.prevRect = null;
    } else {
      w.prevRect = {
        left: el.style.left, top: el.style.top,
        width: el.style.width, height: el.style.height,
      };
      Object.assign(el.style, {
        left: "0px", top: "32px",
        width: window.innerWidth + "px",
        height: window.innerHeight - 32 + "px",
      });
    }
  }

  function makeDraggable(el, id) {
    const bar = el.querySelector(".titlebar");
    bar.addEventListener("mousedown", (e) => {
      if (e.target.closest(".traffic")) return;
      e.preventDefault();
      const w = wins[id];
      if (w.prevRect) return; // don't drag maximized
      const start = toStage(e.clientX, e.clientY);
      const ox = parseFloat(el.style.left);
      const oy = parseFloat(el.style.top);
      function move(ev) {
        const p = toStage(ev.clientX, ev.clientY);
        let nx = ox + (p.x - start.x);
        let ny = oy + (p.y - start.y);
        ny = Math.max(32, ny); // keep title below menu bar
        el.style.left = nx + "px";
        el.style.top = ny + "px";
      }
      function up() {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
      }
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });
  }

  function makeResizable(el, id) {
    const MIN_W = 380, MIN_H = 260;
    el.querySelectorAll(".rz").forEach((handle) => {
      const dir = handle.className.split(" ")[1].replace("rz-", "");
      handle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        wins[id].prevRect = null;
        const start = toStage(e.clientX, e.clientY);
        const o = {
          x: parseFloat(el.style.left), y: parseFloat(el.style.top),
          w: parseFloat(el.style.width), h: parseFloat(el.style.height),
        };
        function move(ev) {
          const p = toStage(ev.clientX, ev.clientY);
          const dx = p.x - start.x, dy = p.y - start.y;
          let { x, y, w, h } = o;
          if (dir.includes("e")) w = Math.max(MIN_W, o.w + dx);
          if (dir.includes("s")) h = Math.max(MIN_H, o.h + dy);
          if (dir.includes("w")) {
            w = Math.max(MIN_W, o.w - dx);
            x = o.x + (o.w - w);
          }
          if (dir.includes("n")) {
            h = Math.max(MIN_H, o.h - dy);
            y = o.y + (o.h - h);
            if (y < 32) { h += 32 - y; y = 32; }
          }
          el.style.left = x + "px"; el.style.top = y + "px";
          el.style.width = w + "px"; el.style.height = h + "px";
        }
        function up() {
          document.removeEventListener("mousemove", move);
          document.removeEventListener("mouseup", up);
        }
        document.addEventListener("mousemove", move);
        document.addEventListener("mouseup", up);
      });
    });
  }

  /* ---------- Folder / Finder ---------- */
  const _finderHistory = new Map();

  // Real audio files hosted on Cloudflare R2 (name shown = file name).
  const MUSIC_SONGS = [
    "ALGO + PA TI_MASTER_MP31.mp3",
    "GIRASOLES_LUXXO_MP31.mp3",
    "PALOMA MAMI_MASTER_MP31.mp3",
    "RAINAO_MASTER_MP31.mp3",
    "RITUAL_MASTER_MP31.mp3",
  ].map((f) => ({ name: f, file: R2_BASE + "/songs/" + f }));

  const KITS_FILES = [
    { name: "RAMOS DRUMKIT.zip", file: R2_BASE + "/kits/RAMOS DRUMKIT.zip" },
    { name: "@AZTEK.ALS_DRUMKIT_SUNFLOWER_2.zip", file: R2_BASE + "/kits/@AZTEK.ALS_DRUMKIT_SUNFLOWER_2.zip" },
  ];

  const FOLDERS = {
    tsukiboys: { label: "Tsukiboys", files: [] },
    eventos: { label: "Eventos", files: [] },
    music: { label: "Music", files: MUSIC_SONGS },
    kits: { label: "KITS GANG", files: KITS_FILES },
  };

  const esc = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  function fileGridHTML(files) {
    if (!files.length) {
      return `<div class="app-body"><p>Carpeta vacía</p>
        <div class="placeholder-tag">Contenido próximamente</div></div>`;
    }
    return `<div class="file-grid">` + files.map((f, i) => {
      const isZip = /\.zip$/i.test(f.file);
      const icon = isZip ? "assets/zip-icon.png" : "assets/wav-icon.png";
      return `<div class="file-item${isZip ? " file-zip" : ""}" data-idx="${i}" title="${esc(f.name)}">
        <div class="ficon"><img src="${icon}" alt="" /></div>
        <span>${esc(f.name)}</span>
      </div>`;
    }).join("") + `</div>`;
  }

  function fileListHTML(files) {
    if (!files.length) {
      return `<div class="app-body"><p>Carpeta vacía</p>
        <div class="placeholder-tag">Contenido próximamente</div></div>`;
    }
    const kindLabel = (f) => {
      const ext = f.file.split(".").pop().toLowerCase();
      if (ext === "zip") return "ZIP Archive";
      if (ext === "mp3") return "Audio MP3";
      return "Audio WAV";
    };
    const fileIcon = (f) => /\.zip$/i.test(f.file) ? "assets/zip-icon.png" : "assets/wav-icon.png";
    return `
      <div class="file-list">
        <div class="fl-header">
          <div class="fl-col fl-col-name">Name</div>
          <div class="fl-col fl-col-kind">Kind</div>
        </div>
        ${files.map((f, i) => `
          <div class="file-item file-list-row" data-idx="${i}">
            <div class="fl-col fl-col-name">
              <img class="fl-icon" src="${fileIcon(f)}" alt="" />
              <span>${esc(f.name)}</span>
            </div>
            <div class="fl-col fl-col-kind">${kindLabel(f)}</div>
          </div>`).join("")}
      </div>`;
  }

  // Decorative sidebar glyphs for the non-functional Finder favorites (Recientes,
  // Aplicaciones, etc.) — mirrors the reference screenshot; only the folder
  // entries below are wired to actually do anything.
  const SB_ICONS = {
    recent: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3.5 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    apps: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.6" fill="currentColor"/><rect x="14" y="3" width="7" height="7" rx="1.6" fill="currentColor"/><rect x="3" y="14" width="7" height="7" rx="1.6" fill="currentColor"/><rect x="14" y="14" width="7" height="7" rx="1.6" fill="currentColor"/></svg>`,
    desktop: `<svg viewBox="0 0 24 24"><rect x="2.5" y="4" width="19" height="12" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9 20h6M12 16v4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    docs: `<svg viewBox="0 0 24 24"><path d="M6 2.5h8l4 4v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-18a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M14 2.5v4h4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
    downloads: `<svg viewBox="0 0 24 24"><path d="M12 3v12M7 11l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 19h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    cloud: `<svg viewBox="0 0 24 24"><path d="M7 18a4.5 4.5 0 0 1-.6-8.96 5.5 5.5 0 0 1 10.7-1.6A4 4 0 0 1 17 18H7z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
    shared: `<svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="17" cy="9" r="2.6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3 20c0-3 2.2-5 5-5s5 2 5 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M14.5 15.2c2.2.3 3.5 2 3.5 4.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  };
  const sbStatic = (icon, label) =>
    `<div class="sb-item sb-static"><span class="sb-icon">${icon}</span>${label}</div>`;

  function sidebarHTML(activeKey) {
    const folderItems = Object.entries(FOLDERS).map(([k, v]) =>
      `<div class="sb-item ${k === activeKey ? "active" : ""}" data-folder="${k}">
        <img src="assets/sidebar-folder.svg" alt="" />${v.label}</div>`).join("");
    return `
      <div class="sb-head">Favoritos</div>
      ${sbStatic(SB_ICONS.recent, "Recientes")}
      ${folderItems}
      ${sbStatic(SB_ICONS.apps, "Aplicaciones")}
      ${sbStatic(SB_ICONS.desktop, "Escritorio")}
      ${sbStatic(SB_ICONS.docs, "Documentos")}
      ${sbStatic(SB_ICONS.downloads, "Descargas")}
      <div class="sb-head">iCloud</div>
      ${sbStatic(SB_ICONS.cloud, "iCloud Drive")}
      ${sbStatic(SB_ICONS.shared, "Compartido")}
      <div class="sb-head">Etiquetas</div>`;
  }

  function finderBodyHTML(activeKey, view) {
    const files = FOLDERS[activeKey].files;
    const contentHTML = view === "list" ? fileListHTML(files) : fileGridHTML(files);
    return `
      <div class="sidebar">${sidebarHTML(activeKey)}</div>
      <div class="win-content">${contentHTML}</div>`;
  }

  function openFinder(folderKey = "music") {
    const id = "finder-" + (++winCounter);
    const view = "grid";
    const el = createWindow({
      id, appKey: "finder", chrome: "finder",
      title: FOLDERS[folderKey].label,
      x: cx(798) + Object.keys(wins).length * 24, y: 180 + Object.keys(wins).length * 24, w: 798, h: 551,
      bodyHTML: finderBodyHTML(folderKey, view),
    });
    el.dataset.folder = folderKey;
    el.dataset.view = view;
    _finderHistory.set(el.id, { stack: [folderKey], idx: 0 });
    wireFinder(el);
    updateViewButtons(el);
    updateNavButtons(el);
    return el;
  }

  function navigateToFolder(el, folderKey, push) {
    const hist = _finderHistory.get(el.id);
    if (push) {
      hist.stack = hist.stack.slice(0, hist.idx + 1);
      hist.stack.push(folderKey);
      hist.idx = hist.stack.length - 1;
    }
    el.dataset.folder = folderKey;
    el.querySelector(".win-title").textContent = FOLDERS[folderKey].label;
    el.querySelector(".pathbar-label").textContent = FOLDERS[folderKey].label;
    el.querySelector(".win-body").innerHTML = finderBodyHTML(folderKey, el.dataset.view);
    wireFinder(el);
    updateNavButtons(el);
  }

  function setFinderFolder(el, folderKey) {
    navigateToFolder(el, folderKey, true);
  }

  function navigateBack(el) {
    const hist = _finderHistory.get(el.id);
    if (hist.idx <= 0) return;
    hist.idx--;
    navigateToFolder(el, hist.stack[hist.idx], false);
  }

  function navigateForward(el) {
    const hist = _finderHistory.get(el.id);
    if (hist.idx >= hist.stack.length - 1) return;
    hist.idx++;
    navigateToFolder(el, hist.stack[hist.idx], false);
  }

  function updateNavButtons(el) {
    const hist = _finderHistory.get(el.id);
    if (!hist) return;
    const navBtns = el.querySelectorAll(".tb-nav .tb-btn");
    if (navBtns.length < 2) return;
    navBtns[0].disabled = hist.idx <= 0;
    navBtns[1].disabled = hist.idx >= hist.stack.length - 1;
  }

  function downloadFile(filePath) {
    const a = document.createElement("a");
    a.href = encodeURI(filePath);
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function wireFinder(el) {
    const files = FOLDERS[el.dataset.folder].files;
    el.querySelectorAll(".sb-item[data-folder]").forEach((it) => {
      it.onclick = () => setFinderFolder(el, it.dataset.folder);
    });
    el.querySelectorAll(".file-item").forEach((it) => {
      const file = files[it.dataset.idx];
      const isZip = /\.zip$/i.test(file.file);
      it.onclick = (e) => {
        e.stopPropagation();
        document.querySelectorAll(".desk-icon.selected").forEach((o) => o.classList.remove("selected"));
        document.querySelectorAll(".file-item.selected").forEach((o) => o.classList.remove("selected"));
        it.classList.add("selected");
        if (!isZip) quickLook = { kind: "song", song: file };
      };
      it.ondblclick = () => {
        playClick();
        if (isZip) downloadFile(file.file);
        else openPlayer(file);
      };
    });
    wireViewButtons(el);
    wireNavButtons(el);
  }

  function wireViewButtons(el) {
    const btns = el.querySelectorAll(".tb-icons .tb-btn");
    if (btns.length < 2) return;
    const gridBtn = btns[0];
    const listBtn = btns[1];
    gridBtn.onclick = () => setFinderView(el, "grid");
    listBtn.onclick = () => setFinderView(el, "list");
  }

  function wireNavButtons(el) {
    const navBtns = el.querySelectorAll(".tb-nav .tb-btn");
    if (navBtns.length < 2) return;
    navBtns[0].onclick = () => navigateBack(el);
    navBtns[1].onclick = () => navigateForward(el);
  }

  function setFinderView(el, view) {
    if (el.dataset.view === view) return;
    el.dataset.view = view;
    el.querySelector(".win-body").innerHTML = finderBodyHTML(el.dataset.folder, view);
    wireFinder(el);
    updateViewButtons(el);
  }

  function updateViewButtons(el) {
    const btns = el.querySelectorAll(".tb-icons .tb-btn");
    if (btns.length < 2) return;
    btns[0].classList.toggle("tb-active", el.dataset.view === "grid");
    btns[1].classList.toggle("tb-active", el.dataset.view === "list");
  }

  /* ---------- Quick Look audio player ---------- */
  let playerCount = 0;
  const fmtTime = (s) => {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  function openPlayer(song) {
    const id = "player:" + song.file;
    if (wins[id]) { focusWindow(id); return; }
    Object.keys(wins).filter((k) => k.startsWith("player:")).forEach((k) => closeWindow(k));
    ++playerCount;
    const src = encodeURI(song.file);
    const el = createWindow({
      id, appKey: "music", title: song.name,
      x: cx(560) + playerCount * 26, y: cy(300) + playerCount * 26, w: 560, h: 300,
      bodyHTML: `
        <div class="ql">
          <div class="ql-body">
            <div class="ql-art"><img src="assets/wav-icon.png" alt="" /></div>
            <div class="ql-meta">Duración: <b class="ql-dur">--:--</b></div>
          </div>
          <div class="ql-controls">
            <button class="ql-btn ql-back" title="-15s">
              <img class="ql-icon" src="assets/15.arrow.trianglehead.counterclockwise.svg" alt="" /></button>
            <button class="ql-btn ql-play" title="Play/Pause"><img class="ql-icon ql-icon-play" src="assets/play.fill.svg" alt="" /></button>
            <button class="ql-btn ql-fwd" title="+15s">
              <img class="ql-icon" src="assets/15.arrow.trianglehead.clockwise.svg" alt="" /></button>
            <span class="ql-cur">0:00</span>
            <input type="range" class="ql-seek" min="0" max="1000" value="0" />
            <span class="ql-tot">0:00</span>
            <span class="ql-vol-wrap">
              <span class="ql-vol"><img class="ql-icon" src="assets/speaker.wave.2.fill.svg" alt="" /></span>
              <input type="range" class="ql-vol-slider" min="0" max="100" value="70" />
            </span>
          </div>
          <audio class="ql-audio" src="${src}" preload="metadata"></audio>
        </div>`,
    });

    const audio = el.querySelector(".ql-audio");
    const playBtn = el.querySelector(".ql-play");
    const seek = el.querySelector(".ql-seek");
    const durEl = el.querySelector(".ql-dur");
    const curEl = el.querySelector(".ql-cur");
    const totEl = el.querySelector(".ql-tot");
    let scrubbing = false;

    audio.addEventListener("loadedmetadata", () => {
      durEl.textContent = fmtTime(audio.duration);
      totEl.textContent = fmtTime(audio.duration);
    });
    audio.addEventListener("timeupdate", () => {
      if (scrubbing) return;
      curEl.textContent = fmtTime(audio.currentTime);
      if (audio.duration) seek.value = (audio.currentTime / audio.duration) * 1000;
      updateNpSeek();
    });
    audio.addEventListener("ended", () => {
      playBtn.querySelector(".ql-icon-play").src = "assets/play.fill.svg";
      hideNowPlaying();
    });

    playBtn.addEventListener("click", () => {
      const icon = playBtn.querySelector(".ql-icon-play");
      if (audio.paused) { audio.play(); icon.src = "assets/pause.fill.svg"; showNowPlaying(audio, song.name); }
      else { audio.pause(); icon.src = "assets/play.fill.svg"; }
      syncNpPauseIcon();
    });
    el.querySelector(".ql-back").addEventListener("click", () => {
      audio.currentTime = Math.max(0, audio.currentTime - 15);
    });
    el.querySelector(".ql-fwd").addEventListener("click", () => {
      audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 15);
    });
    seek.addEventListener("input", () => {
      scrubbing = true;
      if (audio.duration) curEl.textContent = fmtTime((seek.value / 1000) * audio.duration);
    });
    seek.addEventListener("change", () => {
      if (audio.duration) audio.currentTime = (seek.value / 1000) * audio.duration;
      scrubbing = false;
    });
    const volSlider = el.querySelector(".ql-vol-slider");
    const volIcon = el.querySelector(".ql-vol img");
    const SPEAKER_ICONS = [
      { max: 0, src: "assets/speaker.slash.fill.svg" },
      { max: 33, src: "assets/speaker.fill.svg" },
      { max: 66, src: "assets/speaker.wave.1.fill.svg" },
      { max: 100, src: "assets/speaker.wave.3.fill.svg" },
    ];
    function updateSpeakerIcon(v) {
      const icon = SPEAKER_ICONS.find((s) => v <= s.max) || SPEAKER_ICONS[SPEAKER_ICONS.length - 1];
      volIcon.src = icon.src;
    }
    audio.volume = volSlider.value / 100;
    volSlider.addEventListener("input", () => {
      audio.volume = volSlider.value / 100;
      audio.muted = false;
      updateSpeakerIcon(Number(volSlider.value));
    });
    let savedVol = Number(volSlider.value);
    el.querySelector(".ql-vol").addEventListener("click", () => {
      audio.muted = !audio.muted;
      if (audio.muted) {
        savedVol = Number(volSlider.value);
        volSlider.value = 0;
        volIcon.src = "assets/speaker.slash.fill.svg";
      } else {
        volSlider.value = savedVol;
        audio.volume = savedVol / 100;
        updateSpeakerIcon(savedVol);
      }
    });

    // Stop playback when the window closes.
    el.querySelector(".tl-close").addEventListener("click", () => {
      audio.pause();
      audio.src = "";
      hideNowPlaying();
    });

    // Autoplay on open (like pressing Space / double-click in macOS Quick Look).
    audio.play().then(() => {
      playBtn.querySelector(".ql-icon-play").src = "assets/pause.fill.svg";
      showNowPlaying(audio, song.name);
    }).catch(() => {});
  }

  /* ---------- Now Playing (menu bar) ---------- */
  const npIcon = document.getElementById("now-playing");
  const npPopup = document.getElementById("now-popup");
  const npSong = npPopup.querySelector(".np-song");
  const npPauseBtn = npPopup.querySelector(".np-pause");
  const npForwardBtn = npPopup.querySelector(".np-forward");
  const npSeek = npPopup.querySelector(".np-seek");
  let _npAudio = null;
  let _npSongName = "";
  let _npScrubbing = false;

  function showNowPlaying(audio, songName) {
    _npAudio = audio;
    _npSongName = songName;
    npIcon.classList.remove("hidden");
    npSong.textContent = songName;
  }

  function hideNowPlaying() {
    _npAudio = null;
    npIcon.classList.add("hidden");
    npPopup.classList.add("hidden");
  }

  function syncNpPauseIcon() {
    if (!_npAudio) return;
    const icon = npPauseBtn.querySelector("img");
    icon.src = _npAudio.paused ? "assets/play.fill.svg" : "assets/pause.fill.svg";
  }

  function updateNpSeek() {
    if (!_npAudio || _npScrubbing) return;
    if (_npAudio.duration) npSeek.value = (_npAudio.currentTime / _npAudio.duration) * 1000;
  }

  npIcon.addEventListener("click", (e) => {
    e.stopPropagation();
    npPopup.classList.toggle("hidden");
    if (!npPopup.classList.contains("hidden")) {
      npSong.textContent = _npSongName;
      syncNpPauseIcon();
      if (_npAudio && _npAudio.duration) npSeek.value = (_npAudio.currentTime / _npAudio.duration) * 1000;
    }
  });

  npPauseBtn.addEventListener("click", () => {
    if (!_npAudio) return;
    if (_npAudio.paused) _npAudio.play();
    else _npAudio.pause();
    syncNpPauseIcon();
  });

  npForwardBtn.addEventListener("click", () => {
    if (!_npAudio) return;
    _npAudio.currentTime = Math.min(_npAudio.duration || 0, _npAudio.currentTime + 15);
  });

  npSeek.addEventListener("input", () => {
    _npScrubbing = true;
  });

  npSeek.addEventListener("change", () => {
    if (_npAudio && _npAudio.duration) _npAudio.currentTime = (npSeek.value / 1000) * _npAudio.duration;
    _npScrubbing = false;
  });

  document.addEventListener("click", (e) => {
    if (!npPopup.contains(e.target) && !npIcon.contains(e.target)) {
      npPopup.classList.add("hidden");
    }
  });

  /* ---------- Generic app windows ---------- */
  const APP_META = {
    mail:    { name: "Mail",    icon: "mail.png",    desc: "Bandeja de entrada de TSUKIBOYS." },
    discord: { name: "Discord", icon: "discord.png", desc: "Únete al servidor de la comunidad.<br><a href='https://discord.gg/P4DCdGCcVt' target='_blank' style='color:#3b6ff5'>https://discord.gg/P4DCdGCcVt</a>" },
    ableton: { name: "Ableton Live", icon: "ableton.png", desc: "Sesiones y proyectos de producción." },
    notes:   { name: "Notes",   icon: "notes.png",   desc: "Notas y letras." },
    spotify: { name: "Spotify", icon: "spotify.png", desc: "Escucha nuestras producciones.<br><a href='https://sptfy.com/QhZS~s' target='_blank' style='color:#3b6ff5'>https://sptfy.com/QhZS~s</a>" },
    trash:   { name: "Trash",   icon: "trash.png",   desc: "La papelera está vacía." },
  };

  function openApp(key) {
    if (key === "finder") return openFinder();
    if (key === "trash") return openTrash();
    const m = APP_META[key];
    if (!m) return;
    const id = "app-" + key + "-" + (++winCounter);
    createWindow({
      id, appKey: key, title: m.name,
      x: cx(560) + Object.keys(wins).length * 24,
      y: cy(420) + Object.keys(wins).length * 24,
      w: 560, h: 420,
      bodyHTML: `
        <div class="app-body">
          <img class="app-hero" src="assets/${m.icon}" alt="" />
          <h2>${m.name}</h2>
          <p>${m.desc}</p>
          <div class="placeholder-tag">TSUKIBOYS®2026 ALL RIGHTS RESERVED</div>
        </div>`,
    });
  }

  const LOCK_FILES = [
    "REMIX PALOMA MAMI_CHRIS REDD x MIKE CASTILLO.mp3",
  ].map((f) => ({ name: f, file: "lock/" + f }));

  function openTrash() {
    const trashId = "trash-" + (++winCounter);
    const trashBody = `
      <div class="sidebar">
        <div class="sb-head">Favoritos</div>
        <div class="sb-item active">
          <img src="assets/sidebar-folder.svg" alt="" />Trash</div>
      </div>
      <div class="win-content trash-locked">${fileGridHTML(LOCK_FILES)}</div>`;
    const trashEl = createWindow({
      id: trashId, appKey: "trash", chrome: "finder", title: "Trash",
      x: cx(798), y: 180, w: 798, h: 551,
      bodyHTML: trashBody,
    });
    trashEl.dataset.locked = "true";
    trashEl.querySelector(".win-body").classList.add("blurred-content");
    promptTrashAuth(trashEl);
  }

  // Re-summonable: the auth window is a separate appKey from the trash
  // window itself, so closing the prompt without unlocking doesn't strand
  // the trash content locked forever — the dock re-opens this on next click.
  function promptTrashAuth(trashEl) {
    const authId = "trash-auth-" + (++winCounter);
    const authBody = `
      <div class="auth-box">
        <img src="assets/trash.png" alt="" class="auth-icon" />
        <p class="auth-msg">Ingresa la contraseña para acceder a la Papelera</p>
        <input type="password" class="auth-input" placeholder="Contraseña" />
        <div class="auth-error hidden">Contraseña incorrecta</div>
        <button class="auth-btn">Desbloquear</button>
      </div>`;
    const authEl = createWindow({
      id: authId, appKey: "trash-auth", title: "Las que no salieron :(",
      x: cx(400), y: cy(280), w: 400, h: 280,
      bodyHTML: authBody,
    });

    const input = authEl.querySelector(".auth-input");
    const btn = authEl.querySelector(".auth-btn");
    const error = authEl.querySelector(".auth-error");

    // The password itself is verified server-side (serve.js) — it also gates
    // direct requests to /lock/*, so this isn't just a cosmetic client check.
    async function tryUnlock() {
      error.classList.add("hidden");
      btn.disabled = true;
      try {
        const res = await fetch("/api/unlock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: input.value }),
        });
        if (res.ok) {
          trashEl.dataset.locked = "false";
          trashEl.querySelector(".win-body").classList.remove("blurred-content");
          closeWindow(authId);
          focusWindow(trashEl.id);
          wireTrashFiles(trashEl);
        } else {
          error.classList.remove("hidden");
          input.value = "";
          input.focus();
        }
      } finally {
        btn.disabled = false;
      }
    }

    btn.addEventListener("click", tryUnlock);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") tryUnlock(); });
    input.focus();
  }

  function wireTrashFiles(el) {
    const files = LOCK_FILES;
    el.querySelectorAll(".file-item").forEach((it) => {
      const song = files[it.dataset.idx];
      it.onclick = (e) => {
        e.stopPropagation();
        document.querySelectorAll(".desk-icon.selected").forEach((o) => o.classList.remove("selected"));
        document.querySelectorAll(".file-item.selected").forEach((o) => o.classList.remove("selected"));
        it.classList.add("selected");
        quickLook = { kind: "song", song };
      };
      it.ondblclick = () => { playClick(); openPlayer(song); };
    });
  }

  /* ---------- Dock ---------- */
  const DOCK = [
    { key: "finder", name: "Finder", icon: "finder.png" },
    { key: "mail", name: "Mail", icon: "mail.png" },
    { key: "discord", name: "Discord", icon: "discord.png" },
    { key: "ableton", name: "Ableton Live", icon: "ableton.png" },
    { key: "notes", name: "Notes", icon: "notes.png" },
    { key: "spotify", name: "Spotify", icon: "spotify.png" },
    { sep: true },
    { key: "trash", name: "Trash", icon: "trash.png" },
  ];

  function buildDock() {
    DOCK.forEach((d) => {
      if (d.sep) {
        const s = document.createElement("div");
        s.className = "dock-sep";
        dockEl.appendChild(s);
        return;
      }
      const item = document.createElement("div");
      item.className = "dock-item";
      item.dataset.key = d.key;
      item.innerHTML = `
        <div class="dock-tip">${d.name}</div>
        <img src="assets/${d.icon}" alt="${d.name}" />
        <span class="dot"></span>`;
      item.addEventListener("mousedown", (e) => e.stopPropagation());
      item.addEventListener("click", () => launchFromDock(d.key, item));
      dockEl.appendChild(item);
    });
  }

  function launchFromDock(key, item) {
    const existing = Object.values(wins).filter((w) => w.appKey === key);
    if (existing.length) {
      if (key === "trash") {
        const trashWin = existing[existing.length - 1];
        if (trashWin.el.dataset.locked === "true") {
          const authWin = Object.values(wins).find((w) => w.appKey === "trash-auth");
          if (authWin) focusWindow(authWin.el.id);
          else promptTrashAuth(trashWin.el);
          updateDockDots();
          return;
        }
      }
      const focused = existing.find((w) => !w.el.classList.contains("blurred") && !w.minimized);
      if (focused) {
        minimizeWindow(focused.el.id);
      } else {
        const last = existing[existing.length - 1];
        if (last.minimized) {
          last.el.style.display = "flex";
          last.minimized = false;
        }
        focusWindow(last.el.id);
      }
      updateDockDots();
      return;
    }
    item.classList.add("bounce");
    setTimeout(() => item.classList.remove("bounce"), 560);
    openApp(key);
  }

  function updateDockDots() {
    dockEl.querySelectorAll(".dock-item").forEach((item) => {
      const key = item.dataset.key;
      const hasWindow = Object.values(wins).some((w) => w.appKey === key);
      item.classList.toggle("running", hasWindow);
    });
  }

  /* ---------- Desktop icons ---------- */
  const DESK_ICONS = [
    { key: "tsukiboys", label: "TSUKIBOYZ", x: 122, y: 116 },
    { key: "eventos", label: "EVENTOS", x: 122, y: 234 },
    { key: "music", label: "MUSIC", x: 122, y: 353 },
    { key: "kits", label: "KITS GANG", x: 122, y: 470 },
  ];

  // Tracks the last-selected item so Space (Quick Look) knows what to open.
  let quickLook = null;

  function openDeskFolder(key) {
    openFinder(key);
  }

  // Desktop icons: click selects, drag moves, double-click opens.
  function makeDeskDraggable(el, key) {
    el.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      // select on press
      document.querySelectorAll(".desk-icon.selected").forEach((o) => o.classList.remove("selected"));
      document.querySelectorAll(".file-item.selected").forEach((o) => o.classList.remove("selected"));
      el.classList.add("selected");
      quickLook = { kind: "folder", key };
      const p0 = toStage(e.clientX, e.clientY);
      const ox = parseFloat(el.style.left);
      const oy = parseFloat(el.style.top);
      let dragging = false;
      function move(ev) {
        const p = toStage(ev.clientX, ev.clientY);
        const dx = p.x - p0.x, dy = p.y - p0.y;
        if (!dragging && Math.hypot(dx, dy) > 4) {
          dragging = true;
          el.classList.add("dragging");
        }
        if (dragging) {
          let nx = Math.max(0, ox + dx);
          let ny = Math.max(28, oy + dy); // stay below the menu bar
          el.style.left = nx + "px";
          el.style.top = ny + "px";
        }
      }
      function up() {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
        if (dragging) el.classList.remove("dragging");
      }
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });
  }

  function buildDesktopIcons() {
    const layer = document.getElementById("desktop-icons");
    DESK_ICONS.forEach((d) => {
      const el = document.createElement("div");
      el.className = "desk-icon";
      el.style.left = d.x + "px";
      el.style.top = d.y + "px";
      el.innerHTML = `<img src="assets/folder.png" alt="" draggable="false" /><span>${d.label}</span>`;
      el.addEventListener("dblclick", () => { playClick(); openDeskFolder(d.key); });
      makeDeskDraggable(el, d.key);
      layer.appendChild(el);
    });
  }

  /* ---------- Menu bar dropdowns ---------- */
  const MENUS = {
    apple: [
      { label: "About This Mac" }, { sep: true },
      { label: "System Settings…" }, { label: "App Store…" }, { sep: true },
      { label: "Sleep" }, { label: "Restart…" }, { label: "Shut Down…" }, { sep: true },
      { label: "Lock Screen", shortcut: "⌃⌘Q" }, { label: "Log Out…", shortcut: "⇧⌘Q" },
    ],
    finder: [
      { label: "About Finder" }, { sep: true },
      { label: "Preferences…", shortcut: "⌘," }, { sep: true },
      { label: "Empty Trash…", shortcut: "⇧⌘⌫" }, { sep: true },
      { label: "Hide Finder", shortcut: "⌘H" },
    ],
    file: [
      { label: "New Finder Window", shortcut: "⌘N" }, { label: "New Folder", shortcut: "⇧⌘N" },
      { sep: true }, { label: "Open", shortcut: "⌘O" }, { label: "Close Window", shortcut: "⌘W" },
      { sep: true }, { label: "Get Info", shortcut: "⌘I" }, { label: "Move to Trash", shortcut: "⌘⌫" },
    ],
    edit: [
      { label: "Undo", shortcut: "⌘Z" }, { label: "Redo", shortcut: "⇧⌘Z" }, { sep: true },
      { label: "Cut", shortcut: "⌘X" }, { label: "Copy", shortcut: "⌘C" }, { label: "Paste", shortcut: "⌘V" },
      { sep: true }, { label: "Select All", shortcut: "⌘A" },
    ],
    view: [
      { label: "as Icons", shortcut: "⌘1" }, { label: "as List", shortcut: "⌘2" },
      { label: "as Columns", shortcut: "⌘3" }, { sep: true },
      { label: "Show Path Bar" }, { label: "Show Status Bar" },
    ],
    go: [
      { label: "Recents", shortcut: "⇧⌘F" }, { label: "Documents", shortcut: "⇧⌘O" },
      { label: "Desktop", shortcut: "⇧⌘D" }, { label: "Downloads", shortcut: "⌥⌘L" },
      { sep: true }, { label: "Applications", shortcut: "⇧⌘A" }, { label: "Utilities", shortcut: "⇧⌘U" },
    ],
    window: [
      { label: "Minimize", shortcut: "⌘M" }, { label: "Zoom" }, { sep: true },
      { label: "Bring All to Front" },
    ],
    help: [{ label: "TSUKIBOYS Help" }],
  };

  let openMenu = null;
  function showMenu(menuKey, anchorEl) {
    const items = MENUS[menuKey];
    if (!items) return;
    dropdown.innerHTML = items.map((it) =>
      it.sep ? `<div class="dd-sep"></div>`
        : `<div class="dd-item ${it.disabled ? "disabled" : ""}">
             <span>${it.label}</span>${it.shortcut ? `<span class="shortcut">${it.shortcut}</span>` : ""}
           </div>`).join("");
    const r = anchorEl.getBoundingClientRect();
    dropdown.style.left = r.left + "px";
    dropdown.style.top = r.bottom - 2 + "px";
    dropdown.classList.remove("hidden");
    anchorEl.classList.add("active");
    openMenu = anchorEl;
    dropdown.querySelectorAll(".dd-item:not(.disabled)").forEach((di) => {
      di.addEventListener("click", closeMenu);
    });
  }
  function closeMenu() {
    dropdown.classList.add("hidden");
    if (openMenu) openMenu.classList.remove("active");
    openMenu = null;
  }
  document.querySelectorAll(".mb-menu").forEach((m) => {
    m.addEventListener("click", (e) => {
      e.stopPropagation();
      const key = m.dataset.menu;
      if (openMenu === m) { closeMenu(); return; }
      closeMenu();
      showMenu(key, m);
    });
    m.addEventListener("mouseenter", () => {
      if (openMenu && openMenu !== m) { closeMenu(); showMenu(m.dataset.menu, m); }
    });
  });

  /* ---------- Global clicks / keys ---------- */
  document.addEventListener("click", () => closeMenu());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
    // Quick Look: Space toggles the preview of the selected file (macOS).
    // Folders are NOT opened with Space — only via double-click.
    if (e.code === "Space" && quickLook && quickLook.kind === "song") {
      e.preventDefault();
      const id = "player:" + quickLook.song.file;
      if (wins[id]) closeWindow(id);
      else openPlayer(quickLook.song);
    }
  });
  stage.addEventListener("mousedown", (e) => {
    if (e.target === stage || e.target.id === "wallpaper" || e.target.id === "desktop-icons") {
      document.querySelectorAll(".desk-icon.selected").forEach((o) => o.classList.remove("selected"));
      document.querySelectorAll(".file-item.selected").forEach((o) => o.classList.remove("selected"));
      quickLook = null;
      Object.keys(wins).forEach((id) => minimizeWindow(id));
    }
  });

  /* ---------- Init ---------- */
  buildDock();
  buildDesktopIcons();
  updateDockDots();
})();
