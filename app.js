/* Event Checklist — communications tracker
   Data seeded from the original spreadsheet (data.js); edits persist to localStorage. */
(() => {
"use strict";

const STORE_KEY = "event-checklist-v1";
const CHANNELS = window.SEED_DATA.channels;
const CHAN_ABBR = {
  some: "SoMe", news: "News", events: "Events", web: "Web", poster: "Poster",
  mail: "Mail", uni: "Uni site", cover: "Cover", recap: "Recap",
};

const PERSON_COLORS = {
  DB: "#2563eb", NW: "#059669", LH: "#7c3aed", JH: "#d97706", CJ: "#0d9488",
  BND: "#db2777", AC: "#0891b2", Dani: "#65a30d", Nina: "#ea580c", Aze: "#64748b",
};
const FALLBACK_PALETTE = ["#4f46e5", "#b91c1c", "#0369a1", "#a16207", "#15803d", "#9d174d"];
function personColor(p) {
  if (PERSON_COLORS[p]) return PERSON_COLORS[p];
  let h = 0;
  for (const ch of p) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK_PALETTE[h % FALLBACK_PALETTE.length];
}

/* ---------- state & persistence ---------- */
let data;           // { "2025": [events], "2026": [events], ... }
let state = { year: null, view: "timeline", search: "", status: "all", person: "all" };

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved && saved.years) return saved.years;
  } catch (_) { /* corrupted store — fall back to seed */ }
  return JSON.parse(JSON.stringify(window.SEED_DATA.years));
}
function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify({ years: data }));
  if (window.CloudSync && window.CloudSync.enabled) window.CloudSync.push(data); // live team sync (optional)
}

/* Bridge for the optional cloud-sync layer (sync.js). These are no-ops unless
   Supabase is configured in config.js. */
let pendingRemote = null;
function applyRemoteData(years) {
  if (!years || typeof years !== "object") return;
  data = years;
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ years: data })); } catch (_) {}
  if (!data[state.year]) {
    const ys = Object.keys(data).sort();
    if (ys.length) state.year = ys[ys.length - 1];
  }
  refreshPersonFilter();
  render();
}
window.__getLocalData = () => data;
window.__applyRemoteData = (years) => {
  // don't yank an open assignment editor out from under someone mid-edit
  if (!document.getElementById("popover").hidden) { pendingRemote = years; return; }
  applyRemoteData(years);
};

/* ---------- helpers ---------- */
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_S = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function parseISO(s) { return s ? new Date(s + "T00:00:00") : null; }
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function eventStatus(ev) {
  if (ev.done) return "done";
  const assigned = Object.values(ev.channels).some(v => v && v !== "-");
  return assigned ? "progress" : "planned";
}
function statusLabel(s) { return s === "done" ? "Done" : s === "progress" ? "In progress" : "Planned"; }

function channelProgress(ev) {
  let applicable = 0, handled = 0;
  for (const c of CHANNELS) {
    const v = ev.channels[c.key];
    if (v === "-") continue;
    applicable++;
    if (v) handled++;
  }
  return { applicable, handled };
}

function assignees(v) {
  return (v && v !== "-") ? v.split(",").map(s => s.trim()).filter(Boolean) : [];
}

function allPeople() {
  const set = new Set(window.SEED_DATA.people);
  for (const evs of Object.values(data))
    for (const ev of evs)
      for (const v of Object.values(ev.channels))
        assignees(v).forEach(p => set.add(p));
  return [...set].sort((a, b) => a.localeCompare(b));
}

