(() => {
  "use strict";
  const { STATUSES, DINAS, el, btn, toast, formDialog, cardNode, byDinas, counts, localDate,
          setStatus, answer, questionsFor, openQuestions } = TG;

  const HINT = {
    diterima: "Laporan baru. Terima agar masuk daftar Ditangani, atau tolak dengan menyertakan alasan.",
    ditangani: "Laporan yang sedang dikerjakan. Tandai selesai setelah penanganan, lengkapi dengan bukti.",
    selesai: "Laporan yang sudah diselesaikan beserta tindak lanjutnya.",
    ditolak: "Laporan yang ditolak beserta alasan penolakannya.",
  };
  const sess = TG.requireRole("dinas");
  if (!sess) return;
  const dinasId = sess.id_dinas; // ditentukan oleh akun yang login
  let tab = "diterima";

  const $ = (id) => document.getElementById(id);

  /* ---------- Aksi ---------- */
  async function terima(r) {
    const ok = await formDialog({
      title: "Terima laporan?",
      intro: r.id_aduan + " akan dipindahkan ke daftar Ditangani.",
      fields: [], submit: "Terima laporan",
    });
    if (!ok) return;
    setStatus(r.id_aduan, "ditangani");
    toast("Laporan " + r.id_aduan + " masuk daftar Ditangani.");
    render();
  }

  async function tolak(r) {
    const d = await formDialog({
      title: "Tolak laporan",
      intro: r.id_aduan + ": " + r.isi_aduan,
      fields: [{ name: "alasan", label: "Alasan penolakan", type: "textarea",
                 hint: "Alasan akan terlihat oleh pelapor dan Ombudsman. Jelaskan dasar penolakannya." }],
      submit: "Tolak laporan",
      validate: (x) => (x.alasan.length < 15 ? "Tulis alasan penolakan minimal 15 karakter." : ""),
    });
    if (!d) return;
    setStatus(r.id_aduan, "ditolak", { alasan_penolakan: d.alasan });
    toast("Laporan " + r.id_aduan + " ditolak.");
    tab = "ditolak";
    render();
  }

  async function selesai(r) {
    const today = localDate();
    const created = localDate(r.created_at);
    const MB10 = 10 * 1024 * 1024;
    const d = await formDialog({
      title: "Tandai laporan selesai",
      intro: r.id_aduan + ": " + r.isi_aduan,
      fields: [
        { name: "deskripsi", label: "Deskripsi tindakan", type: "textarea" },
        { name: "foto_before", label: "Foto sebelum (before)", type: "file", accept: "image/*" },
        { name: "foto_after", label: "Foto sesudah (after)", type: "file", accept: "image/*",
          hint: "Lampirkan foto before dan after, atau berita acara/dokumen pendukung." },
        { name: "dokumen", label: "Berita acara / dokumen pendukung", type: "file", accept: ".pdf,.doc,.docx,image/*" },
        { name: "tanggal_selesai", label: "Tanggal selesai", type: "date", value: today, min: created, max: today },
      ],
      submit: "Simpan sebagai selesai",
      validate: (x) => {
        const b = x.foto_before[0], a = x.foto_after[0], doc = x.dokumen[0];
        if (x.deskripsi.length < 20) return "Deskripsi tindakan minimal 20 karakter.";
        if ((b && !a) || (a && !b)) return "Foto before dan after harus dilampirkan berdua.";
        if (!(b && a) && !doc) return "Lampirkan foto before dan after, atau berita acara/dokumen pendukung.";
        if ([b, a, doc].some((f) => f && f.size > MB10)) return "Ukuran tiap file maksimal 10 MB.";
        if (!x.tanggal_selesai) return "Tanggal selesai wajib diisi.";
        if (x.tanggal_selesai > today) return "Tanggal selesai tidak boleh di masa depan.";
        if (x.tanggal_selesai < created) return "Tanggal selesai tidak boleh sebelum laporan dibuat.";
        return "";
      },
    });
    if (!d) return;
    // DEMO: hanya nama file yang disimpan. Di produksi, unggah file ke storage lalu simpan URL-nya.
    setStatus(r.id_aduan, "selesai", {
      tindak_lanjut: {
        deskripsi: d.deskripsi,
        foto_before: d.foto_before[0] ? d.foto_before[0].name : null,
        foto_after: d.foto_after[0] ? d.foto_after[0].name : null,
        dokumen: d.dokumen[0] ? d.dokumen[0].name : null,
        tanggal_selesai: d.tanggal_selesai,
      },
    });
    toast("Laporan " + r.id_aduan + " ditandai selesai.");
    tab = "selesai";
    render();
  }

  async function balas(q) {
    const d = await formDialog({
      title: "Balas Ombudsman",
      intro: "Pertanyaan: " + q.pesan + " (berlaku untuk " + q.aduan_ids.length + " laporan: " + q.aduan_ids.join(", ") + ")",
      fields: [{ name: "teks", label: "Balasan", type: "textarea" }],
      submit: "Kirim balasan",
      validate: (x) => (x.teks.length < 15 ? "Tulis balasan minimal 15 karakter." : ""),
    });
    if (!d) return;
    answer(q.id_pertanyaan, d.teks);
    toast("Balasan terkirim ke Ombudsman.");
    render();
  }

  /* ---------- Tampilan ---------- */
  function actionsFor(r) {
    const a = [];
    if (r.status === "diterima") a.push(btn("Terima", "primary", () => terima(r)), btn("Tolak", "", () => tolak(r)));
    if (r.status === "ditangani") a.push(btn("Tandai selesai", "primary", () => selesai(r)));
    questionsFor(r.id_aduan).filter((q) => !q.balasan)
      .forEach((q) => a.push(btn("Balas Ombudsman", "", () => balas(q))));
    return a;
  }

  function render() {
    const d = DINAS.find((x) => x.id === dinasId);
    const list = byDinas(dinasId), c = counts(list);
    $("dinasTitle").textContent = d.nama;
    $("tabHint").textContent = HINT[tab];

    const open = openQuestions(dinasId).length;
    const banner = $("banner");
    banner.replaceChildren();
    if (open) banner.appendChild(el("p", "banner", open + " pertanyaan dari Ombudsman belum dibalas. Cari laporan bertanda pertanyaan lalu klik Balas Ombudsman."));

    const f = $("filter");
    f.replaceChildren();
    STATUSES.forEach(({ key, label }) => {
      const b = el("button");
      b.type = "button";
      b.setAttribute("aria-pressed", String(key === tab));
      b.append(label, el("span", "count", String(c[key])));
      b.addEventListener("click", () => { tab = key; render(); });
      f.appendChild(b);
    });

    const box = $("reportList");
    box.replaceChildren();
    const rows = list.filter((r) => r.status === tab);
    if (!rows.length) box.appendChild(el("p", "empty", "Belum ada laporan pada status ini."));
    rows.forEach((r) => box.appendChild(cardNode(r, { actions: actionsFor(r) })));
  }

  $("logout").addEventListener("click", (e) => { e.preventDefault(); TG.logout(); });
  $("resetDemo").addEventListener("click", () => { if (confirm("Kembalikan data demo ke awal?")) TG.reset(); });
  render();
})();