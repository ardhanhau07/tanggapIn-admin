(() => {
  "use strict";
  const sess = TG.requireRole("ombudsman");
  if (!sess) return;
  const { STATUSES, DINAS, el, btn, toast, formDialog, cardNode, byId, byDinas, dinasName,
          counts, isStale, addQuestion, STAGNAN_HARI, statCards, matches } = TG;
  let dinasId = DINAS[0].id, filter = "semua";
  const picked = new Set();
  const $ = (id) => document.getElementById(id);
  const TEMPLATE = {
    stagnan: "Mohon penjelasan mengapa laporan berikut belum menunjukkan perkembangan penanganan, serta rencana dan target waktu penyelesaiannya.",
    penolakan: "Mohon penjelasan dasar penolakan laporan berikut. Alasan penolakan yang tercatat belum jelas atau belum sesuai dengan isi laporan.",
    umum: "",
  };

  function renderAside() {
    const box = $("dinasList");
    box.replaceChildren();
    DINAS.forEach((d) => {
      const list = byDinas(d.id), c = counts(list), stale = list.filter(isStale).length;
      const b = el("button", "dinas-item");
      b.type = "button";
      b.setAttribute("aria-pressed", String(d.id === dinasId));
      b.append(el("strong", "", d.nama), el("span", "dinas-sub", list.length + " laporan"),
        el("span", "dinas-sub", STATUSES.map((s) => s.label + " " + c[s.key]).join(" · ")));
      if (stale) b.append(el("span", "stale-flag", "⚠ " + stale + " tanpa perkembangan"));
      b.addEventListener("click", () => { dinasId = d.id; filter = "semua"; picked.clear(); render(); });
      box.appendChild(b);
    });
  }
  function renderFilter(list) {
    const f = $("filter"), c = counts(list);
    f.replaceChildren();
    [{ key: "semua", label: "Semua" }, ...STATUSES].forEach(({ key, label }) => {
      const b = el("button");
      b.type = "button";
      b.setAttribute("aria-pressed", String(key === filter));
      b.append(label, el("span", "count", String(key === "semua" ? list.length : c[key])));
      b.addEventListener("click", () => { filter = key; render(); });
      f.appendChild(b);
    });
  }
  function renderToolbar(visible) {
    const t = $("toolbar");
    t.replaceChildren();
    const all = el("label", "pick"), cb = document.createElement("input");
    cb.type = "checkbox";
    cb.disabled = !visible.length;
    cb.checked = visible.length > 0 && visible.every((r) => picked.has(r.id_aduan));
    cb.addEventListener("change", () => {
      visible.forEach((r) => (cb.checked ? picked.add(r.id_aduan) : picked.delete(r.id_aduan)));
      render();
    });
    all.append(cb, "Pilih semua yang tampil");
    const ask = btn("Tanyakan ke Dinas", "primary", askDinas);
    ask.disabled = picked.size === 0;
    t.append(all, el("span", "spacer"), el("span", "report-meta", picked.size + " dipilih"), ask);
  }
  function render() {
    const d = DINAS.find((x) => x.id === dinasId), list = byDinas(dinasId), q = $("search").value.trim();
    const visible = (filter === "semua" ? list : list.filter((r) => r.status === filter)).filter((r) => matches(r, q));
    renderAside();
    $("dinasTitle").textContent = d.nama;
    $("dinasSummary").textContent = "Laporan berstatus Ditangani selama " + STAGNAN_HARI + " hari atau lebih tanpa perubahan ditandai tidak berkembang.";
    statCards($("stats"), list);
    renderFilter(list);
    renderToolbar(visible);
    const box = $("reportList");
    box.replaceChildren();
    if (!visible.length) box.appendChild(el("p", "empty", "Tidak ada laporan pada status ini."));
    visible.forEach((r) => box.appendChild(cardNode(r, {
      picked: picked.has(r.id_aduan),
      onPick: (on) => { on ? picked.add(r.id_aduan) : picked.delete(r.id_aduan); renderToolbar(visible); },
    })));
  }
  async function askDinas() {
    const ids = [...picked], rows = ids.map(byId);
    const jenis = rows.every((r) => r.status === "ditolak") ? "penolakan" : rows.every((r) => r.status === "ditangani") ? "stagnan" : "umum";
    const data = await formDialog({
      title: "Tanyakan ke " + dinasName(dinasId), intro: ids.length + " laporan dipilih: " + ids.join(", "),
      fields: [{ name: "pesan", label: "Pertanyaan untuk dinas", type: "textarea", value: TEMPLATE[jenis] }],
      submit: "Kirim pertanyaan",
      validate: (d) => (d.pesan.length < 15 ? "Tulis pertanyaan minimal 15 karakter." : ""),
    });
    if (!data) return;
    addQuestion({ id_dinas: dinasId, aduan_ids: ids, jenis, pesan: data.pesan });
    picked.clear();
    toast("Pertanyaan terkirim ke " + dinasName(dinasId) + " untuk " + ids.length + " laporan.");
    render();
  }
  $("search").addEventListener("input", render);
  $("logout").addEventListener("click", (e) => { e.preventDefault(); TG.logout(); });
  $("resetDemo").addEventListener("click", () => { if (confirm("Kembalikan data demo ke awal?")) TG.reset(); });
  render();
})();