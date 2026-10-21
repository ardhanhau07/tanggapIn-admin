// Inti dashboard Ombudsman & Dinas: data contoh, penyimpanan, dan komponen UI bersama.
// DEMO: data disimpan di localStorage browser. Ganti fungsi data dengan panggilan API backend.
window.TG = (() => {
  "use strict";
  const KEY = "tanggapin_demo_v1";
  const STAGNAN_HARI = 14; // "ditangani" >= sekian hari tanpa perubahan dianggap tidak berkembang
  const STATUSES = [
    { key: "diterima", label: "Diterima" },
    { key: "ditangani", label: "Ditangani" },
    { key: "selesai", label: "Selesai" },
    { key: "ditolak", label: "Ditolak" },
  ];
  const DINAS = [
    { id: "dpu", nama: "Dinas Pekerjaan Umum dan Penataan Ruang" },
    { id: "dlh", nama: "Dinas Lingkungan Hidup" },
    { id: "dishub", nama: "Dinas Perhubungan" },
    { id: "dinkes", nama: "Dinas Kesehatan" },
  ];

  /* ---------- Autentikasi DEMO ----------
     Akun & kata sandi di JS hanya untuk demo. Produksi: gunakan Supabase Auth/backend,
     dan tegakkan peran di server (RLS / middleware), bukan di browser. */
  const SKEY = "tanggapin_demo_session";
  const ACCOUNTS = [{ email: "ombudsman@tanggapin.demo", password: "demo1234", role: "ombudsman", id_dinas: null }]
    .concat(DINAS.map((d) => ({ email: d.id + "@tanggapin.demo", password: "demo1234", role: "dinas", id_dinas: d.id })));
  function login(email, password) {
    const a = ACCOUNTS.find((x) => x.email === email.trim().toLowerCase() && x.password === password);
    if (!a) return null;
    const s = { email: a.email, role: a.role, id_dinas: a.id_dinas };
    try { sessionStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) { /* abaikan */ }
    return s;
  }
  function session() {
    try { return JSON.parse(sessionStorage.getItem(SKEY)); } catch (e) { return null; }
  }
  const home = (s) => (s.role === "ombudsman" ? "ombudsman.html" : "dinas.html");
  function requireRole(role) {
    const s = session();
    if (!s || s.role !== role) { location.replace("index.html"); return null; }
    // cegah halaman terlihat lewat tombol Kembali setelah keluar
    window.addEventListener("pageshow", (e) => { if (e.persisted && !session()) location.replace("index.html"); });
    return s;
  }
  function logout() {
    try { sessionStorage.removeItem(SKEY); } catch (e) { /* abaikan */ }
    location.href = "index.html";
  }

  /* ---------- Data contoh (kolom Aduan + id_dinas, status_updated_at, dst.) ---------- */
  function A(id, dinas, created, status, upd, isi, lokasi, lat, lng, waktu, tambahan, extra) {
    return Object.assign({
      id_aduan: id, id_dinas: dinas, created_at: created, status, status_updated_at: upd,
      isi_aduan: isi, lokasi_teks: lokasi, latitude: lat, longitude: lng,
      waktu_kejadian: waktu, deskripsi_tambahan: tambahan,
    }, extra || {});
  }
  function seed() {
    return {
      pertanyaan: [],
      aduan: [
        A("TG-2026-0101", "dpu", "2026-10-19T08:15:00+07:00", "diterima", "2026-10-19T08:15:00+07:00",
          "Jalan berlubang di depan sekolah", "Jl. Merdeka No. 12, Sukajadi, Bandung", -6.8895, 107.5946,
          "2026-10-18T06:30:00+07:00", "Lubang sedalam sekitar 15 cm, membahayakan pengendara motor."),
        A("TG-2026-0091", "dpu", "2026-10-14T09:00:00+07:00", "ditangani", "2026-10-15T10:00:00+07:00",
          "Saluran drainase tersumbat", "Jl. Kenanga, Bandung Wetan", -6.9020, 107.6120,
          "2026-10-13T16:00:00+07:00", "Air meluap ke jalan setiap hujan."),
        A("TG-2026-0054", "dpu", "2026-09-28T07:40:00+07:00", "selesai", "2026-10-03T15:00:00+07:00",
          "Pohon tumbang menutup jalan", "Jl. Dago, Coblong, Bandung", -6.8850, 107.6130,
          "2026-09-28T05:50:00+07:00", "Menutup satu lajur jalan.",
          { tindak_lanjut: { deskripsi: "Pohon dipotong dan dibersihkan oleh tim lapangan.", foto_before: "before-pohon.jpg", foto_after: "after-pohon.jpg", dokumen: null, tanggal_selesai: "2026-10-03" } }),
        A("TG-2026-0087", "dlh", "2026-09-30T10:20:00+07:00", "ditangani", "2026-10-02T09:00:00+07:00",
          "Sampah menumpuk di tepi sungai", "Bantaran Sungai, Coblong, Bandung", -6.8920, 107.6140,
          "2026-09-29T00:00:00+07:00", "Menimbulkan bau dan menyumbat aliran air."),
        A("TG-2026-0072", "dlh", "2026-10-01T11:00:00+07:00", "ditolak", "2026-10-03T13:00:00+07:00",
          "Bau limbah dari pabrik dekat permukiman", "Kawasan Industri, Rancaekek", -6.9610, 107.7560,
          "2026-09-30T20:00:00+07:00", "Bau menyengat terutama malam hari.",
          { alasan_penolakan: "Data laporan kurang lengkap." }),
        A("TG-2026-0120", "dlh", "2026-10-21T07:00:00+07:00", "diterima", "2026-10-21T07:00:00+07:00",
          "Pembakaran sampah di lahan kosong", "Jl. Cisitu Lama, Coblong, Bandung", -6.8800, 107.6150,
          "2026-10-21T06:30:00+07:00", "Asap mengganggu warga sekitar."),
        A("TG-2026-0102", "dishub", "2026-10-20T19:30:00+07:00", "diterima", "2026-10-20T19:30:00+07:00",
          "Lampu penerangan jalan mati sepanjang 200 meter", "Jl. Melati, Cicendo, Bandung", -6.9082, 107.5985,
          "2026-10-17T18:00:00+07:00", "Padam sejak tiga hari lalu."),
        A("TG-2026-0099", "dishub", "2026-10-10T08:00:00+07:00", "ditangani", "2026-10-12T09:30:00+07:00",
          "Lampu lalu lintas mati di perempatan", "Perempatan Jl. Riau, Sumur Bandung", -6.9090, 107.6200,
          "2026-10-09T17:00:00+07:00", "Menimbulkan kemacetan saat jam pulang kerja."),
        A("TG-2026-0060", "dishub", "2026-10-02T09:10:00+07:00", "selesai", "2026-10-08T14:00:00+07:00",
          "Rambu larangan parkir rusak", "Jl. Riau, Sumur Bandung", -6.9100, 107.6180,
          "2026-10-01T10:00:00+07:00", "Rambu miring dan tidak terbaca.",
          { tindak_lanjut: { deskripsi: "Rambu diganti dan dipasang ulang.", foto_before: null, foto_after: null, dokumen: "ba-rambu-riau.pdf", tanggal_selesai: "2026-10-08" } }),
        A("TG-2026-0033", "dishub", "2026-09-15T13:00:00+07:00", "ditolak", "2026-09-17T10:00:00+07:00",
          "Tarif parkir area pusat perbelanjaan terlalu mahal", "Pusat perbelanjaan, Lengkong, Bandung", -6.9250, 107.6150,
          "2026-09-14T15:00:00+07:00", "Tarif naik dua kali lipat tanpa pemberitahuan.",
          { alasan_penolakan: "Bukan kewenangan dinas." }),
        A("TG-2026-0110", "dinkes", "2026-10-20T10:00:00+07:00", "diterima", "2026-10-20T10:00:00+07:00",
          "Genangan air berjentik nyamuk di lapangan RW 05", "Lapangan RW 05, Cicendo, Bandung", -6.9150, 107.5900,
          "2026-10-19T09:00:00+07:00", "Beberapa warga sudah mengalami demam berdarah."),
        A("TG-2026-0095", "dinkes", "2026-10-05T08:30:00+07:00", "ditangani", "2026-10-06T08:00:00+07:00",
          "Toilet Puskesmas rusak dan tidak bisa dipakai", "Puskesmas Cicendo, Bandung", -6.9120, 107.5950,
          "2026-10-04T09:00:00+07:00", "Pasien harus menumpang ke fasilitas lain."),
      ],
    };
  }

  /* ---------- Penyimpanan ---------- */
  let db = load();
  function load() {
    try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch (e) { /* abaikan */ }
    return seed();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* abaikan */ } }
  function reset() { try { localStorage.removeItem(KEY); } catch (e) { /* abaikan */ } location.reload(); }

  /* ---------- Akses data ---------- */
  const now = () => new Date().toISOString();
  const byId = (id) => db.aduan.find((r) => r.id_aduan === id);
  const byDinas = (idDinas) =>
    db.aduan.filter((r) => r.id_dinas === idDinas).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const dinasName = (id) => DINAS.find((d) => d.id === id).nama;
  function counts(list) {
    const c = {};
    STATUSES.forEach((s) => (c[s.key] = list.filter((r) => r.status === s.key).length));
    return c;
  }
  const isStale = (r) => r.status === "ditangani" && daysSince(r.status_updated_at) >= STAGNAN_HARI;

  function setStatus(id, status, patch) {
    Object.assign(byId(id), patch || {}, { status, status_updated_at: now() });
    save();
  }
  function addQuestion(q) {
    db.pertanyaan.push(Object.assign({ id_pertanyaan: "Q" + Date.now(), created_at: now(), balasan: null, dibalas_at: null }, q));
    save();
  }
  function answer(idPertanyaan, teks) {
    const q = db.pertanyaan.find((x) => x.id_pertanyaan === idPertanyaan);
    q.balasan = teks; q.dibalas_at = now();
    save();
  }
  const questionsFor = (idAduan) => db.pertanyaan.filter((q) => q.aduan_ids.includes(idAduan));
  const openQuestions = (idDinas) => db.pertanyaan.filter((q) => q.id_dinas === idDinas && !q.balasan);

  /* ---------- Util tampilan ---------- */
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text; // aman dari XSS
    return n;
  }
  const toDate = (s) => new Date(s.length === 10 ? s + "T00:00:00" : s);
  const fmtDate = (s) => toDate(s).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const fmtDateTime = (s) =>
    toDate(s).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const daysSince = (s) => Math.floor((Date.now() - toDate(s).getTime()) / 864e5);
  const localDate = (s) => (s ? toDate(s) : new Date()).toLocaleDateString("sv-SE"); // YYYY-MM-DD

  function btn(label, cls, onClick) {
    const b = el("button", "btn " + (cls || ""), label);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }
  function strong(t) { return el("strong", "", t); }

  let toastEl, toastTimer;
  function toast(msg) {
    if (!toastEl) {
      toastEl = el("div", "toast");
      toastEl.setAttribute("role", "status");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3500);
  }

  // Dialog formulir. Resolve: objek data jika disimpan, null jika dibatalkan.
  function formDialog(cfg) {
    return new Promise((resolve) => {
      let result = null;
      const dlg = el("dialog", "dlg"), form = el("form", "dlg-form"), inputs = {};
      form.append(el("h2", "", cfg.title));
      if (cfg.intro) form.append(el("p", "dlg-intro", cfg.intro));
      (cfg.fields || []).forEach((fd) => {
        const label = el("label", "dlg-field");
        label.append(el("span", "", fd.label));
        const c = document.createElement(fd.type === "textarea" ? "textarea" : "input");
        if (fd.type === "textarea") c.rows = 4; else c.type = fd.type;
        if (fd.accept) c.accept = fd.accept;
        if (fd.max) c.max = fd.max;
        if (fd.min) c.min = fd.min;
        if (fd.value) c.value = fd.value;
        inputs[fd.name] = c;
        label.append(c);
        if (fd.hint) label.append(el("small", "", fd.hint));
        form.append(label);
      });
      const err = el("p", "dlg-err");
      err.setAttribute("role", "alert");
      const row = el("div", "dlg-actions");
      const cancel = btn("Batal", "", () => dlg.close());
      const ok = el("button", "btn primary", cfg.submit || "Simpan");
      ok.type = "submit";
      row.append(cancel, ok);
      form.append(err, row);

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const d = {};
        for (const k in inputs) d[k] = inputs[k].type === "file" ? [...inputs[k].files] : inputs[k].value.trim();
        const msg = cfg.validate ? cfg.validate(d) : "";
        if (msg) { err.textContent = msg; return; }
        result = d;
        dlg.close();
      });
      dlg.addEventListener("close", () => { dlg.remove(); resolve(result); });
      dlg.append(form);
      document.body.append(dlg);
      dlg.showModal();
    });
  }

  // Kartu laporan. opsi: { onPick, picked, actions: [Node] }
  function cardNode(r, o) {
    o = o || {};
    const st = STATUSES.find((s) => s.key === r.status);
    const c = el("article", "report-card");
    const top = el("div", "report-top");
    let left;
    if (o.onPick) {
      left = el("label", "pick");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!o.picked;
      cb.setAttribute("aria-label", "Pilih laporan " + r.id_aduan);
      cb.addEventListener("change", () => o.onPick(cb.checked));
      left.append(cb, el("span", "report-code", r.id_aduan));
    } else {
      left = el("span", "report-code", r.id_aduan);
    }
    top.append(left, el("span", "badge " + r.status, st.label));
    c.append(top, el("h3", "isi", r.isi_aduan),
      el("p", "report-meta", "Dilaporkan " + fmtDateTime(r.created_at) + " · Kejadian " + fmtDateTime(r.waktu_kejadian)));

    const loc = el("p", "report-meta", "📍 " + r.lokasi_teks + " ");
    if (r.latitude != null && r.longitude != null) {
      const a = el("a", "", "Lihat di peta");
      a.href = `https://www.openstreetmap.org/?mlat=${r.latitude}&mlon=${r.longitude}#map=18/${r.latitude}/${r.longitude}`;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      loc.append(a);
    }
    c.append(loc);
    if (r.deskripsi_tambahan) c.append(el("p", "report-desc", r.deskripsi_tambahan));

    const days = daysSince(r.status_updated_at);
    const since = fmtDate(r.status_updated_at) + " (" + days + " hari)";
    if (r.status === "diterima") c.append(el("p", "report-note", "Menunggu keputusan dinas sejak " + since + "."));
    if (r.status === "ditangani") {
      const stale = isStale(r);
      c.append(el("p", "report-note" + (stale ? " stale" : ""), "Ditangani sejak " + since + (stale ? " · tanpa perkembangan" : "") + "."));
    }
    if (r.status === "ditolak") {
      const p = el("p", "report-note");
      p.append(strong("Alasan penolakan: "), r.alasan_penolakan || "-");
      c.append(p);
    }
    if (r.status === "selesai" && r.tindak_lanjut) {
      const t = r.tindak_lanjut;
      const p = el("p", "report-note");
      p.append(strong("Selesai " + fmtDate(t.tanggal_selesai) + ". "), t.deskripsi);
      const bukti = [["Foto before", t.foto_before], ["Foto after", t.foto_after], ["Dokumen", t.dokumen]]
        .filter((x) => x[1]).map((x) => x.join(": ")).join(" · ");
      if (bukti) p.append(document.createElement("br"), el("small", "", "Bukti: " + bukti));
      c.append(p);
    }
    questionsFor(r.id_aduan).forEach((q) => {
      const d = el("div", "qa" + (q.balasan ? " answered" : ""));
      d.append(strong("Pertanyaan Ombudsman (" + fmtDate(q.created_at) + "): "), q.pesan,
        document.createElement("br"));
      if (q.balasan) d.append(strong("Balasan dinas: "), q.balasan);
      else d.append(el("em", "", "Belum dibalas dinas."));
      c.append(d);
    });
    if (o.actions && o.actions.length) {
      const row = el("div", "actions");
      row.append(...o.actions);
      c.append(row);
    }
    return c;
  }

  return {
    login, session, home, requireRole, logout,
    STATUSES, DINAS, STAGNAN_HARI, el, btn, toast, formDialog, cardNode, reset,
    fmtDate, localDate, daysSince, isStale, byId, byDinas, dinasName, counts,
    setStatus, addQuestion, answer, questionsFor, openQuestions,
  };
})();