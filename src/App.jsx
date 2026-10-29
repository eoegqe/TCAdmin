import React, { useEffect, useState } from "react";
import { ShieldCheck, Users, LogOut, RefreshCw, LockKeyhole, AlertCircle, UserCog } from "lucide-react";

const ACCOUNTS = "https://accounts.theegget.com";
const CLIENT_ID = import.meta.env.VITE_TC_OAUTH_CLIENT_ID || "";
const REDIRECT_URI = "https://admin.theegget.com/oauth/callback";
const ROLES = [
  { value: "user", label: "1 · User" },
  { value: "support", label: "2 · Support" },
  { value: "admin", label: "3 · Admin" },
  { value: "co_owner", label: "4 · Co-owner" },
  { value: "owner", label: "5 · Owner" },
  { value: "banned", label: "0 · Banned" }
];

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function startLogin() {
  if (!CLIENT_ID) throw new Error("TC Accounts OAuth is not configured. Set VITE_TC_OAUTH_CLIENT_ID to the client ID registered for TCAdmin.");
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(48)));
  const state = base64url(crypto.getRandomValues(new Uint8Array(24)));
  sessionStorage.setItem("tcadmin_pkce_verifier", verifier);
  sessionStorage.setItem("tcadmin_oauth_state", state);
  const challenge = base64url(await sha256(verifier));
  const url = new URL("/oauth/authorize", ACCOUNTS);
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  window.location.assign(url.toString());
}

async function api(path, token, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || `Request failed (${response.status})`);
  return data;
}

