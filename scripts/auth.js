// Autentikasi admin lewat Supabase Auth. Peran dibaca dari app_metadata:
// { role: "superadmin" } atau { role: "dinas", dinas_id: 3 }.
window.AUTH = (() => {
  "use strict";
  const C = window.APP_CONFIG || {};
  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
  const ROLES = ["superadmin", "dinas"];

  function profile(user) {
    const m = user.app_metadata || {};
    return { email: user.email, role: m.role || null, dinas_id: m.dinas_id != null ? Number(m.dinas_id) : null };
  }

  async function login(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const p = profile(data.user);
    if (!ROLES.includes(p.role)) {
      await sb.auth.signOut();
      const e = new Error("no_role");
      e.code = "no_role";
      throw e;
    }
    return p;
  }

  async function current() {
    const { data } = await sb.auth.getSession();
    return data.session ? profile(data.session.user) : null;
  }

  // Selalu ambil token terbaru; supabase-js memperbaruinya otomatis.
  async function token() {
    const { data } = await sb.auth.getSession();
    return data.session ? data.session.access_token : null;
  }

  async function logout() {
    try { await sb.auth.signOut(); } catch (e) { /* abaikan */ }
    location.href = "index.html";
  }

  return { sb, login, current, token, logout, ROLES };
})();