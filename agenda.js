/* MyPanel — agenda do Google (hoje e amanhã).
   Lê o "endereço secreto no formato iCal" de cada agenda através do server.py,
   porque o Google bloqueia o download direto pelo navegador (CORS).
   Os endereços ficam salvos só neste navegador: não entram no código, no backup nem no GitHub. */
(() => {
  "use strict";

  const CAL_KEY = "mypanel:calendars";
  const CACHE_KEY = "mypanel:agendaCache";
  const REFRESH_MS = 10 * 60 * 1000;
  const STALE_MS = 5 * 60 * 1000;
  const CAL_COLORS = ["#264f8f", "#2f8f5b", "#b0408f", "#d18a16", "#0b8ea3", "#7b4fc4"];
  const GCAL = "https://calendar.google.com/calendar/r";
  const DEMO = !!window.MYPANEL_DEMO_AGENDA;

  const $ = s => document.querySelector(s);
  const el = {
    body: $("#agendaBody"), status: $("#agendaStatus"), refresh: $("#agendaRefresh"), settings: $("#agendaSettings"),
    dialog: $("#calDialog"), list: $("#calList"), form: $("#calAdd"), url: $("#calUrl"), name: $("#calName"),
    err: $("#calErr"), submit: $("#calSubmit")
  };
  if (!el.body) return;

  const toast = m => window.MyPanel && window.MyPanel.toast && window.MyPanel.toast(m);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const hhmm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const startOfDay = (d, add = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + add);
  const rid = () => Math.random().toString(36).slice(2, 10);

  function readJSON(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
    catch (_) { return fallback; }
  }
  function writeJSON(key, v) {
    try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch (_) { return false; }
  }

  function sanitizeCals(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(c => c && typeof c.url === "string" && c.url).map((c, i) => ({
      id: String(c.id || rid()),
      name: String(c.name || "Agenda").slice(0, 30),
      url: c.url,
      color: /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : CAL_COLORS[i % CAL_COLORS.length]
    }));
  }

  let calendars = sanitizeCals(readJSON(CAL_KEY, []));
  let events = [];      // { title, start, end, allDay, location, cal }
  let lastOk = 0;
  let loadedDay = "";
  let loading = false;
  let errors = [];      // { name, code }

  const cache = readJSON(CACHE_KEY, null);
  if (!DEMO && cache && cache.day === dayKey(new Date()) && Array.isArray(cache.events)) {
    events = cache.events.filter(e => calendars.some(c => c.id === e.cal));
    lastOk = Number(cache.at) || 0;
    loadedDay = cache.day;
  }

  const saveCals = () => { if (!writeJSON(CAL_KEY, calendars)) toast("Não foi possível salvar as agendas neste navegador."); };
  const calById = id => calendars.find(c => c.id === id);

  const MESSAGES = {
    no_server: "Abra o painel pelo iniciar.bat para carregar a agenda.",
    invalid_url: "Use o endereço secreto que começa com https://calendar.google.com/calendar/ical/.",
    upstream: "O Google não encontrou essa agenda. Copie o endereço secreto de novo.",
    offline: "Sem conexão com o Google Agenda agora.",
    not_ical: "Esse endereço não devolveu uma agenda no formato iCal.",
    too_large: "Essa agenda é grande demais para carregar.",
    parse: "Não foi possível ler essa agenda.",
    no_lib: "O leitor de agenda (vendor/ical.min.js) não carregou."
  };
  const message = code => MESSAGES[code] || "Não foi possível carregar a agenda.";

  /* ---------- Busca e leitura ---------- */
  async function fetchIcs(url) {
    if (location.protocol === "file:") throw { code: "no_server" };
    let r;
    try {
      r = await fetch("api/ics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
    } catch (_) { throw { code: "no_server" }; }
    if (r.ok) return r.text();
    if ([404, 405, 501].includes(r.status)) throw { code: "no_server" };
    let j = {};
    try { j = await r.json(); } catch (_) {}
    throw { code: j.error || "unknown", status: j.status };
  }

  function calName(text) {
    const m = /^X-WR-CALNAME:(.*)$/mi.exec(text);
    return m ? m[1].replace(/\\([,;\\])/g, "$1").trim() : "";
  }

  /* Converte o iCal em eventos entre `from` e `to`, já com repetições e exceções resolvidas. */
  function expand(text, from, to, cal) {
    if (typeof ICAL === "undefined") throw { code: "no_lib" };
    let root;
    try { root = new ICAL.Component(ICAL.parse(text)); } catch (_) { throw { code: "parse" }; }
    root.getAllSubcomponents("vtimezone").forEach(tz => { try { ICAL.TimezoneService.register(tz); } catch (_) {} });

    const masters = new Map();
    const exceptions = new Map();
    root.getAllSubcomponents("vevent").forEach(v => {
      const id = v.getFirstPropertyValue("uid") || rid();
      if (v.hasProperty("recurrence-id")) {
        if (!exceptions.has(id)) exceptions.set(id, []);
        exceptions.get(id).push(v);
      } else {
        masters.set(id, v);
      }
    });

    const out = [];
    const limit = to.getTime() + 7 * 864e5; // folga para ocorrências remarcadas para dentro da janela
    const add = (item, sTime, eTime) => {
      if (String(item.component.getFirstPropertyValue("status") || "").toUpperCase() === "CANCELLED") return;
      const allDay = !!sTime.isDate;
      const s = sTime.toJSDate();
      let e = eTime ? eTime.toJSDate() : new Date(s.getTime() + (allDay ? 864e5 : 0));
      if (e < s) e = s;
      const inside = e > s ? (s < to && e > from) : (s >= from && s < to);
      if (!inside) return;
      out.push({
        title: String(item.summary || "(sem título)"),
        start: s.getTime(), end: e.getTime(), allDay,
        location: String(item.location || ""),
        cal: cal.id
      });
    };

    masters.forEach((v, id) => {
      let ev;
      try { ev = new ICAL.Event(v, { exceptions: exceptions.get(id) || [] }); } catch (_) { return; }
      exceptions.delete(id);
      if (!ev.isRecurring()) { add(ev, ev.startDate, ev.endDate); return; }
      try {
        const it = ev.iterator();
        let next, guard = 0;
        while ((next = it.next()) && guard++ < 50000) {
          if (next.toJSDate().getTime() >= limit) break;
          const d = ev.getOccurrenceDetails(next);
          add(d.item, d.startDate, d.endDate);
        }
      } catch (_) { /* regra de repetição inválida: ignora só este evento */ }
    });
    // exceções cujo evento principal não veio no arquivo
    exceptions.forEach(list => list.forEach(v => {
      try { const ev = new ICAL.Event(v); add(ev, ev.startDate, ev.endDate); } catch (_) {}
    }));
    return out;
  }

  function demoEvents() {
    const now = new Date();
    const d0 = startOfDay(now), d1 = startOfDay(now, 1);
    const at = (d, h, m = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime();
    const hourNow = now.getHours();
    return [
      { title: "Exemplo: revisar anotações da semana", start: at(d0, Math.max(0, hourNow - 2)), end: at(d0, Math.max(0, hourNow - 1)), allDay: false, location: "", cal: "demo" },
      { title: "Exemplo: reunião de projeto", start: at(d0, hourNow, 0), end: at(d0, Math.min(23, hourNow + 1), 0), allDay: false, location: "Google Meet", cal: "demo" },
      { title: "Exemplo: aula particular", start: at(d0, Math.min(22, hourNow + 2), 30), end: at(d0, Math.min(23, hourNow + 3), 30), allDay: false, location: "", cal: "demo" },
      { title: "Exemplo: entrega do trabalho", start: d1.getTime(), end: startOfDay(now, 2).getTime(), allDay: true, location: "", cal: "demo" },
      { title: "Exemplo: aula na faculdade", start: at(d1, 8), end: at(d1, 9, 40), allDay: false, location: "Campus", cal: "demo" },
      { title: "Exemplo: academia", start: at(d1, 18, 30), end: at(d1, 19, 30), allDay: false, location: "", cal: "demo" }
    ];
  }

  async function refresh() {
    if (DEMO) { events = demoEvents(); lastOk = Date.now(); loadedDay = dayKey(new Date()); render(); return; }
    if (!calendars.length) { events = []; errors = []; render(); return; }
    if (loading) return;
    loading = true;
    render();

    const now = new Date();
    const from = startOfDay(now), to = startOfDay(now, 2);
    const results = await Promise.allSettled(calendars.map(async c => expand(await fetchIcs(c.url), from, to, c)));

    const fresh = [];
    const failed = new Set();
    errors = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") fresh.push(...r.value);
      else { failed.add(calendars[i].id); errors.push({ name: calendars[i].name, code: (r.reason && r.reason.code) || "unknown" }); }
    });

    if (fresh.length || failed.size < calendars.length) {
      const sameDay = loadedDay === dayKey(now);
      events = [...events.filter(e => sameDay && failed.has(e.cal)), ...fresh];
      lastOk = Date.now();
      loadedDay = dayKey(now);
      writeJSON(CACHE_KEY, { day: loadedDay, at: lastOk, events });
    }
    loading = false;
    render();
  }

  /* ---------- Tela ---------- */
  const dayUrl = d => `${GCAL}/day/${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;

  function until(ms) {
    const m = Math.max(1, Math.round(ms / 60000));
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60), r = m % 60;
    return r ? `${h}h${pad(r)}` : `${h}h`;
  }

  function dayColumn(label, a, b, now, isToday) {
    const list = events
      .filter(e => (e.end > e.start ? e.start < b.getTime() && e.end > a.getTime() : e.start >= a.getTime() && e.start < b.getTime()))
      .sort((x, y) => (y.allDay - x.allDay) || (x.start - y.start) || x.title.localeCompare(y.title));

    let nextMarked = false;
    const items = list.map(e => {
      const s = new Date(e.start), en = new Date(e.end);
      let cls = "ev", chip = "";
      if (isToday && !e.allDay) {
        if (e.end <= now.getTime()) cls += " past";
        else if (e.start <= now.getTime()) { cls += " now"; chip = "agora"; }
        else if (!nextMarked) { nextMarked = true; cls += " next"; chip = "em " + until(e.start - now.getTime()); }
      }
      const time = e.allDay
        ? `<span class="ev-time"><b>Dia todo</b></span>`
        : `<span class="ev-time"><b>${e.start < a.getTime() ? "antes" : hhmm(s)}</b><span>${e.end > b.getTime() ? "depois" : hhmm(en)}</span></span>`;
      const color = (calById(e.cal) || {}).color || CAL_COLORS[0];
      const loc = e.location ? `<span class="ev-loc">${esc(e.location)}</span>` : "";
      return `<li><a class="${cls}" style="--ec:${color}" href="${dayUrl(a)}" target="_blank" rel="noopener noreferrer">${time}<span class="ev-main"><span class="ev-title">${esc(e.title)}</span>${loc}</span>${chip ? `<span class="ev-chip">${chip}</span>` : ""}</a></li>`;
    }).join("");

    const raw = a.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "");
    const date = raw.charAt(0).toUpperCase() + raw.slice(1);
    const empty = loading && !lastOk ? "Carregando…" : "Nada marcado";
    return `<section class="day" aria-label="${label}">
      <header class="day-head"><h3>${label}</h3><span>${esc(date)}</span></header>
      ${list.length ? `<ul class="ev-list">${items}</ul>` : `<p class="ev-empty">${empty}</p>`}
    </section>`;
  }

  function render() {
    // linha de status
    let status = "";
    let warn = false;
    if (DEMO) status = "Exemplo · conecte sua agenda no painel local";
    else if (!calendars.length) status = "Não conectada";
    else if (loading) status = "Atualizando…";
    else if (errors.length) {
      warn = true;
      status = errors.length === 1 ? `${errors[0].name}: ${message(errors[0].code)}` : `${errors.length} agendas com erro`;
    } else if (lastOk) status = `Atualizada às ${hhmm(new Date(lastOk))}`;
    el.status.textContent = status;
    el.status.title = status;
    el.status.classList.toggle("warn", warn);
    el.refresh.hidden = !calendars.length && !DEMO;

    if (!DEMO && !calendars.length) {
      el.body.className = "agenda-card setup";
      el.body.innerHTML = `
        <div class="agenda-setup">
          <span class="setup-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17"/><path d="M8 3v4M16 3v4"/></svg></span>
          <div>
            <p class="setup-title">Conecte seu Google Agenda</p>
            <p>Os compromissos de hoje e de amanhã aparecem aqui, ao lado das suas anotações.</p>
          </div>
          <button type="button" class="btn primary" data-act="settings">Conectar Google Agenda</button>
        </div>`;
      return;
    }

    const now = new Date();
    const d0 = startOfDay(now), d1 = startOfDay(now, 1), d2 = startOfDay(now, 2);
    const blocking = errors.find(e => e.code === "no_server");
    const notice = !loading && errors.length && (!lastOk || blocking)
      ? `<div class="agenda-notice"><span>${esc(blocking ? message("no_server") : message(errors[0].code))}</span><button type="button" class="btn ghost mini" data-act="retry">Tentar de novo</button></div>`
      : "";
    el.body.className = "agenda-card";
    el.body.innerHTML = notice + dayColumn("Hoje", d0, d1, now, true) + dayColumn("Amanhã", d1, d2, now, false);
  }

  /* ---------- Conectar agendas ---------- */
  function renderCalList() {
    el.list.hidden = !calendars.length;
    el.list.innerHTML = calendars.map(c => `
      <li>
        <span class="cal-dot" style="background:${c.color}"></span>
        <span class="cal-name">${esc(c.name)}</span>
        <button type="button" class="btn danger-ghost" data-remove="${esc(c.id)}">Remover</button>
      </li>`).join("");
  }

  function showErr(text) { el.err.textContent = text; el.err.hidden = !text; }

  function openSettings() {
    renderCalList();
    showErr("");
    el.dialog.showModal();
    setTimeout(() => el.url.focus(), 30);
  }

  el.list.addEventListener("click", e => {
    const b = e.target.closest("[data-remove]");
    if (!b) return;
    if (b.dataset.armed !== "1") {
      b.dataset.armed = "1";
      b.textContent = "Confirmar remoção";
      setTimeout(() => { if (b.isConnected) { b.dataset.armed = ""; b.textContent = "Remover"; } }, 3000);
      return;
    }
    const cal = calById(b.dataset.remove);
    calendars = calendars.filter(c => c.id !== b.dataset.remove);
    events = events.filter(e => e.cal !== b.dataset.remove);
    errors = [];
    saveCals();
    writeJSON(CACHE_KEY, { day: loadedDay, at: lastOk, events });
    renderCalList();
    render();
    if (cal) toast(`Agenda "${cal.name}" removida`);
  });

  el.form.addEventListener("submit", async e => {
    e.preventDefault();
    const url = el.url.value.trim();
    if (!/^(https:\/\/calendar\.google\.com\/|https:\/\/www\.google\.com\/calendar\/|webcal:\/\/calendar\.google\.com\/)/i.test(url)) {
      showErr(message("invalid_url"));
      el.url.focus();
      return;
    }
    if (calendars.some(c => c.url === url)) { showErr("Essa agenda já está conectada."); return; }

    showErr("");
    el.submit.disabled = true;
    el.submit.textContent = "Conectando…";
    try {
      const text = await fetchIcs(url);
      const cal = {
        id: rid(),
        name: (el.name.value.trim() || calName(text) || "Agenda").slice(0, 30),
        url,
        color: CAL_COLORS[calendars.length % CAL_COLORS.length]
      };
      expand(text, startOfDay(new Date()), startOfDay(new Date(), 2), cal); // confere se a agenda é legível
      calendars.push(cal);
      saveCals();
      el.url.value = "";
      el.name.value = "";
      renderCalList();
      toast(`Agenda "${cal.name}" conectada`);
      refresh();
    } catch (err) {
      showErr(message(err && err.code));
    } finally {
      el.submit.disabled = false;
      el.submit.textContent = "Conectar agenda";
    }
  });

  el.settings.addEventListener("click", openSettings);
  el.refresh.addEventListener("click", () => refresh());
  el.body.addEventListener("click", e => {
    const act = e.target.closest("[data-act]");
    if (!act) return;
    if (act.dataset.act === "settings") openSettings();
    if (act.dataset.act === "retry") refresh();
  });

  /* ---------- Relógio ---------- */
  setInterval(() => {
    if (calendars.length && loadedDay && loadedDay !== dayKey(new Date())) refresh(); // virou o dia
    else render(); // atualiza "agora" e "em X min"
  }, 30 * 1000);
  setInterval(() => { if (document.visibilityState === "visible") refresh(); }, REFRESH_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && Date.now() - lastOk > STALE_MS) refresh();
  });

  render();
  refresh();
})();
