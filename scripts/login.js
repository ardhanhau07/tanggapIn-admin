(() => {
  "use strict";
  const form = document.getElementById("loginForm");
  const err = document.getElementById("loginErr");
  const btn = form.querySelector("button[type=submit]");

  // Sudah login? langsung ke dashboard.
  AUTH.current().then((p) => { if (p && AUTH.ROLES.includes(p.role)) location.replace("dashboard.html"); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const pass = document.getElementById("password").value;
    if (!email || !pass) { err.textContent = "Isi email dan kata sandi."; return; }
    btn.disabled = true;
    err.textContent = "";
    try {
      await AUTH.login(email, pass);
      location.href = "dashboard.html";
    } catch (ex) {
      if (ex.code === "no_role") err.textContent = "Akun ini belum memiliki peran admin. Hubungi pengelola sistem.";
      else if (ex.status === 400 || /invalid/i.test(ex.message || "")) err.textContent = "Email atau kata sandi salah.";
      else err.textContent = "Tidak bisa terhubung. Periksa koneksi lalu coba lagi.";
      btn.disabled = false;
    }
  });
})();