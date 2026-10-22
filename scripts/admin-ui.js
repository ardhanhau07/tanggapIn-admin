// Tambahan UI dashboard: kartu overview & pencarian. Dimuat setelah admin-core.js.
(() => {
  "use strict";
  const { el, counts } = TG;
  // Kartu overview: total laporan diterima, laporan baru, ditangani, selesai, ditolak
  TG.statCards = (box, list) => {
    const c = counts(list);
    box.replaceChildren();
    [["total", "Total Laporan Diterima", list.length], ["diterima", "Laporan Baru", c.diterima],
     ["ditangani", "Sedang Ditangani", c.ditangani], ["selesai", "Sudah Selesai", c.selesai],
     ["ditolak", "Ditolak", c.ditolak]].forEach(([k, l, n]) => {
      const d = el("div", "stat " + k);
      d.append(el("span", "stat-label", l), el("strong", "stat-num", String(n).padStart(2, "0")));
      box.appendChild(d);
    });
  };
  TG.matches = (r, q) => !q || (r.id_aduan + " " + r.isi_aduan + " " + r.lokasi_teks).toLowerCase().includes(q.toLowerCase());
})();