function typeClass(t) {
  if (t === "JCMML Lecture") return "t-jcmml";
  if (t === "Workshop") return "t-workshop";
  if (t === "Conference" || t === "Panel") return "t-conference";
  if (t === "Film Screening") return "t-film";
  if (t === "Book Event" || t === "Reading") return "t-book";
  if (t === "Exhibition") return "t-exhibition";
  return "";
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function sortedEvents(year) {
  return [...(data[year] || [])].sort((a, b) => {
    if (!a.start) return 1;
    if (!b.start) return -1;
    return a.start.localeCompare(b.start);
  });
}

function filteredEvents(year) {
  const q = state.search.trim().toLowerCase();
  return sortedEvents(year).filter(ev => {
    if (q && !ev.title.toLowerCase().includes(q)) return false;
    if (state.status !== "all" && eventStatus(ev) !== state.status) return false;
    if (state.person !== "all") {
      const involved = Object.values(ev.channels).some(v => assignees(v).includes(state.person));
      if (!involved) return false;
    }
    return true;
  });
}

function findEvent(id) {
  for (const evs of Object.values(data)) {
    const ev = evs.find(e => e.id === id);
    if (ev) return ev;
  }
  return null;
}

/* ---------- header ---------- */
function renderHeader() {
  const evs = data[state.year] || [];
  const done = evs.filter(e => eventStatus(e) === "done").length;
  const progress = evs.filter(e => eventStatus(e) === "progress").length;
  const planned = evs.length - done - progress;
  const pct = evs.length ? Math.round(done / evs.length * 100) : 0;

  const C = 2 * Math.PI * 30;
  const fg = document.getElementById("ringFg");
  fg.style.strokeDasharray = C;
  fg.style.strokeDashoffset = C * (1 - pct / 100);
  document.getElementById("ringPct").textContent = pct + "%";

  const today = todayISO();
  const next = sortedEvents(state.year).find(e => e.start && e.start >= today);
  let nextTxt = "—";
  if (next) {
    const days = Math.round((parseISO(next.start) - parseISO(today)) / 864e5);
    nextTxt = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  }

  document.getElementById("headerStats").innerHTML = `
    <div class="hstat"><b>${evs.length}</b><span>Events</span></div>
    <div class="hstat"><b>${done}</b><span>Done</span></div>
    <div class="hstat"><b>${progress}</b><span>In progress</span></div>
    <div class="hstat"><b>${planned}</b><span>Planned</span></div>
    <div class="hstat"><b>${nextTxt}</b><span>Next event</span></div>`;
}

/* ---------- timeline view ---------- */
function dateBlock(ev) {
  const d = parseISO(ev.start);
  if (!d) return `<div class="date-block"><div class="day">?</div></div>`;
  const multi = ev.end && ev.end !== ev.start;
  const e = parseISO(ev.end);
  return `<div class="date-block">
    <div class="dow">${DOW[d.getDay()]}</div>
    <div class="day">${d.getDate()}</div>
    <div class="mon">${MONTHS_S[d.getMonth()]}</div>
    ${multi ? `<div class="range">→ ${e.getDate()} ${MONTHS_S[e.getMonth()]}</div>` : ""}
  </div>`;
}

function channelChips(ev) {
  return `<div class="channel-row">` + CHANNELS.map(c => {
    const v = ev.channels[c.key];
    let cls = "chan", inner;
    if (v === "-") { cls += " is-na"; inner = `<span class="chan-na">–</span>`; }
    else if (!v) { cls += " is-pending"; inner = `<span class="chan-pending" title="unassigned"></span>`; }
    else inner = assignees(v).map(p =>
      `<span class="pchip" style="background:${personColor(p)}">${esc(p)}</span>`).join("");
    return `<button class="${cls}" data-edit="${ev.id}" data-chan="${c.key}" title="${esc(c.label)} — click to assign">
      <span class="chan-label">${CHAN_ABBR[c.key]}</span>
      <span class="chan-value">${inner}</span>
    </button>`;
  }).join("") + `</div>`;
}

function renderTimeline(root) {
  const evs = filteredEvents(state.year);
  if (!evs.length) {
    root.innerHTML = `<div class="empty-state"><b>No events match</b>Try clearing the search or filters.</div>`;
    return;
  }
  const today = todayISO();
  const nextId = (sortedEvents(state.year).find(e => e.start && e.start >= today) || {}).id;

  const groups = new Map();
  for (const ev of evs) {
    const d = parseISO(ev.start);
    const key = d ? `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}` : "zzz";
    if (!groups.has(key)) groups.set(key, { label: d ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : "Undated", items: [] });
    groups.get(key).items.push(ev);
  }

  let html = "";
  for (const [, g] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    html += `<section class="month-group"><h2 class="month-header">${g.label}<span class="count">${g.items.length} event${g.items.length > 1 ? "s" : ""}</span></h2>`;
    for (const ev of g.items) {
      const st = eventStatus(ev);
      const { applicable, handled } = channelProgress(ev);
      const isNext = ev.id === nextId;
      html += `<article class="event-card ${isNext ? "is-next" : ""}" data-id="${ev.id}">
        ${dateBlock(ev)}
        <div class="event-body">
          <div class="event-top">
            <h3 class="event-title">${esc(ev.title)}</h3>
            <div class="badges">
              ${isNext ? `<span class="next-badge">Next up</span>` : ""}
              <span class="tag ${typeClass(ev.type)}">${esc(ev.type)}</span>
              <span class="status-pill s-${st}">${statusLabel(st)}</span>
              <button class="done-toggle ${ev.done ? "on" : ""}" data-toggle="${ev.id}" title="Mark ${ev.done ? "not done" : "done"}">✓</button>
              <button class="delete-btn" data-del="${ev.id}" title="Delete event">✕</button>
            </div>
          </div>
          ${channelChips(ev)}
          ${applicable ? `<div class="progress-note"><span class="bar"><i style="width:${Math.round(handled / applicable * 100)}%"></i></span>${handled} of ${applicable} channels handled</div>` : ""}
        </div>
      </article>`;
    }
    html += `</section>`;
  }
  root.innerHTML = html;
}

/* ---------- matrix view ---------- */
function fmtDateShort(ev) {
  const d = parseISO(ev.start);
  if (!d) return "—";
  const s = `${String(d.getDate()).padStart(2, "0")} ${MONTHS_S[d.getMonth()]}`;
  if (ev.end && ev.end !== ev.start) {
    const e = parseISO(ev.end);
    return `${d.getDate()}–${e.getDate()} ${MONTHS_S[e.getMonth()]}`;
  }
  return s;
}

function renderMatrix(root) {
  const evs = filteredEvents(state.year);
  if (!evs.length) {
    root.innerHTML = `<div class="empty-state"><b>No events match</b>Try clearing the search or filters.</div>`;
    return;
  }
  let html = `<div class="matrix-wrap"><table class="matrix"><thead><tr>
    <th>Date</th><th>Event</th>` +
    CHANNELS.map(c => `<th title="${esc(c.label)}">${CHAN_ABBR[c.key]}</th>`).join("") +
    `<th>Done</th></tr></thead><tbody>`;
  for (const ev of evs) {
    html += `<tr><td class="cell-date">${fmtDateShort(ev)}</td><td class="cell-title">${esc(ev.title)}</td>`;
    for (const c of CHANNELS) {
      const v = ev.channels[c.key];
      let inner;
      if (v === "-") inner = `<span class="chan-na">–</span>`;
      else if (!v) inner = `<span class="chan-pending"></span>`;
      else inner = assignees(v).map(p =>
        `<span class="pchip" style="background:${personColor(p)}">${esc(p)}</span>`).join(" ");
      html += `<td class="cell-chan" data-edit="${ev.id}" data-chan="${c.key}" title="${esc(c.label)} — click to assign">${inner}</td>`;
    }
    html += `<td class="cell-done"><button class="done-toggle ${ev.done ? "on" : ""}" data-toggle="${ev.id}" title="Toggle done">✓</button></td></tr>`;
  }
  html += `</tbody></table></div>`;
  root.innerHTML = html;
}

/* ---------- team view ---------- */
function renderTeam(root) {
  const evs = sortedEvents(state.year);
  const today = todayISO();
  const stats = new Map();
  for (const ev of evs) {
    for (const c of CHANNELS) {
      for (const p of assignees(ev.channels[c.key])) {
        if (!stats.has(p)) stats.set(p, { total: 0, byChan: {}, upcoming: [] });
        const s = stats.get(p);
        s.total++;
        s.byChan[c.key] = (s.byChan[c.key] || 0) + 1;
        if (ev.start && ev.start >= today && !ev.done)
          s.upcoming.push({ ev, chan: c.key });
      }
    }
  }
  if (!stats.size) {
    root.innerHTML = `<div class="empty-state"><b>No assignments yet</b>Assign people to channels in the Timeline or Matrix view.</div>`;
    return;
  }
  const people = [...stats.entries()].sort((a, b) => b[1].total - a[1].total);
  let html = `<div class="team-grid">`;
  for (const [p, s] of people) {
    const upcoming = s.upcoming.slice(0, 5);
    html += `<div class="team-card">
      <div class="team-head">
        <div class="avatar" style="background:${personColor(p)}">${esc(p.slice(0, 3))}</div>
        <div><b>${esc(p)}</b><span>${s.total} task${s.total > 1 ? "s" : ""} in ${state.year}</span></div>
      </div>
      <div class="team-breakdown">` +
      CHANNELS.filter(c => s.byChan[c.key]).map(c =>
        `<span class="tb-item">${CHAN_ABBR[c.key]} <b>${s.byChan[c.key]}</b></span>`).join("") +
      `</div>
      <div class="team-upcoming"><h4>Upcoming tasks</h4>` +
      (upcoming.length
        ? `<ul>` + upcoming.map(u =>
            `<li><span class="d">${fmtDateShort(u.ev)}</span><span>${CHAN_ABBR[u.chan]} · ${esc(u.ev.title)}</span></li>`).join("") + `</ul>`
        : `<span class="none">Nothing pending 🎉</span>`) +
      `</div></div>`;
  }
  html += `</div>`;
  root.innerHTML = html;
}

/* ---------- assignment popover ---------- */
const popover = document.getElementById("popover");
let popCtx = null; // { evId, chanKey }

function openPopover(anchor, evId, chanKey) {
  const ev = findEvent(evId);
  if (!ev) return;
  popCtx = { evId, chanKey };
  const current = new Set(assignees(ev.channels[chanKey]));
  const chanLabel = CHANNELS.find(c => c.key === chanKey).label;

  popover.innerHTML = `
    <h5>${esc(chanLabel)}</h5>
    <div class="pop-people">` +
    allPeople().map(p => {
      const sel = current.has(p);
      const col = personColor(p);
      return `<button data-person="${esc(p)}" class="${sel ? "sel" : ""}"
        style="${sel ? `background:${col};border-color:${col}` : ""}">${esc(p)}</button>`;
    }).join("") +
    `</div>
    <div class="pop-row">
      <button class="btn" data-act="na" title="Channel not applicable for this event">N/A (–)</button>
      <button class="btn" data-act="clear" title="Clear — leave unassigned">Clear</button>
    </div>
    <div class="pop-add">
      <input type="text" placeholder="New initials…" maxlength="12">
      <button class="btn" data-act="add">Add</button>
    </div>`;

  popover.hidden = false;
  const r = anchor.getBoundingClientRect();
  const pw = 240;
  let left = window.scrollX + r.left;
  if (left + pw > window.scrollX + document.documentElement.clientWidth - 12)
    left = window.scrollX + r.right - pw;
  popover.style.left = Math.max(8, left) + "px";
  popover.style.top = window.scrollY + r.bottom + 6 + "px";
}

function closePopover() {
  popover.hidden = true;
  popCtx = null;
  if (pendingRemote) { const y = pendingRemote; pendingRemote = null; applyRemoteData(y); }
}

popover.addEventListener("click", e => {
  e.stopPropagation(); // keep the document-level "click outside" handler out of popover clicks
  if (!popCtx) return;
  const ev = findEvent(popCtx.evId);
  const personBtn = e.target.closest("[data-person]");
  const actBtn = e.target.closest("[data-act]");
  if (personBtn) {
    const p = personBtn.dataset.person;
    const cur = new Set(assignees(ev.channels[popCtx.chanKey]));
    cur.has(p) ? cur.delete(p) : cur.add(p);
    ev.channels[popCtx.chanKey] = cur.size ? [...cur].join(", ") : null;
  } else if (actBtn) {
    const act = actBtn.dataset.act;
    if (act === "na") ev.channels[popCtx.chanKey] = "-";
    else if (act === "clear") ev.channels[popCtx.chanKey] = null;
    else if (act === "add") {
      const input = popover.querySelector(".pop-add input");
      const p = input.value.trim();
      if (!p) return;
      const cur = new Set(assignees(ev.channels[popCtx.chanKey]));
      cur.add(p);
      ev.channels[popCtx.chanKey] = [...cur].join(", ");
      input.value = "";
    }
  } else return;
  save();
  const { evId, chanKey } = popCtx;
  render(); // refresh views under the popover
  // re-anchor to the (re-rendered) chip and keep editing
  const anchor = document.querySelector(`[data-edit="${evId}"][data-chan="${chanKey}"]`);
  if (anchor) openPopover(anchor, evId, chanKey); else closePopover();
});

document.addEventListener("click", e => {
  if (!popover.hidden && !popover.contains(e.target) && !e.target.closest("[data-edit]"))
    closePopover();
});
document.addEventListener("keydown", e => { if (e.key === "Escape") closePopover(); });

/* ---------- main render ---------- */
function render() {
  renderHeader();
  renderYearTabs();
  const root = document.getElementById("mainView");
  if (state.view === "timeline") renderTimeline(root);
  else if (state.view === "matrix") renderMatrix(root);
  else renderTeam(root);
}

function renderYearTabs() {
  const tabs = document.getElementById("yearTabs");
  const years = Object.keys(data).sort();
  tabs.innerHTML = years.map(y =>
    `<button data-year="${y}" class="${y === state.year ? "active" : ""}">${y}</button>`).join("");
}

function refreshPersonFilter() {
  const sel = document.getElementById("personFilter");
  const cur = sel.value || "all";
  sel.innerHTML = `<option value="all">Everyone</option>` +
    allPeople().map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join("");
  sel.value = [...sel.options].some(o => o.value === cur) ? cur : "all";
}

/* ---------- events wiring ---------- */
document.getElementById("yearTabs").addEventListener("click", e => {
  const b = e.target.closest("[data-year]");
  if (!b) return;
  state.year = b.dataset.year;
  closePopover();
  render();
});

document.getElementById("viewSwitch").addEventListener("click", e => {
  const b = e.target.closest("[data-view]");
  if (!b) return;
  state.view = b.dataset.view;
  document.querySelectorAll("#viewSwitch button").forEach(x => x.classList.toggle("active", x === b));
  closePopover();
  render();
});

document.getElementById("searchBox").addEventListener("input", e => {
  state.search = e.target.value;
  render();
});

document.getElementById("statusPills").addEventListener("click", e => {
  const b = e.target.closest("[data-status]");
  if (!b) return;
  state.status = b.dataset.status;
  document.querySelectorAll("#statusPills button").forEach(x => x.classList.toggle("active", x === b));
  render();
});

document.getElementById("personFilter").addEventListener("change", e => {
  state.person = e.target.value;
  render();
});

// delegated clicks inside the main view: assign, toggle done, delete
document.getElementById("mainView").addEventListener("click", e => {
  const edit = e.target.closest("[data-edit]");
  if (edit) { e.stopPropagation(); openPopover(edit, edit.dataset.edit, edit.dataset.chan); return; }
  const tog = e.target.closest("[data-toggle]");
  if (tog) {
    const ev = findEvent(tog.dataset.toggle);
    ev.done = !ev.done;
    save(); render();
    return;
  }
  const del = e.target.closest("[data-del]");
  if (del) {
    const ev = findEvent(del.dataset.del);
    if (confirm(`Delete "${ev.title}"?`)) {
      for (const y of Object.keys(data)) data[y] = data[y].filter(x => x.id !== ev.id);
      save(); refreshPersonFilter(); render();
    }
  }
});

/* ---------- add event ---------- */
const EVENT_TYPES = [
  "JCMML Lecture", "Workshop", "Conference", "Panel", "Film Screening",
  "Book Event", "Exhibition", "Lecture", "Reading", "Special",
];

function guessType(title) {
  const t = title.toLowerCase();
  if (t.includes("jcmml")) return "JCMML Lecture";
  if (t.includes("workshop")) return "Workshop";
  if (t.includes("conference")) return "Conference";
  if (t.includes("film")) return "Film Screening";
  if (t.includes("book")) return "Book Event";
  if (t.includes("panel")) return "Panel";
  if (t.includes("exhibition")) return "Exhibition";
  if (t.includes("lecture")) return "Lecture";
  if (t.includes("reading")) return "Reading";
  return "Special";
}

const dlg = document.getElementById("addDialog");
const newTitle = document.getElementById("newTitle");
const newType = document.getElementById("newType");
let typeTouched = false; // once the user picks a type, stop auto-guessing

// one-time population of the type dropdown and channel toggles
newType.innerHTML = EVENT_TYPES.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
document.getElementById("newChannels").innerHTML = CHANNELS.map(c =>
  `<label class="chan-toggle"><input type="checkbox" value="${c.key}" checked>${esc(c.label)}</label>`).join("");

function openAddDialog() {
  document.getElementById("addForm").reset();
  document.getElementById("newStart").value = todayISO();
  document.getElementById("newChannels").querySelectorAll("input").forEach(i => (i.checked = true));
  typeTouched = false;
  newType.value = "Special";
  dlg.showModal();
  newTitle.focus();
}

document.getElementById("addEventBtn").addEventListener("click", openAddDialog);
document.getElementById("fabAdd").addEventListener("click", openAddDialog);
document.getElementById("cancelAdd").addEventListener("click", () => dlg.close());

// live-guess the type from the title until the user overrides it
newTitle.addEventListener("input", () => {
  if (!typeTouched) newType.value = guessType(newTitle.value.trim());
});
newType.addEventListener("change", () => { typeTouched = true; });

// press "N" anywhere (outside a text field) to add an event
document.addEventListener("keydown", e => {
  if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "select" || tag === "textarea" || dlg.open) return;
  e.preventDefault();
  openAddDialog();
});