export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem("tcadmin_access_token") || "");
  const [user, setUser] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [roleChanges, setRoleChanges] = useState({});

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const returnedState = url.searchParams.get("state");
        const oauthError = url.searchParams.get("error");
        if (oauthError) throw new Error(oauthError === "access_denied" ? "Sign-in was cancelled." : "TC Accounts authorization failed.");
        if (code) {
          const expectedState = sessionStorage.getItem("tcadmin_oauth_state");
          const verifier = sessionStorage.getItem("tcadmin_pkce_verifier");
          if (!expectedState || returnedState !== expectedState || !verifier) throw new Error("The sign-in state could not be verified. Please sign in again.");
          if (!CLIENT_ID) throw new Error("TC Accounts OAuth is not configured. Set VITE_TC_OAUTH_CLIENT_ID.");
          const body = new URLSearchParams({
            grant_type: "authorization_code",
            code,
            client_id: CLIENT_ID,
            redirect_uri: REDIRECT_URI,
            code_verifier: verifier
          });
          const response = await fetch("/api/auth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || !result.access_token) throw new Error(result.error_description || result.error || "Could not finish TC sign-in.");
          sessionStorage.setItem("tcadmin_access_token", result.access_token);
          sessionStorage.removeItem("tcadmin_pkce_verifier");
          sessionStorage.removeItem("tcadmin_oauth_state");
          url.search = "";
          window.history.replaceState({}, "", url.pathname);
          if (!cancelled) setToken(result.access_token);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Sign-in failed.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    initialize();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setAccounts([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api("/api/auth/me", token).then(result => {
      if (cancelled) return;
      setUser(result.user);
      setError("");
    }).catch(e => {
      if (cancelled) return;
      sessionStorage.removeItem("tcadmin_access_token");
      setToken("");
      setError(e.message || "Your TC session could not be verified.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  async function loadAccounts() {
    if (!token || user?.role !== "owner") return;
    setBusy(true);
    setError("");
    try {
      const result = await api("/api/admin/roles", token);
      setAccounts(result.accounts || []);
      setRoleChanges({});
    } catch (e) {
      setError(e.message || "Could not load TC accounts.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { if (user?.role === "owner") loadAccounts(); }, [user?.role, token]);

  async function saveRole(account) {
    const role = roleChanges[account.id];
    if (!role) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api("/api/admin/roles", token, {
        method: "POST",
        body: JSON.stringify({ user_id: account.id, role })
      });
      setNotice(`Role updated for TC account #${account.id}.`);
      await loadAccounts();
    } catch (e) {
      setError(e.message || "Could not update the role.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    const current = token;
    sessionStorage.removeItem("tcadmin_access_token");
    sessionStorage.removeItem("tcadmin_pkce_verifier");
    sessionStorage.removeItem("tcadmin_oauth_state");
    setToken("");
    setUser(null);
    setAccounts([]);
    try {
      await fetch(`${ACCOUNTS}/oauth/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: current })
      });
    } catch {}
  }

  return <div className="tcadmin-root">
    <header className="tcadmin-header">
      <div className="tcadmin-brand"><div className="tcadmin-mark">TC</div><div><strong>Theegget Creations</strong><span>ADMINISTRATION</span></div></div>
      {user && <div className="tcadmin-session"><span className="tcadmin-status-dot" />Signed in as <strong>{user.username}</strong><button className="tcadmin-signout" onClick={signOut}><LogOut size={15} /> Sign out</button></div>}
    </header>
    {loading ? <main className="tcadmin-centered"><div className="tcadmin-spinner" /><h1>Checking TC Accounts</h1><p>Verifying your sign-in and access level.</p></main> :
    !user ? <main className="tcadmin-centered"><div className="tcadmin-hero-icon"><LockKeyhole size={24} /></div><p className="tcadmin-kicker">SECURE ADMINISTRATION</p><h1>Sign in with TC</h1><p className="tcadmin-subtitle">Use your TC Account to continue. Access to this admin panel is granted separately from a normal TC sign-in.</p>
      {error && <div className="tcadmin-error"><AlertCircle size={17} />{error}</div>}
      {!CLIENT_ID && <div className="tcadmin-warning"><AlertCircle size={17} /><span>OAuth setup is incomplete. Register TCAdmin in TC Accounts with redirect URL <code>{REDIRECT_URI}</code>, then set <code>VITE_TC_OAUTH_CLIENT_ID</code> to its client ID and rebuild.</span></div>}
      <button className="tcadmin-primary" disabled={!CLIENT_ID} onClick={() => startLogin().catch(e => setError(e.message))}>Continue with TC <span>→</span></button>
      <p className="tcadmin-footnote">A TC account alone does not grant administrative access.</p>
    </main> :
    user.role === "banned" ? <main className="tcadmin-centered"><div className="tcadmin-hero-icon"><LockKeyhole size={24} /></div><h1>TCAdmin access suspended</h1><p className="tcadmin-subtitle">This TC account has been blocked from TCAdmin. Contact the owner if you believe this is a mistake.</p><button className="tcadmin-secondary" onClick={signOut}><LogOut size={16} /> Sign out</button></main> :
    user.role === "user" ? <main className="tcadmin-centered"><div className="tcadmin-hero-icon"><ShieldCheck size={24} /></div><h1>Access not granted</h1><p className="tcadmin-subtitle">Signed in as <strong>{user.username}</strong> (TC account #{user.id}). Your TC account has the default User role, which does not grant access to the admin workspace.</p><button className="tcadmin-secondary" onClick={signOut}><LogOut size={16} /> Sign out</button></main> :
    <main className="tcadmin-dashboard">
      <div className="tcadmin-page-heading"><div><p className="tcadmin-kicker">THEEGGET CREATIONS / ADMIN</p><h1>Access management</h1><p>Assign TCAdmin roles to TC Accounts identities.</p></div><span className="tcadmin-role-chip">{ROLES.find(r => r.value === user.role)?.label || user.role}</span></div>
      {error && <div className="tcadmin-error"><AlertCircle size={17} />{error}</div>}
      {notice && <div className="tcadmin-notice">{notice}</div>}
      {user.role === "owner" ? <section className="tcadmin-panel"><div className="tcadmin-panel-title"><div><Users size={19} /><div><h2>TC accounts</h2><p>Only TC account ID 1 can change roles.</p></div></div><button className="tcadmin-refresh" onClick={loadAccounts} disabled={busy}><RefreshCw size={15} /> Refresh</button></div>
        {busy && !accounts.length ? <p className="tcadmin-muted">Loading accounts…</p> : accounts.length ? <div className="tcadmin-table-wrap"><table className="tcadmin-table"><thead><tr><th>TC account</th><th>Current role</th><th>Assign role</th><th /></tr></thead><tbody>{accounts.map(account => <tr key={account.id}><td><strong>{account.username}</strong><span className="tcadmin-cell-sub">Account ID {account.id}{account.status ? ` · ${account.status}` : ""}</span></td><td><span className="tcadmin-role-chip">{account.id === 1 ? "5 · Owner" : ROLES.find(r => r.value === account.role)?.label || "1 · User"}</span></td><td>{account.id === 1 ? <span className="tcadmin-muted">Permanent owner</span> : <select value={roleChanges[account.id] ?? account.role} onChange={e => setRoleChanges(v => ({ ...v, [account.id]: e.target.value }))}>{ROLES.filter(role => role.value !== "owner").map(role => <option key={role.value} value={role.value}>{role.label}</option>)}</select>}</td><td>{account.id === 1 ? null : <button className="tcadmin-save" disabled={busy || (roleChanges[account.id] ?? account.role) === account.role} onClick={() => saveRole(account)}>Save</button>}</td></tr>)}</tbody></table></div> : <p className="tcadmin-muted">No TC accounts were returned.</p>}
      </section> : <section className="tcadmin-panel tcadmin-no-role-tools"><UserCog size={24} /><h2>Administrative tools</h2><p>Your role allows access to the TCAdmin workspace, but only TC account ID 1 can assign or change roles.</p></section>}
      <p className="tcadmin-security-note"><ShieldCheck size={15} /> Role changes are enforced by the server, not just by the interface.</p>
    </main>}
  </div>;
}
