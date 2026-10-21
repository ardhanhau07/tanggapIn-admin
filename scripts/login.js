(() => {
  "use strict";
  const already = TG.session();
  if (already) { location.replace(TG.home(already)); return; }

  const form = document.getElementById("loginForm");
  const err = document.getElementById("loginErr");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const pass = document.getElementById("password").value;
    if (!email.trim() || !pass) { err.textContent = "Isi email dan kata sandi."; return; }
    const s = TG.login(email, pass);
    if (!s) { err.textContent = "Email atau kata sandi salah."; return; } // pesan sama untuk keduanya
    location.href = TG.home(s);
  });
})();