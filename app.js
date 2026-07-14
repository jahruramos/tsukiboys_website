/* ===== TSUKIBOYS — macOS desktop clone ===== */
(() => {
  "use strict";

  const stage = document.getElementById("stage");
  const windowsLayer = document.getElementById("windows");
  const dockEl = document.getElementById("dock");
  const dropdown = document.getElementById("menu-dropdown");

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

  function createWindow({ id, title, x, y, w, h, bodyHTML, appKey, bodyClass }) {
    if (wins[id]) {
      // Already open: un-minimize + focus
      const ex = wins[id];
      ex.el.style.display = "flex";
      ex.minimized = false;
      focusWindow(id);
      return ex.el;
    }
    const el = document.createElement("div");
    el.className = "window opening";
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.width = w + "px";
    el.style.height = h + "px";
    el.style.zIndex = ++zTop;
    el.innerHTML = `
      <div class="titlebar">
        <div class="traffic">
          <img class="tl-close" src="assets/tl-close.svg" alt="close" />
          <img class="tl-min" src="assets/tl-min.svg" alt="minimize" />
          <img class="tl-max" src="assets/tl-expand.svg" alt="maximize" />
        </div>
        <div class="win-title">${title}</div>
      </div>
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
  // Real audio files living in ./songs (name shown = file name).
  const MUSIC_SONGS = [
    "BOUNCE_TUS MANAS_MIKE CASTILLO.wav",
    "CHRIS REDD - PALOMA MAMI [RBCK] MASTER V4 FINAL.wav",
    "MASTER_ ALGO + PA TI_KAPAC x JEEICO x GZVZ.wav",
    "MASTER_JACK_RAINAO.wav",
    "REMIX PALOMA MAMI_CHRIS REDD x MIKE CASTILLO.mp3",
    "V27_M&M_Ritual_88_Am_Distribuir.wav",
  ].map((f) => ({ name: f, file: f }));

  const FOLDERS = {
    tsukiboys: { label: "Tsukiboys", files: [] },
    eventos: { label: "Eventos", files: [] },
    music: { label: "Music", files: MUSIC_SONGS },
  };

  const esc = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  function fileGridHTML(files) {
    if (!files.length) {
      return `<div class="app-body"><p>Carpeta vacía</p>
        <div class="placeholder-tag">Contenido próximamente</div></div>`;
    }
    return `<div class="file-grid">` + files.map((f, i) => `
      <div class="file-item" data-idx="${i}" title="${esc(f.name)}">
        <div class="ficon"><img src="assets/wav-icon.png" alt="" /></div>
        <span>${esc(f.name)}</span>
      </div>`).join("") + `</div>`;
  }

  function finderBodyHTML(activeKey) {
    const items = Object.entries(FOLDERS).map(([k, v]) =>
      `<div class="sb-item ${k === activeKey ? "active" : ""}" data-folder="${k}">
        <img src="assets/sidebar-folder.svg" alt="" />${v.label}</div>`).join("");
    return `
      <div class="sidebar">
        <div class="sb-head">Favorites</div>
        ${items}
      </div>
      <div class="win-content">${fileGridHTML(FOLDERS[activeKey].files)}</div>`;
  }

  function openFinder(folderKey = "music") {
    const el = createWindow({
      id: "finder",
      appKey: "finder",
      title: FOLDERS[folderKey].label,
      x: cx(798), y: 180, w: 798, h: 551,
      bodyHTML: finderBodyHTML(folderKey),
    });
    el.dataset.folder = folderKey;
    wireFinder(el);
    return el;
  }

  function setFinderFolder(el, folderKey) {
    el.dataset.folder = folderKey;
    el.querySelector(".win-title").textContent = FOLDERS[folderKey].label;
    el.querySelector(".win-body").innerHTML = finderBodyHTML(folderKey);
    wireFinder(el);
  }

  function wireFinder(el) {
    const files = FOLDERS[el.dataset.folder].files;
    el.querySelectorAll(".sb-item").forEach((it) => {
      it.onclick = () => setFinderFolder(el, it.dataset.folder);
    });
    el.querySelectorAll(".file-item").forEach((it) => {
      const song = files[it.dataset.idx];
      it.onclick = (e) => {
        e.stopPropagation();
        document.querySelectorAll(".desk-icon.selected").forEach((o) => o.classList.remove("selected"));
        document.querySelectorAll(".file-item.selected").forEach((o) => o.classList.remove("selected"));
        it.classList.add("selected");
        quickLook = { kind: "song", song };
      };
      it.ondblclick = () => openPlayer(song);
    });
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
    ++playerCount;
    const src = "songs/" + encodeURIComponent(song.file);
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
              <span>↺</span><i>15</i></button>
            <button class="ql-btn ql-play" title="Play/Pause">▶</button>
            <button class="ql-btn ql-fwd" title="+15s">
              <span>↻</span><i>15</i></button>
            <span class="ql-cur">0:00</span>
            <input type="range" class="ql-seek" min="0" max="1000" value="0" />
            <span class="ql-tot">0:00</span>
            <span class="ql-vol">🔊</span>
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
    });
    audio.addEventListener("ended", () => (playBtn.textContent = "▶"));

    playBtn.addEventListener("click", () => {
      if (audio.paused) { audio.play(); playBtn.textContent = "⏸"; }
      else { audio.pause(); playBtn.textContent = "▶"; }
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
    el.querySelector(".ql-vol").addEventListener("click", (ev) => {
      audio.muted = !audio.muted;
      ev.currentTarget.textContent = audio.muted ? "🔇" : "🔊";
    });

    // Stop playback when the window closes.
    el.querySelector(".tl-close").addEventListener("click", () => {
      audio.pause();
      audio.src = "";
    });

    // Autoplay on open (like pressing Space / double-click in macOS Quick Look).
    audio.play().then(() => (playBtn.textContent = "⏸")).catch(() => {});
  }

  /* ---------- Generic app windows ---------- */
  const APP_META = {
    mail:    { name: "Mail",    icon: "mail.png",    desc: "Bandeja de entrada de TSUKIBOYS." },
    books:   { name: "Books",   icon: "books.png",   desc: "Biblioteca de lecturas." },
    maps:    { name: "Maps",    icon: "maps.png",    desc: "Ubicaciones de eventos." },
    discord: { name: "Discord", icon: "discord.png", desc: "Únete al servidor de la comunidad." },
    ableton: { name: "Ableton Live", icon: "ableton.png", desc: "Sesiones y proyectos de producción." },
    notes:   { name: "Notes",   icon: "notes.png",   desc: "Notas y letras." },
    spotify: { name: "Spotify", icon: "spotify.png", desc: "Escucha los lanzamientos de TSUKIBOYS." },
    trash:   { name: "Trash",   icon: "trash.png",   desc: "La papelera está vacía." },
  };

  function openApp(key) {
    if (key === "finder") return openFinder();
    const m = APP_META[key];
    if (!m) return;
    createWindow({
      id: "app-" + key, appKey: key, title: m.name,
      x: cx(560) + Object.keys(wins).length * 24,
      y: cy(420) + Object.keys(wins).length * 24,
      w: 560, h: 420,
      bodyHTML: `
        <div class="app-body">
          <img class="app-hero" src="assets/${m.icon}" alt="" />
          <h2>${m.name}</h2>
          <p>${m.desc}</p>
          <div class="placeholder-tag">Contenido de ejemplo · se conectará después</div>
        </div>`,
    });
  }

  /* ---------- Dock ---------- */
  const DOCK = [
    { key: "finder", name: "Finder", icon: "finder.png" },
    { key: "mail", name: "Mail", icon: "mail.png" },
    { key: "books", name: "Books", icon: "books.png" },
    { key: "maps", name: "Maps", icon: "maps.png" },
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
      item.addEventListener("click", () => launchFromDock(d.key, item));
      dockEl.appendChild(item);
    });
  }

  function launchFromDock(key, item) {
    const existing = wins[key === "finder" ? "finder" : "app-" + key];
    if (existing && existing.minimized) {
      existing.el.style.display = "flex";
      existing.minimized = false;
      focusWindow(existing.el.id ? existing.el.id : key);
      // focus by id lookup
      const id = key === "finder" ? "finder" : "app-" + key;
      focusWindow(id);
      updateDockDots();
      return;
    }
    if (existing) {
      focusWindow(key === "finder" ? "finder" : "app-" + key);
      return;
    }
    item.classList.add("bounce");
    setTimeout(() => item.classList.remove("bounce"), 560);
    openApp(key);
  }

  function updateDockDots() {
    dockEl.querySelectorAll(".dock-item").forEach((item) => {
      const key = item.dataset.key;
      const id = key === "finder" ? "finder" : "app-" + key;
      const open = !!wins[id] || (key === "music");
      item.classList.toggle("running", !!wins[id]);
    });
  }

  /* ---------- Desktop icons ---------- */
  const DESK_ICONS = [
    { key: "tsukiboys", label: "TSUKIBOYZ", x: 122, y: 116 },
    { key: "eventos", label: "EVENTOS", x: 122, y: 234 },
    { key: "music", label: "MUSIC", x: 122, y: 353 },
  ];

  // Tracks the last-selected item so Space (Quick Look) knows what to open.
  let quickLook = null;

  function openDeskFolder(key) {
    const ex = wins["finder"];
    if (ex) { setFinderFolder(ex.el, key); focusWindow("finder"); }
    else openFinder(key);
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
      el.addEventListener("dblclick", () => openDeskFolder(d.key));
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
    }
  });

  /* ---------- Init ---------- */
  buildDock();
  buildDesktopIcons();
  updateDockDots();
})();
