// Dashboard admin TanggapIn: satu halaman untuk peran "dinas" dan "superadmin" (Ombudsman).
// Data dibaca langsung dari Supabase (RLS membatasi baris); semua perubahan lewat backend.
(async () => {
  "use strict";
  const C = window.APP_CONFIG || {};
  const API = String(C.API_BASE_URL || "").replace(/\/+$/, "") + "/api/v1/admin";

  const me = await AUTH.current();
  if (!me || !AUTH.ROLES.includes(me.role)) { await AUTH.logout(); return; }
  const isSuper = me.role === "superadmin";
  const myDinas = me.dinas_id;

  /* ---------- Konstanta & util ---------- */
  const STATUSES = [["diterima", "Diterima"], ["ditangani", "Ditangani"], ["selesai", "Selesai"], ["ditolak", "Ditolak"]];
  const SL = Object.fromEntries(STATUSES);
  const URG = { urgent: "Mendesak", medium: "Sedang", low: "Rendah" };
  const STALE_DAYS = 14; // "ditangani" selama ini tanpa perubahan = tanpa perkembangan
  const TZ = "Asia/Jakarta";

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text; // aman dari XSS
    return n;
  };
  const btn = (label, cls, fn) => {
    const b = el("button", "btn " + (cls || ""), label);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  };
  const chip = (t, c) => el("span", "chip " + c, t);
  const kode = (id) => String(id).slice(0, 8);
  const toD = (s) => new Date(s);
  const fmtDT = (s) => {
    const d = s ? toD(s) : null;
    return d && !isNaN(d) ? d.toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ }) : (s || "-");
  };
  const fmtD = (s) => {
    const d = s ? toD(s) : null;
    return d && !isNaN(d) ? d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: TZ }) : "-";
  };
  const daysSince = (s) => Math.floor((Date.now() - toD(s).getTime()) / 864e5);
  const initials = (name) => name.split(/\s+/).filter((w) => !/^(dan|dari)$/i.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 4500);
  }

  /* ---------- State & data ---------- */
  let dinas = [];
  let rows = [];
  let scope = { t: "semua" };
  let tab = "semua";
  const f = { q: "", urg: "semua", period: "" };
  let openId = null;
  const dinasName = (id) => (dinas.find((d) => d.id === id) || {}).nama_dinas || "Dinas " + id;

  const COLS = "id_aduan,created_at,isi_aduan,lokasi_teks,latitude,longitude,koordinat_estimasi,waktu_kejadian," +
    "deskripsi_tambahan,foto_urls,is_valid,alasan_validasi,urgensi,alasan_urgensi,dinas_ids,dinas_utama_id," +
    "alasan_dinas,status,status_dinas,ditolak_oleh,jumlah_laporan,updated_at";

  async function reload(silent) {
    try {
      const [a, d] = await Promise.all([
        AUTH.sb.from("Aduan").select(COLS).is("id_aduan_induk", null).order("created_at", { ascending: false }).limit(500),
        AUTH.sb.from("Dinas").select("id,nama_dinas").order("id"),
      ]);
      if (a.status === 401 || d.status === 401 || /jwt/i.test((a.error && a.error.message) || "")) { await AUTH.logout(); return false; }
      if (a.error) throw a.error;
      if (d.error) throw d.error;
      rows = a.data || [];
      dinas = d.data || [];
      return true;
    } catch (e) {
      console.error("Gagal memuat data:", e);
      if (!silent) throw e;
      return false;
    }
  }

  /* ---------- Turunan data ---------- */
  const ids = (r) => (r.dinas_ids || []).map(Number);
  const ctxDinas = () => (!isSuper ? myDinas : scope.t === "dinas" ? scope.id : null);
  const dStatus = (r, id) => (r.status_dinas && r.status_dinas[String(id)]) || null;
  function stOf(r) {
    const id = ctxDinas();
    const s = id != null ? dStatus(r, id) : null;
    return (s && s.status) || r.status;
  }
  function isStale(r) {
    const id = ctxDinas();
    const list = id != null ? [dStatus(r, id)] : Object.values(r.status_dinas || {});
    return list.some((s) => s && s.status === "ditangani" && s.updated_at && daysSince(s.updated_at) >= STALE_DAYS);
  }
  function inScope(r, s) {
    if (!isSuper) return r.is_valid === true && ids(r).includes(myDinas);
    switch (s.t) {
      case "triase": return r.is_valid === true && !ids(r).length;
      case "tidak_valid": return r.is_valid === false;
      case "gagal": return r.status === "gagal_diproses";
      case "dinas": return r.is_valid === true && ids(r).includes(s.id);
      default: return r.is_valid === true && r.status !== "gagal_diproses";
    }
  }
  function filterRows(list) {
    const q = f.q.trim().toLowerCase();
    const lim = Number(f.period) ? Date.now() - Number(f.period) * 864e5 : 0;
    return list.filter((r) =>
      (!q || [r.id_aduan, r.isi_aduan, r.lokasi_teks, r.deskripsi_tambahan].some((x) => String(x || "").toLowerCase().includes(q))) &&
      (f.urg === "semua" || r.urgensi === f.urg) &&
      (!lim || toD(r.created_at).getTime() >= lim));
  }
  const countBy = (list) => {
    const c = {};
    STATUSES.forEach(([k]) => (c[k] = list.filter((r) => stOf(r) === k).length));
    return c;
  };

  /* ---------- Shell: sidebar, topbar, drawer ---------- */
  function closeNav() {
    document.body.classList.remove("nav-open");
    $("menuBtn").setAttribute("aria-expanded", "false");
  }
  $("menuBtn").addEventListener("click", () => {
    const o = document.body.classList.toggle("nav-open");
    $("menuBtn").setAttribute("aria-expanded", String(o));
  });
  $("scrim").addEventListener("click", () => { closeNav(); closeDrawer(); });
  $("logout").addEventListener("click", () => AUTH.logout());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.querySelector("dialog[open]")) { closeNav(); closeDrawer(); }
  });

  let drawerReturn = null;
  function openDrawer(node) {
    const d = $("drawer");
    if (!d.classList.contains("open")) drawerReturn = document.activeElement;
    d.replaceChildren(node);
    d.classList.add("open");
    d.setAttribute("aria-hidden", "false");
    document.body.classList.add("drawer-open");
    const x = d.querySelector(".icon-btn");
    if (x) x.focus();
  }
  function closeDrawer() {
    const d = $("drawer");
    if (!d.classList.contains("open")) return;
    d.classList.remove("open");
    d.setAttribute("aria-hidden", "true");
    document.body.classList.remove("drawer-open");
    openId = null;
    if (drawerReturn && document.contains(drawerReturn)) drawerReturn.focus();
  }

  function renderNav() {
    const nav = $("nav");
    nav.replaceChildren();
    const item = (label, n, active, onClick, warn) => {
      const b = el("button", "nav-item");
      b.type = "button";
      if (active) b.setAttribute("aria-current", "page");
      b.append(el("span", "nav-name", label), el("span", "nav-count", String(n)));
      b.addEventListener("click", () => { onClick(); closeNav(); });
      return b;
    };
    const go = (s) => () => { scope = s; tab = "semua"; buildPage(); };
    if (!isSuper) {
      nav.append(item("Laporan", rows.filter((r) => inScope(r, scope)).length, true, go({ t: "semua" })));
      return;
    }
    const cnt = (s) => rows.filter((r) => inScope(r, s)).length;
    [["semua", "Semua laporan"], ["triase", "Perlu triase"], ["tidak_valid", "Tidak valid"], ["gagal", "Gagal diproses"]].forEach(([t, label]) =>
      nav.append(item(label, cnt({ t }), scope.t === t, go({ t }))));
    nav.append(el("p", "nav-title", "Per dinas"));
    dinas.forEach((d) =>
      nav.append(item(d.nama_dinas, cnt({ t: "dinas", id: d.id }), scope.t === "dinas" && scope.id === d.id, go({ t: "dinas", id: d.id }))));
  }

  /* ---------- Halaman utama ---------- */
  let statsEl, tabsEl, listEl;
  const pageTitle = () => {
    if (!isSuper) return "Ringkasan Laporan";
    if (scope.t === "dinas") return dinasName(scope.id);
    return { semua: "Semua Laporan", triase: "Perlu Triase", tidak_valid: "Laporan Tidak Valid", gagal: "Gagal Diproses" }[scope.t];
  };

  function buildPage() {
    const content = $("content");
    content.replaceChildren();
    statsEl = el("div", "stats");
    tabsEl = el("div", "tabs");
    listEl = el("div", "ticket-list");

    const tb = el("div", "toolbar");
    const s = document.createElement("input");
    s.type = "search";
    s.className = "search";
    s.placeholder = "Cari ID, isi laporan, atau lokasi";
    s.setAttribute("aria-label", "Cari laporan");
    s.value = f.q;
    s.addEventListener("input", () => { f.q = s.value; paint(); });
    const sel = (label, opts, key) => {
      const x = document.createElement("select");
      x.className = "select";
      x.setAttribute("aria-label", label);
      opts.forEach(([v, t]) => { const o = el("option", "", t); o.value = v; x.append(o); });
      x.value = f[key];
      x.addEventListener("change", () => { f[key] = x.value; paint(); });
      return x;
    };
    tb.append(s,
      sel("Filter prioritas", [["semua", "Semua prioritas"], ["urgent", "Mendesak"], ["medium", "Sedang"], ["low", "Rendah"]], "urg"),
      sel("Filter periode", [["", "Semua waktu"], ["7", "7 hari terakhir"], ["30", "30 hari terakhir"]], "period"));

    const card = el("section", "card");
    card.append(tb, tabsEl, listEl);
    content.append(el("h1", "page-title", pageTitle()), statsEl, card);
    paint();
  }

  function paint() {
    renderNav();
    if (!statsEl) return;
    const list = rows.filter((r) => inScope(r, scope));
    const base = filterRows(list);

    statsEl.replaceChildren();
    const c = countBy(list);
    [["semua", "Total Laporan", list.length], ...STATUSES.map(([k, l]) => [k, l, c[k]])].forEach(([k, l, n]) => {
      const b = el("button", "stat c-" + k);
      b.type = "button";
      b.setAttribute("aria-pressed", String(tab === k));
      b.append(el("span", "stat-label", l), el("span", "stat-num", String(n)));
      b.addEventListener("click", () => { tab = k; paint(); });
      statsEl.append(b);
    });

    tabsEl.replaceChildren();
    const cb = countBy(base);
    [["semua", "Semua", base.length], ...STATUSES.map(([k, l]) => [k, l, cb[k]])].forEach(([k, l, n]) => {
      const b = el("button", "tab");
      b.type = "button";
      b.setAttribute("aria-pressed", String(tab === k));
      b.append(l, el("span", "count", String(n)));
      b.addEventListener("click", () => { tab = k; paint(); });
      tabsEl.append(b);
    });

    const vis = tab === "semua" ? base : base.filter((r) => stOf(r) === tab);
    listEl.replaceChildren();
    if (!vis.length) listEl.append(el("p", "empty", "Tidak ada laporan yang cocok."));
    vis.forEach((r) => listEl.append(ticket(r)));
  }

  function ticket(r) {
    const st = stOf(r);
    const c = el("article", "ticket");
    const top = el("div", "ticket-top");
    top.append(el("span", "dot s-" + st), el("span", "ticket-id", kode(r.id_aduan)));
    const chips = el("div", "chips");
    chips.append(chip(SL[st] || st, "st-" + st), chip(URG[r.urgensi] || "Sedang", "urg-" + (r.urgensi || "medium")));
    if (r.is_valid === false) chips.append(chip("Tidak valid", "warn"));
    if (r.status === "gagal_diproses") chips.append(chip("Gagal diproses", "warn"));
    if (isSuper && r.is_valid === true && !ids(r).length) chips.append(chip("Perlu triase", "info"));
    if (isSuper && scope.t !== "dinas") ids(r).slice(0, 2).forEach((id) => chips.append(chip(dinasName(id), "neutral")));
    if (isSuper && scope.t !== "dinas" && ids(r).length > 2) chips.append(chip("+" + (ids(r).length - 2), "neutral"));
    if (r.jumlah_laporan > 1) chips.append(chip(r.jumlah_laporan + " laporan", "neutral"));
    if (isStale(r)) chips.append(chip("Tanpa perkembangan", "warn"));
    top.append(chips);
    c.append(top, el("h3", "ticket-title", r.isi_aduan));
    const foot = el("div", "ticket-foot");
    foot.append(el("span", "ticket-meta", fmtD(r.created_at) + " · " + (r.lokasi_teks || "-")), btn("Buka laporan", "link", () => openDetail(r.id_aduan)));
    c.append(foot);
    return c;
  }

  /* ---------- Detail laporan (drawer) ---------- */
  function openDetail(id) {
    const r = rows.find((x) => x.id_aduan === id);
    if (!r) return;
    openId = id;
    openDrawer(detail(r));
  }

  function detail(r) {
    const w = el("div", "detail");
    const head = el("div", "drawer-head");
    const left = el("div");
    left.append(el("p", "drawer-id", "Laporan " + kode(r.id_aduan)));
    const chips = el("div", "chips");
    chips.append(chip(SL[r.status] || r.status, "st-" + r.status), chip("Prioritas " + (URG[r.urgensi] || "Sedang").toLowerCase(), "urg-" + (r.urgensi || "medium")));
    if (r.is_valid === false) chips.append(chip("Tidak valid", "warn"));
    left.append(chips);
    const x = el("button", "icon-btn", "✕");
    x.type = "button";
    x.setAttribute("aria-label", "Tutup detail");
    x.addEventListener("click", closeDrawer);
    head.append(left, x);

    const body = el("div", "drawer-body");
    body.append(el("h2", "drawer-title", r.isi_aduan));
    const dl = el("dl", "dl");
    const row = (k, v) => {
      dl.append(el("dt", "", k));
      const dd = el("dd");
      if (v instanceof Node) dd.append(v); else dd.textContent = v;
      dl.append(dd);
    };
    row("Dilaporkan", fmtDT(r.created_at));
    row("Waktu kejadian", fmtDT(r.waktu_kejadian));
    const loc = el("span", "", (r.lokasi_teks || "-") + " ");
    if (r.latitude != null && r.longitude != null) {
      const a = el("a", "", "Lihat di peta");
      a.href = `https://www.google.com/maps?q=${r.latitude},${r.longitude}`;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      loc.append(a);
      if (r.koordinat_estimasi) loc.append(" (perkiraan)");
    }
    row("Lokasi", loc);
    if (r.urgensi && r.alasan_urgensi) row("Alasan prioritas", r.alasan_urgensi);
    if (isSuper) {
      row("Validasi", (r.is_valid === true ? "Valid" : r.is_valid === false ? "Tidak valid" : "Belum ditentukan") + (r.alasan_validasi ? ". " + r.alasan_validasi : ""));
      if (r.alasan_dinas) row("Alasan pilihan dinas", r.alasan_dinas);
    }
    if (r.jumlah_laporan > 1) row("Jumlah laporan", r.jumlah_laporan + " laporan untuk kejadian ini");
    body.append(dl);

    // foto (hanya URL https)
    const fotos = (r.foto_urls || []).filter((u) => /^https:\/\//.test(u));
    if (fotos.length) {
      const g = el("div", "gallery");
      fotos.forEach((u, i) => {
        const a = el("a");
        a.href = u; a.target = "_blank"; a.rel = "noopener noreferrer";
        const im = document.createElement("img");
        im.src = u; im.alt = "Foto laporan " + (i + 1); im.loading = "lazy";
        a.append(im);
        g.append(a);
      });
      body.append(el("h3", "sect", "Foto"), g);
    }

    if (r.deskripsi_tambahan) {
      body.append(el("h3", "sect", "Keterangan tambahan"));
      const box = el("div", "qa-box");
      r.deskripsi_tambahan.split("\n").filter((l) => l.trim()).forEach((l) => {
        const m = l.match(/^\s*([TJ]):\s*(.*)$/);
        const p = el("p", "qa-line");
        if (m) p.append(el("strong", "", m[1] === "T" ? "Tanya: " : "Jawab: "), m[2]); else p.textContent = l;
        box.append(p);
      });
      body.append(box);
    }

    // status per dinas
    const dlist = isSuper ? ids(r) : [myDinas];
    body.append(el("h3", "sect", isSuper ? "Status per dinas" : "Status dinas"));
    if (!dlist.length) body.append(el("p", "muted", "Belum ada dinas terkait. Atur dinas terlebih dahulu."));
    dlist.forEach((id) => {
      const s = dStatus(r, id) || {};
      const box = el("div", "dinas-status");
      const top = el("div", "ds-top");
      top.append(el("strong", "", dinasName(id)), chip(SL[s.status] || s.status || "-", "st-" + s.status));
      box.append(top);
      if (s.updated_at) box.append(el("p", "muted", "Diperbarui " + fmtDT(s.updated_at) + (s.status === "ditangani" && daysSince(s.updated_at) >= STALE_DAYS ? " · tanpa perkembangan" : "")));
      if (s.alasan) box.append(el("p", "note bad", "Alasan penolakan: " + s.alasan));
      const acts = rowActions(r, id, s.status);
      if (acts.length) { const a = el("div", "actions"); a.append(...acts); box.append(a); }
      body.append(box);
    });
    if (r.status === "ditolak" && r.ditolak_oleh) body.append(el("p", "note bad", "Ditolak oleh: " + r.ditolak_oleh));

    // laporan terkait (anak)
    if (r.jumlah_laporan > 1) {
      body.append(el("h3", "sect", "Laporan terkait"));
      const box = el("div", "children");
      box.append(el("p", "muted", "Memuat..."));
      body.append(box);
      loadChildren(r, box);
    }

    w.append(head, body);
    if (isSuper) {
      const acts = [];
      if (r.is_valid === false) acts.push(btn("Validasi ulang", "primary", () => validasiUlang(r)));
      if (r.is_valid === true) acts.push(btn("Atur dinas", "", () => aturDinas(r)));
      if (acts.length) { const foot = el("div", "drawer-foot"); foot.append(...acts); w.append(foot); }
    }
    return w;
  }

  async function loadChildren(r, box) {
    const { data, error } = await AUTH.sb.from("Aduan").select("id_aduan,created_at,lokasi_teks")
      .eq("id_aduan_induk", r.id_aduan).order("created_at");
    box.replaceChildren();
    if (error || !data || !data.length) { box.append(el("p", "muted", error ? "Gagal memuat laporan terkait." : "Tidak ada laporan terkait.")); return; }
    data.forEach((c) => box.append(el("p", "child", fmtDT(c.created_at) + " · " + (c.lokasi_teks || "-"))));
  }

  /* ---------- Aksi (lewat backend) ---------- */
  function rowActions(r, id, st) {
    if (r.is_valid !== true) return [];
    const a = [];
    if (st === "diterima") a.push(btn("Tangani", "primary", () => tangani(r, id)));
    if (st === "ditangani") a.push(btn("Selesai", "primary", () => selesai(r, id)));
    if (st === "diterima" || st === "ditangani") a.push(btn("Tolak", "danger", () => tolak(r, id)));
    return a;
  }

  async function call(method, path, body) {
    const t = await AUTH.token();
    if (!t) { await AUTH.logout(); return null; }
    let res;
    try {
      res = await fetch(API + path, {
        method,
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + t },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
    } catch (e) {
      throw Object.assign(new Error("Koneksi bermasalah. Coba lagi."), { code: "network" });
    }
    let json = null;
    try { json = await res.json(); } catch (e) { /* bukan JSON */ }
    if (!res.ok) {
      throw Object.assign(new Error((json && json.error && json.error.message) || "Terjadi kesalahan pada server."),
        { code: json && json.error && json.error.code, status: res.status });
    }
    return json;
  }

  async function run(fn, okMsg) {
    try {
      const res = await fn();
      if (!res) return;
      const i = rows.findIndex((x) => x.id_aduan === res.id_aduan);
      if (i >= 0) rows[i] = Object.assign({}, rows[i], res);
      toast(okMsg);
      paint();
      if (openId) openDetail(openId);
    } catch (e) {
      if (e.status === 401) { await AUTH.logout(); return; }
      toast(e.message);
      // data di layar kemungkinan usang: muat ulang
      if (e.status === 409 || e.status === 404) { await reload(true); paint(); if (openId) openDetail(openId); }
    }
  }

  const tangani = async (r, id) => {
    if (await dialog({ title: "Tangani laporan?", intro: kode(r.id_aduan) + ": " + r.isi_aduan, submit: "Tangani" }))
      run(() => call("PATCH", `/aduan/${r.id_aduan}/status`, { id_dinas: id, status: "ditangani", alasan: null }), "Laporan ditandai sedang ditangani.");
  };
  const selesai = async (r, id) => {
    if (await dialog({ title: "Tandai selesai?", intro: "Status selesai bersifat final dan tidak bisa diubah lagi.", submit: "Tandai selesai" }))
      run(() => call("PATCH", `/aduan/${r.id_aduan}/status`, { id_dinas: id, status: "selesai", alasan: null }), "Laporan ditandai selesai.");
  };
  const tolak = async (r, id) => {
    const d = await dialog({
      title: "Tolak laporan", intro: kode(r.id_aduan) + ": " + r.isi_aduan, submit: "Tolak laporan", danger: true,
      field: { label: "Alasan penolakan", hint: "Wajib diisi. Alasan ini bersifat final.", min: 5 },
    });
    if (d) run(() => call("PATCH", `/aduan/${r.id_aduan}/status`, { id_dinas: id, status: "ditolak", alasan: d.value }), "Laporan ditolak.");
  };
  const validasiUlang = async (r) => {
    if (await dialog({ title: "Validasi ulang?", intro: "Laporan yang ditolak sistem akan dinyatakan valid dan dapat diproses dinas.", submit: "Validasi ulang" }))
      run(() => call("PATCH", `/aduan/${r.id_aduan}/validitas`, { is_valid: true }), "Laporan dinyatakan valid.");
  };
  const aturDinas = async (r) => {
    const d = await dinasDialog(r);
    if (d) run(() => call("PUT", `/aduan/${r.id_aduan}/dinas`, d), "Dinas terkait diperbarui.");
  };

  /* ---------- Dialog ---------- */
  function shell(title, intro) {
    const dlg = el("dialog", "dlg"), form = el("form", "dlg-form");
    form.append(el("h2", "", title));
    if (intro) form.append(el("p", "dlg-intro", intro));
    return { dlg, form };
  }
  function finish(dlg, form, ok, resolve, getResult, validate) {
    const err = el("p", "dlg-err");
    err.setAttribute("role", "alert");
    const row = el("div", "dlg-actions");
    row.append(btn("Batal", "", () => dlg.close()), ok);
    form.append(err, row);
    let result = null;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const msg = validate ? validate() : "";
      if (msg) { err.textContent = msg; return; }
      result = getResult();
      dlg.close();
    });
    dlg.addEventListener("close", () => { dlg.remove(); resolve(result); });
    dlg.append(form);
    document.body.append(dlg);
    dlg.showModal();
  }

  function dialog(cfg) {
    return new Promise((resolve) => {
      const { dlg, form } = shell(cfg.title, cfg.intro);
      let ta = null;
      if (cfg.field) {
        const lab = el("label", "dlg-field");
        lab.append(el("span", "", cfg.field.label));
        ta = document.createElement("textarea");
        ta.rows = 4;
        lab.append(ta);
        if (cfg.field.hint) lab.append(el("small", "", cfg.field.hint));
        form.append(lab);
      }
      const ok = el("button", "btn " + (cfg.danger ? "danger-solid" : "primary"), cfg.submit || "Simpan");
      ok.type = "submit";
      finish(dlg, form, ok, resolve, () => ({ value: ta ? ta.value.trim() : "" }),
        () => (ta && ta.value.trim().length < cfg.field.min ? "Tulis minimal " + cfg.field.min + " karakter." : ""));
    });
  }

  function dinasDialog(r) {
    return new Promise((resolve) => {
      const { dlg, form } = shell("Atur dinas terkait", kode(r.id_aduan) + ": " + r.isi_aduan);
      const cur = new Set(ids(r));
      const utama = r.dinas_utama_id != null ? Number(r.dinas_utama_id) : null;
      const box = el("div", "dinas-pick");
      box.append(el("p", "muted", "Centang dinas terkait, lalu pilih satu sebagai dinas utama."));
      const picks = dinas.map((d) => {
        const row = el("div", "dinas-row");
        const l1 = el("label", "dinas-main"), l2 = el("label", "dinas-utama");
        const cb = document.createElement("input");
        cb.type = "checkbox"; cb.checked = cur.has(d.id);
        const rd = document.createElement("input");
        rd.type = "radio"; rd.name = "utama"; rd.checked = d.id === utama;
        rd.addEventListener("change", () => { cb.checked = true; });
        l1.append(cb, d.nama_dinas);
        l2.append(rd, "utama");
        row.append(l1, l2);
        box.append(row);
        return { id: d.id, cb, rd };
      });
      form.append(box);
      const ok = el("button", "btn primary", "Simpan");
      ok.type = "submit";
      const chosen = () => picks.filter((p) => p.cb.checked);
      finish(dlg, form, ok, resolve,
        () => { const c = chosen(); const u = c.find((p) => p.rd.checked) || c[0]; return { dinas_ids: c.map((p) => p.id), dinas_utama_id: u.id }; },
        () => (chosen().length ? "" : "Pilih minimal satu dinas."));
    });
  }

  /* ---------- Mulai ---------- */
  $("roleLabel").textContent = isSuper ? "Panel Ombudsman" : "Panel Dinas";
  $("content").append(el("p", "empty", "Memuat laporan..."));

  async function start() {
    try {
      await reload(false);
    } catch (e) {
      const box = el("div", "empty");
      box.append(el("p", "", "Gagal memuat data. Periksa koneksi atau hak akses akunmu."), btn("Coba lagi", "primary", () => { $("content").replaceChildren(); start(); }));
      $("content").replaceChildren(box);
      return;
    }
    const name = isSuper ? "Ombudsman" : dinasName(myDinas);
    $("whoName").textContent = name;
    $("avatar").textContent = initials(name);
    buildPage();
  }
  await start();

  // segarkan tiap 30 detik (Realtime belum aktif)
  setInterval(async () => {
    if (document.hidden || document.querySelector("dialog[open]") || !statsEl) return;
    const before = openId ? (rows.find((x) => x.id_aduan === openId) || {}).updated_at : null;
    if (await reload(true)) {
      paint();
      const now = openId ? (rows.find((x) => x.id_aduan === openId) || {}).updated_at : null;
      if (openId && now !== before) openDetail(openId);
    }
  }, 30000);
})();