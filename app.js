/* MyPanel — painel pessoal de links e anotações.
   Os dados ficam no localStorage do navegador. Use "Exportar backup" para guardar uma cópia. */
(() => {
  "use strict";

  const STORE_KEY = "mypanel:v1";
  const THEME_KEY = "mypanel:theme";
  const FALLBACK_CAT = "Geral";

  const COLORS = [
    "#264f8f", "#0b8ea3", "#2f8f5b", "#7a9a1f", "#d18a16",
    "#d4572a", "#c2364f", "#b0408f", "#7b4fc4", "#4b5670"
  ];

  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

  /* Blocos padrão. Cada um tem uma chave "seed" estável e a versão em que surgiu ("since"):
     quando SEED_VERSION aumenta, os blocos novos aparecem também em painéis que já têm dados. */
  const SEED_VERSION = 3;
  const GH = "https://github.com/RafaelFurtado44Programador";
  const DEFAULT_CATEGORIES = ["Perfil pessoal", "Projetos", "Aplicações", "Ferramentas", "Sites", "Anotações"];
  const DEFAULT_TILES = [
    // Perfil pessoal
    { seed: "perfil-github", since: 2, title: "Meu GitHub", desc: "Perfil e repositórios", url: GH, category: "Perfil pessoal", color: "#4b5670", icon: { kind: "svg", value: "code" } },
    { seed: "perfil-instagram", since: 2, title: "Instagram", desc: "@faelfurtado__", url: "https://www.instagram.com/faelfurtado__/", category: "Perfil pessoal", color: "#b0408f", icon: { kind: "svg", value: "camera" } },
    // Projetos
    { seed: "locacar-app", since: 2, title: "Locacar", desc: "Gestão de frota · EGS Locadora", url: "http://localhost:3000", category: "Projetos", color: "#264f8f", icon: { kind: "svg", value: "car" } },
    { seed: "locacar-repo", since: 2, title: "Locacar · código", desc: "Repositório no GitHub", url: GH + "/locacar", category: "Projetos", color: "#264f8f", icon: { kind: "svg", value: "git" } },
    { seed: "bebetter-app", since: 2, title: "BeBetter", desc: "Agenda, hábitos e modo BeBetter", url: "http://localhost:8081", category: "Projetos", color: "#2f8f5b", icon: { kind: "svg", value: "check" } },
    { seed: "bebetter-repo", since: 2, title: "BeBetter · código", desc: "Repositório no GitHub", url: GH + "/BeBetter", category: "Projetos", color: "#2f8f5b", icon: { kind: "svg", value: "git" } },
    { seed: "mypanel-repo", since: 2, title: "MyPanel · código", desc: "Repositório deste painel", url: GH + "/Mypanel", category: "Projetos", color: "#7b4fc4", icon: { kind: "svg", value: "git" } },
    // Aplicações
    { seed: "gmail", title: "Gmail", desc: "Caixa de entrada", url: "https://mail.google.com", category: "Aplicações", color: "#c2364f", icon: { kind: "svg", value: "mail" } },
    { seed: "google-agenda", since: 3, title: "Google Agenda", desc: "Compromissos e lembretes", url: "https://calendar.google.com/calendar/r", category: "Aplicações", color: "#264f8f", icon: { kind: "svg", value: "calendar" } },
    { seed: "drive", title: "Google Drive", desc: "Arquivos e documentos", url: "https://drive.google.com", category: "Aplicações", color: "#2f8f5b", icon: { kind: "svg", value: "cloud" } },
    { seed: "whatsapp", title: "WhatsApp Web", desc: "Mensagens", url: "https://web.whatsapp.com", category: "Aplicações", color: "#0b8ea3", icon: { kind: "svg", value: "chat" } },
    // Ferramentas
    { seed: "github", title: "GitHub", desc: "Página inicial", url: "https://github.com", category: "Ferramentas", color: "#4b5670", icon: { kind: "svg", value: "git" } },
    { seed: "claude", title: "Claude", desc: "Assistente de IA", url: "https://claude.ai", category: "Ferramentas", color: "#d4572a", icon: { kind: "svg", value: "sparkle" } },
    // Sites
    { seed: "youtube", title: "YouTube", desc: "Vídeos e aulas", url: "https://www.youtube.com", category: "Sites", color: "#c2364f", icon: { kind: "svg", value: "video" } },
    // Anotações
    { seed: "nota-boas-vindas", type: "note", title: "Ideias e lembretes", category: "Anotações", color: "#d18a16", icon: { kind: "svg", value: "note" }, size: "2", pinned: true,
      note: "Bem-vindo ao seu painel!\n• Clique em um bloco para abrir o link.\n• Botão direito em um bloco (ou o modo Organizar) para editar.\n• Exporte um backup de vez em quando pelo menu ⋮." }
  ];

  const makeTile = ({ since, ...t }) => ({ type: "link", desc: "", url: "", size: "1", newTab: true, note: "", pinned: false, ...t, id: uid(), icon: { ...t.icon } });

  const SAMPLE = () => ({
    version: 1,
    seedVersion: SEED_VERSION,
    removedSeeds: [],
    title: "MyPanel",
    categories: [...DEFAULT_CATEGORIES],
    tiles: DEFAULT_TILES.map(makeTile)
  });

  /* Acrescenta a um painel existente os blocos padrão que surgiram depois que ele foi criado,
     sem mexer nos blocos do usuário nem recriar os que ele excluiu. */
  function migrate(data) {
    const from = data.seedVersion || 1;
    if (from >= SEED_VERSION) return false;
    const have = new Set(data.tiles.map(t => t.seed).filter(Boolean));
    const urls = new Set(data.tiles.map(t => (t.url || "").replace(/\/+$/, "")));
    const removed = new Set(data.removedSeeds || []);
    DEFAULT_TILES.forEach(t => {
      if ((t.since || 1) <= from) return; // o painel já nasceu com este bloco
      if (have.has(t.seed) || removed.has(t.seed)) return;
      if (t.url && urls.has(t.url.replace(/\/+$/, ""))) return; // já existe um bloco com esse endereço
      data.tiles.push(makeTile(t));
      if (!data.categories.includes(t.category)) {
        const at = Math.min(DEFAULT_CATEGORIES.indexOf(t.category), data.categories.length);
        data.categories.splice(Math.max(0, at), 0, t.category);
      }
    });
    if (from < 3) data.tiles.forEach(t => { if (t.type === "note") t.pinned = true; }); // notas vão para o topo
    data.seedVersion = SEED_VERSION;
    return true;
  }

  /* ---------- Estado ---------- */
  let state = load();
  let filter = "Todos";
  let query = "";
  let editing = false;
  let draft = null;        // bloco sendo editado no formulário
  let draftIsNew = false;
  let openNoteId = null;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const el = {
    board: $("#board"), chips: $("#chips"), empty: $("#empty"), count: $("#count"),
    search: $("#search"), title: $("#panelTitle"), today: $("#today"),
    editToggle: $("#editToggle"), editHint: $("#editHint"), addBtn: $("#addBtn"),
    themeToggle: $("#themeToggle"), menuBtn: $("#menuBtn"), menu: $("#menu"),
    editor: $("#editor"), form: $("#editorForm"), editorTitle: $("#editorTitle"), preview: $("#preview"),
    fTitle: $("#fTitle"), fUrl: $("#fUrl"), fDesc: $("#fDesc"), fCategory: $("#fCategory"), fSize: $("#fSize"),
    fNote: $("#fNote"), fNewTab: $("#fNewTab"), fEmoji: $("#fEmoji"), urlErr: $("#urlErr"),
    swatches: $("#swatches"), iconGrid: $("#iconGrid"), faviconHint: $("#faviconHint"),
    deleteZone: $("#deleteZone"), deleteBtn: $("#deleteBtn"), deleteConfirm: $("#deleteConfirm"),
    deleteYes: $("#deleteYes"), deleteNo: $("#deleteNo"),
    noteView: $("#noteView"), noteTitle: $("#noteTitle"), noteChip: $("#noteChip"), noteText: $("#noteText"),
    noteSaved: $("#noteSaved"), noteCopy: $("#noteCopy"), noteEdit: $("#noteEdit"),
    catDialog: $("#catDialog"), catList: $("#catList"), catAdd: $("#catAdd"), catNew: $("#catNew"),
    renameDialog: $("#renameDialog"), renameForm: $("#renameForm"), renameInput: $("#renameInput"),
    importFile: $("#importFile"), toast: $("#toast"),
    topRow: $("#topRow"), topNotes: $("#topNotes"), addNoteBtn: $("#addNoteBtn"), fPinned: $("#fPinned")
  };

  /* ---------- Persistência ---------- */
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const data = sanitize(JSON.parse(raw));
        if (data) {
          if (migrate(data)) { try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (_) {} }
          return data;
        }
      }
    } catch (_) { /* armazenamento indisponível */ }
    return SAMPLE();
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (_) { toast("Não foi possível salvar neste navegador. Exporte um backup."); }
  }

  function sanitize(data) {
    if (!data || !Array.isArray(data.tiles)) return null;
    const cats = Array.isArray(data.categories) ? data.categories.filter(c => typeof c === "string" && c.trim()) : [];
    const tiles = data.tiles.filter(t => t && typeof t.title === "string").map(t => ({
      id: String(t.id || uid()),
      type: t.type === "note" ? "note" : "link",
      title: String(t.title).slice(0, 40),
      desc: String(t.desc || "").slice(0, 60),
      url: String(t.url || ""),
      category: String(t.category || FALLBACK_CAT),
      color: /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : COLORS[0],
      icon: t.icon && t.icon.kind ? { kind: String(t.icon.kind), value: String(t.icon.value || "") } : { kind: "svg", value: "link" },
      size: t.size === "2" ? "2" : "1",
      newTab: t.newTab !== false,
      note: String(t.note || ""),
      pinned: t.pinned === true,
      ...(t.seed ? { seed: String(t.seed) } : {})
    }));
    tiles.forEach(t => { if (!cats.includes(t.category)) cats.push(t.category); });
    if (!cats.length) cats.push(FALLBACK_CAT);
    return {
      version: 1,
      seedVersion: Number(data.seedVersion) || 1,
      removedSeeds: Array.isArray(data.removedSeeds) ? data.removedSeeds.map(String) : [],
      title: String(data.title || "MyPanel").slice(0, 30),
      categories: cats,
      tiles
    };
  }

  /* ---------- Utilidades ---------- */
  function normalizeUrl(input) {
    let v = (input || "").trim();
    if (!v) return null;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) {
      const local = /^(localhost|127\.|192\.168\.|10\.|\[::1\])/i.test(v);
      v = (local ? "http://" : "https://") + v;
    }
    try {
      const u = new URL(v);
      if (/^javascript:/i.test(u.protocol)) return null;
      return u.href;
    } catch (_) { return null; }
  }

  function hostOf(url) {
    try {
      const u = new URL(url);
      return (u.host || u.protocol.replace(":", "")).replace(/^www\./, "");
    } catch (_) { return ""; }
  }

  function initials(title) {
    const words = (title || "?").trim().split(/\s+/).filter(Boolean);
    const s = words.length > 1 ? words[0][0] + words[1][0] : (words[0] || "?").slice(0, 2);
    return s.toUpperCase();
  }

  function svgIcon(key) {
    const ic = window.ICONS[key] || window.ICONS.link;
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${ic.d}</svg>`;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function iconMarkup(t) {
    const { kind, value } = t.icon || {};
    if (kind === "emoji" && value) return `<span class="emoji">${esc(value)}</span>`;
    if (kind === "letter") return esc(initials(t.title));
    if (kind === "favicon" && t.type === "link") {
      const host = hostOf(t.url);
      if (host) {
        return `<img alt="" loading="lazy" referrerpolicy="no-referrer" src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64" data-fallback="${esc(initials(t.title))}">`;
      }
    }
    return svgIcon(kind === "svg" ? value : (t.type === "note" ? "note" : "link"));
  }

  function bindFaviconFallback(root) {
    $$("img[data-fallback]", root).forEach(img => {
      img.addEventListener("error", () => { img.replaceWith(document.createTextNode(img.dataset.fallback)); }, { once: true });
    });
  }

  let toastTimer;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.toast.hidden = true; }, 2600);
  }

  /* ---------- Renderização ---------- */
  function tileMarkup(t, { preview = false } = {}) {
    const isNote = t.type === "note";
    const host = isNote ? "" : hostOf(t.url);
    const kind = isNote
      ? `<span class="tile-kind">${svgIcon("note")}nota</span>`
      : `<span class="tile-kind">${svgIcon("link")}${t.newTab ? "nova aba" : "mesma aba"}</span>`;
    const body = isNote
      ? `<span class="tile-note">${esc(t.note || "Nota vazia")}</span>`
      : (t.desc ? `<span class="tile-desc">${esc(t.desc)}</span>` : "");
    const foot = isNote ? "" : `<span class="tile-host">${esc(host || "sem endereço")}</span>`;
    return `
      <span class="tile-top">
        <span class="tile-icon">${iconMarkup(t)}</span>
        ${preview ? kind : kind + `<span class="grip" aria-hidden="true"><svg viewBox="0 0 24 24" style="width:14px;height:14px"><circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/></svg></span>`}
      </span>
      <span class="tile-text">
        <span class="tile-title">${esc(t.title || "Sem nome")}</span>
        ${body}
        ${foot}
      </span>`;
  }

  function buildTile(t, { top = false } = {}) {
    const isLink = t.type === "link";
    const node = document.createElement(isLink && !editing ? "a" : "button");
    node.className = "tile" + (t.size === "2" ? " wide" : "");
    node.style.setProperty("--c", t.color);
    node.dataset.id = t.id;
    if (node.tagName === "A") {
      node.href = t.url || "#";
      if (t.newTab) { node.target = "_blank"; node.rel = "noopener noreferrer"; }
    } else {
      node.type = "button";
    }
    node.setAttribute("aria-label", `${t.title}${isLink ? ", abrir " + hostOf(t.url) : ", abrir nota"}`);
    node.innerHTML = tileMarkup(t);
    if (editing && !top) node.draggable = true;
    return node;
  }

  function visibleTiles() {
    const q = query.trim().toLowerCase();
    return state.tiles.filter(t => {
      if (filter !== "Todos" && t.category !== filter) return false;
      if (!q) return true;
      return [t.title, t.desc, t.url, t.note, t.category].some(v => (v || "").toLowerCase().includes(q));
    });
  }

  function render() {
    document.title = state.title;
    el.title.textContent = state.title;

    // chips
    const counts = {};
    state.tiles.forEach(t => { counts[t.category] = (counts[t.category] || 0) + 1; });
    if (filter !== "Todos" && !state.categories.includes(filter)) filter = "Todos";
    el.chips.innerHTML = ["Todos", ...state.categories].map(c => {
      const n = c === "Todos" ? state.tiles.length : (counts[c] || 0);
      return `<button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="${c === filter}">${esc(c)} <b>${n}</b></button>`;
    }).join("");

    // topo: anotações fixadas + agenda (só na visão geral, sem filtro nem busca)
    const showTop = filter === "Todos" && !query.trim();
    const pinned = state.tiles.filter(t => t.type === "note" && t.pinned);
    el.topRow.hidden = !showTop;
    el.topNotes.innerHTML = "";
    if (showTop) {
      pinned.forEach(t => el.topNotes.appendChild(buildTile(t, { top: true })));
      if (!pinned.length) {
        const add = document.createElement("button");
        add.type = "button";
        add.className = "tile add-tile";
        add.dataset.addNote = "";
        add.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>Nova anotação</span>`;
        el.topNotes.appendChild(add);
      }
    }

    // grade
    const list = visibleTiles().filter(t => !(showTop && t.type === "note" && t.pinned));
    el.board.innerHTML = "";
    el.board.classList.toggle("editing", editing);
    const grouped = filter === "Todos" && !query.trim();

    if (grouped) {
      state.categories.forEach(cat => {
        const items = list.filter(t => t.category === cat);
        if (!items.length) return;
        const h = document.createElement("h2");
        h.className = "group-title";
        h.textContent = cat;
        el.board.appendChild(h);
        items.forEach(t => el.board.appendChild(buildTile(t)));
      });
    } else {
      list.forEach(t => el.board.appendChild(buildTile(t)));
    }

    if ((list.length || showTop) && !query.trim()) {
      const add = document.createElement("button");
      add.type = "button";
      add.className = "tile add-tile";
      add.dataset.add = filter === "Todos" ? "" : filter;
      add.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>Novo bloco</span>`;
      el.board.appendChild(add);
    }

    bindFaviconFallback(el.board);
    el.empty.hidden = list.length > 0 || showTop;
    if (!list.length && query.trim()) {
      $(".empty-title", el.empty).textContent = `Nada encontrado para "${query.trim()}"`;
    } else {
      $(".empty-title", el.empty).textContent = "Nenhum bloco por aqui";
    }
    const links = state.tiles.filter(t => t.type === "link").length;
    const notes = state.tiles.length - links;
    el.count.textContent = `${links} ${links === 1 ? "link" : "links"} · ${notes} ${notes === 1 ? "nota" : "notas"} · ${state.categories.length} categorias`;
  }

  /* ---------- Grade: cliques e arrastar ---------- */
  function onTileClick(e) {
    const add = e.target.closest(".add-tile");
    if (add) {
      if (add.dataset.addNote !== undefined) newNote();
      else openEditor(null, add.dataset.add || undefined);
      return;
    }
    const node = e.target.closest(".tile[data-id]");
    if (!node) return;
    const t = state.tiles.find(x => x.id === node.dataset.id);
    if (!t) return;
    if (editing) { e.preventDefault(); openEditor(t); return; }
    if (t.type === "note") openNote(t);
    else if (!t.url) { e.preventDefault(); openEditor(t); }
  }

  function onTileContext(e) {
    const node = e.target.closest(".tile[data-id]");
    if (!node) return;
    e.preventDefault();
    const t = state.tiles.find(x => x.id === node.dataset.id);
    if (t) openEditor(t);
  }

  function newNote() {
    openEditor(null, state.categories.includes("Anotações") ? "Anotações" : undefined, "note");
  }

  [el.board, el.topNotes].forEach(c => {
    c.addEventListener("click", onTileClick);
    c.addEventListener("contextmenu", onTileContext);
  });
  el.addNoteBtn.addEventListener("click", newNote);

  let dragId = null;
  el.board.addEventListener("dragstart", e => {
    const node = e.target.closest(".tile[data-id]");
    if (!node || !editing) return;
    dragId = node.dataset.id;
    node.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", dragId); } catch (_) {}
  });
  el.board.addEventListener("dragover", e => {
    if (!dragId) return;
    const over = e.target.closest(".tile[data-id]");
    e.preventDefault();
    $$(".drop-target", el.board).forEach(n => n !== over && n.classList.remove("drop-target"));
    if (over && over.dataset.id !== dragId) over.classList.add("drop-target");
  });
  el.board.addEventListener("drop", e => {
    if (!dragId) return;
    e.preventDefault();
    const over = e.target.closest(".tile[data-id]");
    if (over && over.dataset.id !== dragId) {
      const from = state.tiles.findIndex(t => t.id === dragId);
      const [moved] = state.tiles.splice(from, 1);
      const target = state.tiles.find(t => t.id === over.dataset.id);
      let to = state.tiles.indexOf(target);
      if (from <= to) to += 1; // soltar depois quando arrastando para frente
      moved.category = target.category;
      state.tiles.splice(to, 0, moved);
      save();
    }
    endDrag();
  });
  el.board.addEventListener("dragend", endDrag);
  function endDrag() { dragId = null; render(); }

  /* ---------- Topo ---------- */
  el.chips.addEventListener("click", e => {
    const c = e.target.closest(".chip");
    if (!c) return;
    filter = c.dataset.cat;
    render();
  });

  el.search.addEventListener("input", () => { query = el.search.value; render(); });

  el.editToggle.addEventListener("click", () => {
    editing = !editing;
    el.editToggle.setAttribute("aria-pressed", String(editing));
    $("span", el.editToggle).textContent = editing ? "Concluir" : "Organizar";
    el.editHint.hidden = !editing;
    render();
  });

  el.addBtn.addEventListener("click", () => openEditor(null, filter !== "Todos" ? filter : undefined));
  $("[data-empty-add]").addEventListener("click", () => openEditor(null, filter !== "Todos" ? filter : undefined));

  // Tema: sistema → claro → escuro
  const THEMES = ["system", "light", "dark"];
  const THEME_LABEL = { system: "sistema", light: "claro", dark: "escuro" };
  function applyTheme(mode) {
    if (mode === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", mode);
    el.themeToggle.title = `Tema: ${THEME_LABEL[mode]}`;
  }
  let theme = "system";
  try { theme = localStorage.getItem(THEME_KEY) || "system"; } catch (_) {}
  if (!THEMES.includes(theme)) theme = "system";
  applyTheme(theme);
  el.themeToggle.addEventListener("click", () => {
    theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    applyTheme(theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (_) {}
    toast(`Tema ${THEME_LABEL[theme]}`);
  });

  // Menu
  el.menuBtn.addEventListener("click", e => {
    e.stopPropagation();
    const open = el.menu.hidden;
    el.menu.hidden = !open;
    el.menuBtn.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", e => {
    if (!el.menu.hidden && !e.target.closest(".menu-wrap")) closeMenu();
  });
  function closeMenu() { el.menu.hidden = true; el.menuBtn.setAttribute("aria-expanded", "false"); }

  let resetArmed = false;
  el.menu.addEventListener("click", e => {
    const b = e.target.closest("button[data-action]");
    if (!b) return;
    const action = b.dataset.action;
    if (action === "reset") {
      if (!resetArmed) {
        resetArmed = true;
        b.textContent = "Clique de novo para confirmar";
        setTimeout(() => { resetArmed = false; b.textContent = "Restaurar padrão"; }, 3000);
        return;
      }
      resetArmed = false;
      b.textContent = "Restaurar padrão";
      state = SAMPLE(); filter = "Todos"; save(); render(); closeMenu();
      toast("Painel restaurado com os blocos padrão");
      return;
    }
    closeMenu();
    if (action === "export") exportData();
    if (action === "import") el.importFile.click();
    if (action === "categories") openCategories();
    if (action === "rename") { el.renameInput.value = state.title; el.renameDialog.showModal(); el.renameInput.select(); }
  });

  el.renameForm.addEventListener("submit", e => {
    e.preventDefault();
    const v = el.renameInput.value.trim();
    if (v) { state.title = v; save(); render(); }
    el.renameDialog.close();
  });

  /* ---------- Backup ---------- */
  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    a.href = URL.createObjectURL(blob);
    a.download = `mypanel-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast("Backup exportado");
  }

  el.importFile.addEventListener("change", () => {
    const file = el.importFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = sanitize(JSON.parse(reader.result));
        if (!data) throw new Error("formato");
        migrate(data);
        state = data; filter = "Todos"; save(); render();
        toast(`Backup importado: ${data.tiles.length} blocos`);
      } catch (_) {
        toast("Arquivo inválido. Escolha um backup .json exportado pelo MyPanel.");
      }
      el.importFile.value = "";
    };
    reader.readAsText(file);
  });

  /* ---------- Editor ---------- */
  function openEditor(tile, presetCat, presetType) {
    draftIsNew = !tile;
    draft = tile ? JSON.parse(JSON.stringify(tile)) : {
      id: uid(), type: presetType === "note" ? "note" : "link", title: "", desc: "", url: "",
      category: presetCat || state.categories[0] || FALLBACK_CAT,
      color: COLORS[state.tiles.length % COLORS.length],
      icon: { kind: "svg", value: presetType === "note" ? "note" : "globe" }, size: presetType === "note" ? "2" : "1",
      newTab: true, note: "", pinned: presetType === "note"
    };

    el.editorTitle.textContent = draftIsNew ? "Novo bloco" : "Editar bloco";
    el.deleteZone.hidden = draftIsNew;
    el.deleteConfirm.hidden = true;
    el.deleteBtn.hidden = false;

    el.fCategory.innerHTML = state.categories.map(c => `<option>${esc(c)}</option>`).join("");
    el.fTitle.value = draft.title;
    el.fUrl.value = draft.url;
    el.fDesc.value = draft.desc;
    el.fCategory.value = draft.category;
    el.fSize.value = draft.size;
    el.fNote.value = draft.note || "";
    el.fNewTab.checked = draft.newTab;
    el.fPinned.checked = !!draft.pinned;
    el.fEmoji.value = draft.icon.kind === "emoji" ? draft.icon.value : "";
    el.fUrl.removeAttribute("aria-invalid");
    el.urlErr.hidden = true;
    $(`input[name="type"][value="${draft.type}"]`, el.form).checked = true;
    $(`input[name="iconKind"][value="${draft.icon.kind}"]`, el.form).checked = true;

    renderSwatches();
    renderIconGrid();
    syncEditor();
    el.editor.showModal();
    setTimeout(() => el.fTitle.focus(), 30);
  }

  function renderSwatches() {
    const isCustom = !COLORS.includes(draft.color.toLowerCase());
    el.swatches.innerHTML = COLORS.map(c =>
      `<button type="button" class="swatch" role="radio" style="--sw:${c}" data-color="${c}" aria-checked="${draft.color.toLowerCase() === c}" aria-label="Cor ${c}"></button>`
    ).join("") + `<label class="swatch custom" aria-checked="${isCustom}" title="Cor personalizada"${isCustom ? ` style="background:${draft.color}"` : ""}><input type="color" id="fColor" value="${draft.color}" aria-label="Cor personalizada"></label>`;
  }

  function renderIconGrid() {
    el.iconGrid.innerHTML = Object.entries(window.ICONS).map(([k, ic]) =>
      `<button type="button" class="icon-opt" role="radio" data-icon="${k}" title="${esc(ic.label)}" aria-label="${esc(ic.label)}" aria-checked="${draft.icon.kind === "svg" && draft.icon.value === k}">${svgIcon(k)}</button>`
    ).join("");
  }

  function syncEditor() {
    const isNote = draft.type === "note";
    $$("[data-for]", el.form).forEach(n => { n.hidden = n.dataset.for !== draft.type; });
    if (isNote && draft.icon.kind === "favicon") {
      draft.icon = { kind: "svg", value: "note" };
      $(`input[name="iconKind"][value="svg"]`, el.form).checked = true;
      renderIconGrid();
    }
    const k = draft.icon.kind;
    el.iconGrid.hidden = k !== "svg";
    el.fEmoji.hidden = k !== "emoji";
    el.faviconHint.hidden = k !== "favicon";

    el.preview.className = "tile preview" + (draft.size === "2" ? " wide" : "");
    el.preview.style.setProperty("--c", draft.color);
    const shown = { ...draft, url: normalizeUrl(draft.url) || draft.url };
    el.preview.innerHTML = tileMarkup(shown, { preview: true });
    bindFaviconFallback(el.preview);
  }

  el.form.addEventListener("input", e => {
    const t = e.target;
    if (t.name === "type") {
      draft.type = t.value;
      if (draftIsNew) { draft.pinned = draft.type === "note"; el.fPinned.checked = draft.pinned; }
    }
    if (t === el.fTitle) draft.title = t.value;
    if (t === el.fUrl) { draft.url = t.value; el.fUrl.removeAttribute("aria-invalid"); el.urlErr.hidden = true; }
    if (t === el.fDesc) draft.desc = t.value;
    if (t === el.fNote) draft.note = t.value;
    if (t === el.fEmoji) draft.icon = { kind: "emoji", value: t.value.trim() };
    if (t.id === "fColor") {
      draft.color = t.value;
      $$(".swatch", el.swatches).forEach(s => s.setAttribute("aria-checked", "false"));
      const c = $(".swatch.custom", el.swatches);
      c.setAttribute("aria-checked", "true");
      c.style.background = t.value;
    }
    if (t.name === "iconKind") {
      const kind = t.value;
      if (kind === "svg") draft.icon = { kind, value: draft.icon.kind === "svg" ? draft.icon.value : (draft.type === "note" ? "note" : "globe") };
      else if (kind === "emoji") draft.icon = { kind, value: el.fEmoji.value.trim() || "⭐" };
      else draft.icon = { kind, value: "" };
      if (kind === "emoji" && !el.fEmoji.value) el.fEmoji.value = draft.icon.value;
      renderIconGrid();
    }
    syncEditor();
  });
  el.form.addEventListener("change", e => {
    if (e.target === el.fCategory) draft.category = e.target.value;
    if (e.target === el.fSize) draft.size = e.target.value;
    if (e.target === el.fNewTab) draft.newTab = e.target.checked;
    if (e.target === el.fPinned) draft.pinned = e.target.checked;
    syncEditor();
  });

  el.swatches.addEventListener("click", e => {
    const s = e.target.closest(".swatch[data-color]");
    if (!s) return;
    draft.color = s.dataset.color;
    renderSwatches();
    syncEditor();
  });

  el.iconGrid.addEventListener("click", e => {
    const b = e.target.closest(".icon-opt");
    if (!b) return;
    draft.icon = { kind: "svg", value: b.dataset.icon };
    $$(".icon-opt", el.iconGrid).forEach(x => x.setAttribute("aria-checked", String(x === b)));
    syncEditor();
  });

  el.form.addEventListener("submit", e => {
    e.preventDefault();
    draft.title = draft.title.trim();
    if (!draft.title) { el.fTitle.focus(); toast("Dê um nome ao bloco"); return; }
    if (draft.type === "link") {
      const url = normalizeUrl(draft.url);
      if (!url) {
        el.fUrl.setAttribute("aria-invalid", "true");
        el.urlErr.hidden = false;
        el.fUrl.focus();
        return;
      }
      draft.url = url;
    }
    if (draft.icon.kind === "emoji" && !draft.icon.value) draft.icon = { kind: "letter", value: "" };
    draft.desc = draft.desc.trim();

    const i = state.tiles.findIndex(t => t.id === draft.id);
    if (i >= 0) state.tiles[i] = draft; else state.tiles.push(draft);
    if (!state.categories.includes(draft.category)) state.categories.push(draft.category);
    save();
    el.editor.close();
    render();
    toast(draftIsNew ? `"${draft.title}" criado` : "Alterações salvas");
  });

  el.deleteBtn.addEventListener("click", () => { el.deleteBtn.hidden = true; el.deleteConfirm.hidden = false; });
  el.deleteNo.addEventListener("click", () => { el.deleteBtn.hidden = false; el.deleteConfirm.hidden = true; });
  el.deleteYes.addEventListener("click", () => {
    const name = draft.title;
    if (draft.seed && !state.removedSeeds.includes(draft.seed)) state.removedSeeds.push(draft.seed);
    state.tiles = state.tiles.filter(t => t.id !== draft.id);
    save();
    el.editor.close();
    render();
    toast(`"${name}" excluído`);
  });

  /* ---------- Notas ---------- */
  let noteTimer;
  function openNote(t) {
    openNoteId = t.id;
    el.noteTitle.textContent = t.title;
    el.noteChip.style.background = t.color;
    el.noteChip.innerHTML = iconMarkup(t);
    el.noteText.value = t.note || "";
    el.noteSaved.textContent = "Salvo automaticamente";
    el.noteView.showModal();
    el.noteText.focus();
    el.noteText.setSelectionRange(el.noteText.value.length, el.noteText.value.length);
  }
  el.noteText.addEventListener("input", () => {
    el.noteSaved.textContent = "Salvando…";
    clearTimeout(noteTimer);
    noteTimer = setTimeout(flushNote, 400);
  });
  function flushNote() {
    clearTimeout(noteTimer);
    const t = state.tiles.find(x => x.id === openNoteId);
    if (!t || t.note === el.noteText.value) { el.noteSaved.textContent = "Salvo automaticamente"; return; }
    t.note = el.noteText.value;
    save();
    const d = new Date();
    el.noteSaved.textContent = `Salvo às ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  el.noteView.addEventListener("close", () => { flushNote(); openNoteId = null; render(); });
  el.noteCopy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(el.noteText.value); toast("Texto copiado"); }
    catch (_) { el.noteText.select(); toast("Texto selecionado. Use Ctrl+C para copiar."); }
  });
  el.noteEdit.addEventListener("click", () => {
    flushNote();
    const t = state.tiles.find(x => x.id === openNoteId);
    el.noteView.close();
    if (t) openEditor(t);
  });

  /* ---------- Categorias ---------- */
  function openCategories() { renderCategories(); el.catDialog.showModal(); }
  function renderCategories() {
    el.catList.innerHTML = state.categories.map((c, i) => {
      const n = state.tiles.filter(t => t.category === c).length;
      return `<li><span>${esc(c)}<small>${n}</small></span>
        <span>
          <button type="button" class="btn ghost" data-up="${i}" ${i === 0 ? "disabled" : ""} aria-label="Mover ${esc(c)} para cima">↑</button>
          <button type="button" class="btn danger-ghost" data-del="${i}">Remover</button>
        </span></li>`;
    }).join("");
  }
  el.catList.addEventListener("click", e => {
    const up = e.target.closest("[data-up]");
    const del = e.target.closest("[data-del]");
    if (up) {
      const i = +up.dataset.up;
      [state.categories[i - 1], state.categories[i]] = [state.categories[i], state.categories[i - 1]];
    }
    if (del) {
      const i = +del.dataset.del;
      const name = state.categories[i];
      state.categories.splice(i, 1);
      if (state.tiles.some(t => t.category === name)) {
        if (!state.categories.includes(FALLBACK_CAT)) state.categories.push(FALLBACK_CAT);
        state.tiles.forEach(t => { if (t.category === name) t.category = FALLBACK_CAT; });
      }
      if (!state.categories.length) state.categories.push(FALLBACK_CAT);
    }
    save(); renderCategories(); render();
  });
  el.catAdd.addEventListener("submit", e => {
    e.preventDefault();
    const v = el.catNew.value.trim();
    if (!v) return;
    if (state.categories.some(c => c.toLowerCase() === v.toLowerCase())) { toast("Essa categoria já existe"); return; }
    state.categories.push(v);
    el.catNew.value = "";
    save(); renderCategories(); render();
  });

  /* ---------- Diálogos e atalhos ---------- */
  document.addEventListener("click", e => {
    const c = e.target.closest("[data-close]");
    if (c) c.closest("dialog").close();
  });
  $$("dialog").forEach(d => d.addEventListener("click", e => { if (e.target === d) d.close(); }));

  document.addEventListener("keydown", e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if ($("dialog[open]")) return;
    if (e.key === "/" && !typing) { e.preventDefault(); el.search.focus(); }
    else if ((e.key === "n" || e.key === "N") && !typing && !e.ctrlKey && !e.metaKey) { e.preventDefault(); openEditor(null, filter !== "Todos" ? filter : undefined); }
    else if (e.key === "Escape") {
      if (!el.menu.hidden) closeMenu();
      else if (document.activeElement === el.search && el.search.value) { el.search.value = ""; query = ""; render(); }
    }
  });

  /* ---------- Data ---------- */
  function paintDate() {
    const d = new Date();
    const h = d.getHours();
    const hi = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
    const date = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    el.today.textContent = `${hi} · ${date.charAt(0).toUpperCase()}${date.slice(1)}`;
  }
  window.MyPanel = { toast };
  paintDate();
  setInterval(paintDate, 60 * 1000);

  render();
})();