document.getElementById("addForm").addEventListener("submit", () => {
  const title = newTitle.value.trim();
  const start = document.getElementById("newStart").value;
  const end = document.getElementById("newEnd").value || start;
  if (!title || !start) return;
  const year = start.slice(0, 4);
  if (!data[year]) data[year] = [];
  const needed = new Set(
    [...document.getElementById("newChannels").querySelectorAll("input:checked")].map(i => i.value));
  const channels = {};
  for (const c of CHANNELS) channels[c.key] = needed.has(c.key) ? null : "-";
  data[year].push({
    id: "u" + Date.now().toString(36),
    start, end, title,
    type: newType.value || guessType(title),
    channels,
    done: false,
  });
  save();
  state.year = year;
  state.search = "";
  document.getElementById("searchBox").value = "";
  render();
});

/* ---------- export CSV ---------- */
function fmtDateCSV(ev) {
  const d = parseISO(ev.start);
  if (!d) return "";
  const p2 = n => String(n).padStart(2, "0");
  if (ev.end && ev.end !== ev.start) {
    const e = parseISO(ev.end);
    return `${p2(d.getDate())}.-${p2(e.getDate())}.${p2(e.getMonth() + 1)}.${e.getFullYear()}`;
  }
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

document.getElementById("exportCsvBtn").addEventListener("click", () => {
  const rows = [["Date", "Event", ...CHANNELS.map(c => c.label), "Done"]];
  for (const ev of sortedEvents(state.year)) {
    rows.push([
      fmtDateCSV(ev), ev.title,
      ...CHANNELS.map(c => ev.channels[c.key] ?? ""),
      ev.done ? "Yes" : "",
    ]);
  }
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `event-checklist-${state.year}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
});

/* ---------- reset ---------- */
document.getElementById("resetBtn").addEventListener("click", () => {
  const cloud = window.CloudSync && window.CloudSync.enabled;
  const msg = cloud
    ? "Reset the SHARED data back to the original spreadsheet? This replaces everyone's changes for the whole team."
    : "Discard all local edits and restore the original spreadsheet data?";
  if (!confirm(msg)) return;
  localStorage.removeItem(STORE_KEY);
  data = load();
  if (!data[state.year]) state.year = Object.keys(data).sort().pop();
  refreshPersonFilter();
  render();
  if (cloud) window.CloudSync.push(data); // propagate the reset to the team
});

/* ---------- init ---------- */
data = load();
const years = Object.keys(data).sort();
const thisYear = String(new Date().getFullYear());
state.year = years.includes(thisYear) ? thisYear : years[years.length - 1];
refreshPersonFilter();
render();

})();
