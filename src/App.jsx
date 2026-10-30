import React, { useEffect, useState } from "react";
import { ShieldCheck, Users, LogOut, RefreshCw, LockKeyhole, AlertCircle, UserCog, KeyRound, Copy, Trash2, Save, ExternalLink, X, Mail } from "lucide-react";

const ACCOUNTS = "https://accounts.theegget.com";
const CLIENT_ID = import.meta.env.VITE_TC_OAUTH_CLIENT_ID || "tc_B5LqoZygi4pJcaM_y7YF_roDmGtjYUax";
const REDIRECT_URI = "https://admin.theegget.com/oauth/callback";
const ROLES = [
  { value: "user", label: "1 · User" },
  { value: "support", label: "2 · Support" },
  { value: "admin", label: "3 · Admin" },
  { value: "co_owner", label: "4 · Co-owner" },
  { value: "owner", label: "5 · Owner" },
  { value: "banned", label: "0 · Banned" }
];
const CAN_MANAGE_CLIENTS = role => ["admin", "co_owner", "owner"].includes(role);
const CAN_SEND_MAIL = role => ["admin", "co_owner", "owner"].includes(role);
const CAN_MANAGE_SUBACCOUNTS = role => ["support", "admin", "co_owner", "owner"].includes(role);

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function startLogin() {
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

function clientDraft(client) {
  return {
    name: client.name || "",
    redirect_uris: (client.redirect_uris || []).join("\n"),
    scopes: (client.scopes || ["profile"]).join(", ")
  };
}

export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem("tcadmin_access_token") || "");
  const [user, setUser] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [clients, setClients] = useState([]);
  const [clientChanges, setClientChanges] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [roleChanges, setRoleChanges] = useState({});
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [mailMode, setMailMode] = useState("direct");
  const [mailTo, setMailTo] = useState("");
  const [mailSubject, setMailSubject] = useState("");
  const [mailMessage, setMailMessage] = useState("");
  const [mailSending, setMailSending] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const [subAccounts, setSubAccounts] = useState([]);
  const [subAccountId, setSubAccountId] = useState("");
  const [subAccountVerified, setSubAccountVerified] = useState(false);
  const [subAccountBusy, setSubAccountBusy] = useState(false);
  const [supportEmail, setSupportEmail] = useState("");
  const [supportPassword, setSupportPassword] = useState("");
  const [supportMailboxUser, setSupportMailboxUser] = useState("");
  const [supportLoginOpen, setSupportLoginOpen] = useState(false);
  const [supportLoginBusy, setSupportLoginBusy] = useState(false);

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
          // Persist the token before leaving the callback URL. A full navigation
          // to the app root makes the next load use the normal authenticated
          // startup path instead of leaving the browser parked on /oauth/callback.
          sessionStorage.setItem("tcadmin_access_token", result.access_token);
          sessionStorage.removeItem("tcadmin_pkce_verifier");
          sessionStorage.removeItem("tcadmin_oauth_state");
          window.location.replace("/"); 
          return;
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
      setClients([]);
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
    if (!token || !CAN_MANAGE_SUBACCOUNTS(user?.role)) return;
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

  async function loadClients() {
    if (!token || !CAN_MANAGE_CLIENTS(user?.role)) return;
    setBusy(true);
    setError("");
    try {
      const result = await api("/api/admin/oauth-clients", token);
      setClients(result.clients || []);
      setClientChanges({});
    } catch (e) {
      setError(e.message || "Could not load registered applications.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { if (CAN_MANAGE_SUBACCOUNTS(user?.role)) loadAccounts(); }, [user?.role, token]);
  useEffect(() => { if (CAN_MANAGE_CLIENTS(user?.role)) loadClients(); }, [user?.role, token]);

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
      setSelectedAccount(current => current?.id === account.id ? { ...current, role } : current);
      await loadAccounts();
    } catch (e) {
      setError(e.message || "Could not update the role.");
    } finally {
      setBusy(false);
    }
  }

  async function saveClient(client) {
    const draft = clientChanges[client.client_id] || clientDraft(client);
    const redirect_uris = draft.redirect_uris.split("\n").map(value => value.trim()).filter(Boolean);
    const scopes = draft.scopes.split(",").map(value => value.trim()).filter(Boolean);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api("/api/admin/oauth-clients", token, {
        method: "POST",
        body: JSON.stringify({ client_id: client.client_id, name: draft.name, redirect_uris, scopes })
      });
      setNotice(`Saved OAuth settings for ${draft.name}.`);
      await loadClients();
    } catch (e) {
      setError(e.message || "Could not save OAuth client settings.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteClient(client) {
    if (client.is_tcadmin) return;
    if (!window.confirm(`Delete the OAuth registration for "${client.name}"? Existing authorization tokens for this app may stop working.`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/api/admin/oauth-clients?client_id=${encodeURIComponent(client.client_id)}`, token, { method: "DELETE" });
      setNotice(`Deleted the OAuth registration for ${client.name}.`);
      await loadClients();
    } catch (e) {
      setError(e.message || "Could not delete the OAuth client.");
    } finally {
      setBusy(false);
    }
  }

  async function copyClientId(clientId) {
    try {
      await navigator.clipboard.writeText(clientId);
      setNotice("Client ID copied.");
      setError("");
    } catch {
      setError("Clipboard access was blocked. Select and copy the client ID manually.");
    }
  }

  async function sendMail(event) {
    event.preventDefault();
    setMailSending(true);
    setError("");
    setNotice("");
    try {
      const result = await api("/api/admin/send-mail", token, {
        method: "POST",
        body: JSON.stringify({ to: mailTo, announcement: mailMode === "announcement", subject: mailSubject, message: mailMessage })
      });
      setNotice(mailMode === "announcement" ? `Announcement sent to ${result.recipient_count} active TC accounts from notify@theegget.com.` : `Email sent to ${mailTo.trim()} from notify@theegget.com.`);
      setMailTo("");
      setMailSubject("");
      setMailMessage("");
    } catch (e) {
      setError(e.message || "Could not send the email.");
    } finally {
      setMailSending(false);
    }
  }


  async function loadSubAccounts(accountId) {
    if (!token || !accountId || !CAN_MANAGE_SUBACCOUNTS(user?.role)) return;
    try {
      const result = await api("/api/admin/subaccounts?main_user_id=" + encodeURIComponent(accountId), token);
      setSubAccounts(result.subaccounts || []);
    } catch (e) {
      setSubAccounts([]);
      setError(e.message || "Could not load sub-accounts.");
    }
  }

  async function saveSubAccount(action, childId) {
    const id = Number(childId || subAccountId);
    if (!Number.isSafeInteger(id) || id < 1 || !selectedAccount) return;
    setSubAccountBusy(true);
    setError("");
    setNotice("");
    try {
      await api("/api/admin/subaccounts", token, {
        method: "POST",
        body: JSON.stringify({ action, main_user_id: selectedAccount.id, sub_user_id: id, ownership_verified: action === "link" ? subAccountVerified : undefined })
      });
      setNotice(action === "link" ? "TC account #" + id + " linked as a sub-account." : "TC account #" + id + " unlinked.");
      setSubAccountId("");
      setSubAccountVerified(false);
      await loadSubAccounts(selectedAccount.id);
    } catch (e) {
      setError(e.message || "Could not update sub-accounts.");
    } finally {
      setSubAccountBusy(false);
    }
  }

  async function loginSupportMailbox(event) {
    event.preventDefault();
    const email = supportEmail.trim().toLowerCase();
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || !email.endsWith("@theegget.com")) {
      setError("Use a valid @theegget.com email address. No mailbox login attempt was made.");
      return;
    }
    if (!supportPassword) {
      setError("Enter your mailbox password.");
      return;
    }
    setSupportLoginBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("https://accounts.theegget.com/api/support/mailbox/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: supportPassword })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Mailbox sign-in failed.");
      setSupportMailboxUser(email);
      setSupportLoginOpen(false);
      setNotice("Mailbox credentials verified for " + email + ".");
    } catch (e) {
      setError(e.message || "Mailbox sign-in failed.");
    } finally {
      setSupportLoginBusy(false);
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
    setClients([]);
    setSupportMailboxUser("");
    setSupportPassword("");
    setSupportEmail("");
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
      <button className="tcadmin-primary" onClick={() => startLogin().catch(e => setError(e.message))}>Continue with TC <span>→</span></button>
      <p className="tcadmin-footnote">A TC account alone does not grant administrative access.</p>
    </main> :
    user.role === "banned" ? <main className="tcadmin-centered"><div className="tcadmin-hero-icon"><LockKeyhole size={24} /></div><h1>TCAdmin access suspended</h1><p className="tcadmin-subtitle">This TC account has been blocked from TCAdmin. Contact the owner if you believe this is a mistake.</p><button className="tcadmin-secondary" onClick={signOut}><LogOut size={16} /> Sign out</button></main> :
    user.role === "user" ? <main className="tcadmin-centered"><div className="tcadmin-hero-icon"><ShieldCheck size={24} /></div><h1>Access not granted</h1><p className="tcadmin-subtitle">Signed in as <strong>{user.username}</strong> (TC account #{user.id}). Your TC account has the default User role, which does not grant access to the admin workspace.</p><button className="tcadmin-secondary" onClick={signOut}><LogOut size={16} /> Sign out</button></main> :
    <main className="tcadmin-dashboard">
      <div className="tcadmin-page-heading"><div><p className="tcadmin-kicker">THEEGGET CREATIONS / ADMIN</p><h1>TC administration</h1><p>Manage registered applications and access to TCAdmin.</p></div><span className="tcadmin-role-chip">{ROLES.find(r => r.value === user.role)?.label || user.role}</span></div>
      {error && <div className="tcadmin-error"><AlertCircle size={17} />{error}</div>}
      {notice && <div className="tcadmin-notice">{notice}</div>}

      <nav className="tcadmin-navigation" aria-label="Administration sections">
        {[
          { id: "home", label: "Overview", icon: <ShieldCheck size={16} /> },
          { id: "users", label: "Users", icon: <Users size={16} /> },
          { id: "support", label: "Support", icon: <Mail size={16} /> },
          ...(CAN_MANAGE_CLIENTS(user.role) ? [{ id: "apps", label: "Apps", icon: <KeyRound size={16} /> }] : [])
        ].map(item => <button key={item.id} className={activeSection === item.id ? "tcadmin-nav-button active" : "tcadmin-nav-button"} onClick={() => setActiveSection(item.id)}>{item.icon}{item.label}</button>)}
      </nav>

      {activeSection === "home" && <section className="tcadmin-section-grid">
        <button className="tcadmin-section-card" onClick={() => setActiveSection("users")}><Users size={21} /><strong>Users</strong><span>Manage TC accounts, roles, and permissions.</span><b>Open Users →</b></button>
        <button className="tcadmin-section-card" onClick={() => setActiveSection("support")}><Mail size={21} /><strong>Support</strong><span>Open the employee support mailbox workspace.</span><b>Open Support →</b></button>
        {CAN_MANAGE_CLIENTS(user.role) && <button className="tcadmin-section-card" onClick={() => setActiveSection("apps")}><KeyRound size={21} /><strong>Apps</strong><span>Manage OAuth registrations and application settings.</span><b>Open Apps →</b></button>}
      </section>}

      {activeSection === "support" && <section className="tcadmin-panel tcadmin-support-workspace">
        <div className="tcadmin-panel-title"><div><Mail size={19} /><div><h2>Support inbox</h2><p>Customer support conversations and employee mailbox workspace.</p></div></div>{supportMailboxUser ? <div className="tcadmin-mailbox-session"><span className="tcadmin-role-chip">Signed in: {supportMailboxUser}</span><button className="tcadmin-refresh" onClick={() => { setSupportMailboxUser(""); setSupportPassword(""); setSupportEmail(""); }}>Sign out</button></div> : <button className="tcadmin-save" onClick={() => setSupportLoginOpen(value => !value)}><LockKeyhole size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />Log in</button>}</div>
        {supportLoginOpen && !supportMailboxUser && <form className="tcadmin-mailbox-login" onSubmit={loginSupportMailbox}>
          <div><strong>Log in to your TC mailbox</strong><p>Use your employee mailbox credentials. Only @theegget.com addresses are accepted.</p></div>
          <label>Email address<input type="email" required maxLength={254} autoComplete="username" value={supportEmail} onChange={e => setSupportEmail(e.target.value)} placeholder="employee@theegget.com" /></label>
          <label>Password<input type="password" required maxLength={1024} autoComplete="current-password" value={supportPassword} onChange={e => setSupportPassword(e.target.value)} placeholder="Mailbox password" /></label>
          <div className="tcadmin-mailbox-login-actions"><button className="tcadmin-save" type="submit" disabled={supportLoginBusy}>{supportLoginBusy ? "Checking…" : "Log in"}</button><button className="tcadmin-refresh" type="button" onClick={() => setSupportLoginOpen(false)}>Cancel</button></div>
        </form>}
        <div className="tcadmin-support-split">
          <div className="tcadmin-support-list"><div className="tcadmin-support-search">Search support messages</div><div className="tcadmin-support-empty"><Mail size={22} /><strong>{supportMailboxUser ? "Mailbox signed in" : "No mailbox connected"}</strong><span>{supportMailboxUser ? "Your mailbox credentials have been verified. Message retrieval and conversation actions are not connected yet." : "Log in with your employee mailbox to verify access. Inbox retrieval will be available after the mail workspace integration is completed."}</span></div></div>
          <div className="tcadmin-support-conversation"><div className="tcadmin-support-empty"><Mail size={26} /><strong>Select a conversation</strong><span>Choose a message from the inbox to read its history and reply.</span></div></div>
        </div>
        <div className="tcadmin-support-note"><ShieldCheck size={15} /> Support access is designed for replying to incoming customer conversations only. Direct emails and announcements are not available to Support staff.</div>
      </section>}

      {activeSection === "apps" && CAN_SEND_MAIL(user.role) && <section className="tcadmin-panel" style={{ marginBottom: 22 }}>
        <div className="tcadmin-panel-title"><div><Mail size={19} /><div><h2>Email center</h2><p>Send a private email to one recipient or a universal announcement to active TC accounts.</p></div></div></div>
        <form onSubmit={sendMail} style={{ padding: 20, display: "grid", gap: 14 }}>
          <div style={{ color: "#85858d", fontSize: 11 }}>From <strong style={{ color: "#e4e4e7" }}>notify@theegget.com</strong></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className={mailMode === "direct" ? "tcadmin-save" : "tcadmin-refresh"} onClick={() => setMailMode("direct")}>Direct email</button>
            <button type="button" className={mailMode === "announcement" ? "tcadmin-save" : "tcadmin-refresh"} onClick={() => setMailMode("announcement")}>Announcement to all users</button>
          </div>
          {mailMode === "direct" ? <label style={{ display: "grid", gap: 6, color: "#a1a1aa", fontSize: 11 }}>Recipient
            <input type="email" required maxLength={254} value={mailTo} onChange={e => setMailTo(e.target.value)} placeholder="recipient@example.com" style={{ width: "100%", boxSizing: "border-box", background: "#19191c", color: "#f0f0f2", border: "1px solid #3a3a40", borderRadius: 7, padding: 11, fontSize: 13 }} />
          </label> : <p className="tcadmin-muted" style={{ margin: 0 }}>This announcement will be sent to every active TC account with a valid email address. Recipients will not see one another's email addresses.</p>}
          <label style={{ display: "grid", gap: 6, color: "#a1a1aa", fontSize: 11 }}>Subject
            <input required maxLength={180} value={mailSubject} onChange={e => setMailSubject(e.target.value)} placeholder="Email subject" style={{ width: "100%", boxSizing: "border-box", background: "#19191c", color: "#f0f0f2", border: "1px solid #3a3a40", borderRadius: 7, padding: 11, fontSize: 13 }} />
          </label>
          <label style={{ display: "grid", gap: 6, color: "#a1a1aa", fontSize: 11 }}>Message
            <textarea required maxLength={20000} rows={8} value={mailMessage} onChange={e => setMailMessage(e.target.value)} placeholder="Write your message…" style={{ width: "100%", boxSizing: "border-box", resize: "vertical", background: "#19191c", color: "#f0f0f2", border: "1px solid #3a3a40", borderRadius: 7, padding: 11, fontSize: 13, lineHeight: 1.6 }} />
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end" }}><button className="tcadmin-save" type="submit" disabled={mailSending || busy || (mailMode === "direct" && !mailTo.trim()) || !mailSubject.trim() || !mailMessage.trim()}><Mail size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />{mailSending ? "Sending…" : mailMode === "announcement" ? "Send announcement" : "Send direct email"}</button></div>
          <p className="tcadmin-muted" style={{ margin: 0 }}>Available to Admin staff and higher. Announcements go to active TC accounts; direct emails go to one recipient. The sender address is fixed.</p>
        </form>
      </section>}

      {activeSection === "apps" && CAN_MANAGE_CLIENTS(user.role) && <section className="tcadmin-panel" style={{ marginBottom: 22 }}>
        <div className="tcadmin-panel-title"><div><KeyRound size={19} /><div><h2>Application OAuth registrations</h2><p>View and manage registered client IDs across TC apps. Admin role or higher is required.</p></div></div><button className="tcadmin-refresh" onClick={loadClients} disabled={busy}><RefreshCw size={15} /> Refresh</button></div>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #29292d", background: "#141416" }}>
          <div style={{ color: "#777780", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>TCAdmin sign-in client ID</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
            <code style={{ color: "#e4e4e7", fontSize: 12, overflowWrap: "anywhere" }}>{CLIENT_ID}</code>
            <button className="tcadmin-refresh" onClick={() => copyClientId(CLIENT_ID)}><Copy size={14} /> Copy ID</button>
          </div>
          <p style={{ color: "#85858d", fontSize: 11, margin: "8px 0 0" }}>This ID is used automatically for “Sign in with TC”. It is an identifier, not a client secret.</p>
        </div>
        {busy && !clients.length ? <p className="tcadmin-muted">Loading registered applications…</p> : clients.length ? <div style={{ display: "grid", gap: 0 }}>
          {clients.map(client => {
            const draft = clientChanges[client.client_id] || clientDraft(client);
            const changed = draft.name !== client.name || draft.redirect_uris !== (client.redirect_uris || []).join("\n") || draft.scopes !== (client.scopes || ["profile"]).join(", ");
            return <article key={client.client_id} style={{ padding: "20px", borderBottom: "1px solid #252529" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong style={{ fontSize: 14 }}>{client.name}</strong>
                  <div style={{ color: "#85858d", fontSize: 11, marginTop: 5 }}>Owner: {client.owner_username} · Account {client.owner_user_id} · Registered {client.created_at ? new Date(client.created_at).toLocaleDateString() : "date unavailable"}</div>
                </div>
                {client.is_tcadmin && <span className="tcadmin-role-chip">TCAdmin · protected</span>}
              </div>
              <div style={{ marginTop: 15 }}>
                <label style={{ display: "block", color: "#85858d", fontSize: 10, marginBottom: 6 }}>CLIENT ID</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <code style={{ background: "#09090a", border: "1px solid #303035", borderRadius: 6, padding: "9px 10px", color: "#d9d9df", fontSize: 11, overflowWrap: "anywhere", flex: 1 }}>{client.client_id}</code>
                  <button className="tcadmin-refresh" onClick={() => copyClientId(client.client_id)} aria-label={`Copy ${client.name} client ID`}><Copy size={14} /></button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 13, marginTop: 14 }}>
                <label style={{ display: "block", color: "#a1a1aa", fontSize: 11 }}>Application name
                  <input value={draft.name} onChange={e => setClientChanges(current => ({ ...current, [client.client_id]: { ...draft, name: e.target.value } }))} style={{ display: "block", width: "100%", marginTop: 6, background: "#19191c", color: "#f0f0f2", border: "1px solid #3a3a40", borderRadius: 7, padding: 10, fontSize: 12 }} />
                </label>
                <label style={{ display: "block", color: "#a1a1aa", fontSize: 11 }}>Allowed scopes (comma-separated)
                  <input value={draft.scopes} onChange={e => setClientChanges(current => ({ ...current, [client.client_id]: { ...draft, scopes: e.target.value } }))} style={{ display: "block", width: "100%", marginTop: 6, background: "#19191c", color: "#f0f0f2", border: "1px solid #3a3a40", borderRadius: 7, padding: 10, fontSize: 12 }} />
                </label>
                <label style={{ display: "block", color: "#a1a1aa", fontSize: 11, gridColumn: "1 / -1" }}>Redirect URLs (one per line)
                  <textarea rows={Math.max(2, Math.min(5, draft.redirect_uris.split("\n").length))} value={draft.redirect_uris} onChange={e => setClientChanges(current => ({ ...current, [client.client_id]: { ...draft, redirect_uris: e.target.value } }))} style={{ display: "block", width: "100%", resize: "vertical", marginTop: 6, background: "#19191c", color: "#f0f0f2", border: "1px solid #3a3a40", borderRadius: 7, padding: 10, fontSize: 12, lineHeight: 1.6 }} />
                </label>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                <button className="tcadmin-save" disabled={busy || !changed} onClick={() => saveClient(client)}><Save size={13} style={{ verticalAlign: "middle", marginRight: 5 }} />Save changes</button>
                {!client.is_tcadmin && <button className="tcadmin-refresh" disabled={busy} onClick={() => deleteClient(client)}><Trash2 size={13} /> Delete registration</button>}
                {client.is_tcadmin && <a href="https://dev.theegget.com" target="_blank" rel="noreferrer" className="tcadmin-refresh" style={{ textDecoration: "none" }}><ExternalLink size={13} /> Open app registration</a>}
              </div>
            </article>;
          })}
        </div> : <p className="tcadmin-muted">No registered OAuth applications were returned.</p>}
        <p className="tcadmin-muted" style={{ margin: 0 }}>Creating new registrations remains on <a href="https://dev.theegget.com" target="_blank" rel="noreferrer" style={{ color: "#d5d5dc" }}>dev.theegget.com</a>. TCAdmin manages existing registrations here.</p>
      </section>}

      {activeSection === "users" && (CAN_MANAGE_SUBACCOUNTS(user.role) ? <section className="tcadmin-panel"><div className="tcadmin-panel-title"><div><Users size={19} /><div><h2>TC accounts</h2><p>{user.role === "owner" ? "Only TC account ID 1 can change roles. Support and higher roles can manage sub-accounts." : "Support and higher roles can manage sub-account relationships after ownership verification."}</p></div></div><button className="tcadmin-refresh" onClick={loadAccounts} disabled={busy}><RefreshCw size={15} /> Refresh</button></div>
        {busy && !accounts.length ? <p className="tcadmin-muted">Loading accounts…</p> : accounts.length ? <div className="tcadmin-table-wrap"><table className="tcadmin-table"><thead><tr><th>TC account</th><th>Email</th><th>Current role</th>{user.role === "owner" && <><th>Assign role</th><th /></>}</tr></thead><tbody>{accounts.map(account => <tr key={account.id} onClick={() => { setSelectedAccount(account); loadSubAccounts(account.id); }} style={{ cursor: "pointer" }} title={"Open management profile for " + account.username}><td><strong>{account.username}</strong><span className="tcadmin-cell-sub">Account ID {account.id}{account.status ? " · " + account.status : ""}</span></td><td>{account.email || "Not provided"}</td><td><span className="tcadmin-role-chip">{account.id === 1 ? "5 · Owner" : ROLES.find(r => r.value === account.role)?.label || "1 · User"}</span></td>{user.role === "owner" && <><td>{account.id === 1 ? <span className="tcadmin-muted">Permanent owner</span> : <select onClick={e => e.stopPropagation()} value={roleChanges[account.id] ?? account.role} onChange={e => setRoleChanges(v => ({ ...v, [account.id]: e.target.value }))}>{ROLES.filter(role => role.value !== "owner").map(role => <option key={role.value} value={role.value}>{role.label}</option>)}</select>}</td><td>{account.id === 1 ? null : <button className="tcadmin-save" disabled={busy || (roleChanges[account.id] ?? account.role) === account.role} onClick={e => { e.stopPropagation(); saveRole(account); }}>Save</button>}</td></>}</tr>)}</tbody></table></div> : <p className="tcadmin-muted">No TC accounts were returned.</p>}
      </section> : !CAN_MANAGE_CLIENTS(user.role) ? <section className="tcadmin-panel tcadmin-no-role-tools"><UserCog size={24} /><h2>Administrative tools</h2><p>Your role allows access to the TCAdmin workspace, but only TC account ID 1 can assign or change roles.</p></section> : null)}
      {activeSection === "users" && selectedAccount && CAN_MANAGE_SUBACCOUNTS(user.role) && <div onClick={() => setSelectedAccount(null)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.72)", display: "flex", justifyContent: "flex-end" }}>
        <section onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Management panel for ${selectedAccount.username}`} style={{ width: "min(620px, 100%)", height: "100%", overflowY: "auto", background: "#111113", borderLeft: "1px solid #303035", padding: "24px", boxSizing: "border-box", boxShadow: "-20px 0 60px rgba(0,0,0,.35)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 28 }}>
            <div><p className="tcadmin-kicker">ACCOUNT MANAGEMENT</p><h2 style={{ margin: "8px 0 5px", fontSize: 25 }}>{selectedAccount.username}</h2><p style={{ color: "#85858d", margin: 0, fontSize: 12 }}>TC account #{selectedAccount.id}</p></div>
            <button className="tcadmin-refresh" onClick={() => setSelectedAccount(null)} aria-label="Close management panel"><X size={17} /> Close</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginBottom: 24 }}>
            <div style={{ background: "#19191c", border: "1px solid #303035", borderRadius: 9, padding: 15 }}><div style={{ color: "#85858d", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Account ID</div><strong style={{ display: "block", marginTop: 8, fontSize: 18 }}>#{selectedAccount.id}</strong></div>
            <div style={{ background: "#19191c", border: "1px solid #303035", borderRadius: 9, padding: 15 }}><div style={{ color: "#85858d", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Account status</div><strong style={{ display: "block", marginTop: 8, fontSize: 18, textTransform: "capitalize" }}>{selectedAccount.status || "Unknown"}</strong></div>
          </div>
          {user.role === "owner" && <section style={{ border: "1px solid #303035", borderRadius: 10, padding: 18, marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 5px", fontSize: 15 }}>Access and permissions</h3>
            <p style={{ color: "#85858d", fontSize: 12, margin: "0 0 16px" }}>Change the role assigned to this TC account.</p>
            {selectedAccount.id === 1 ? <div className="tcadmin-role-chip">5 · Owner · Permanent owner account</div> : <>
              <label style={{ display: "block", color: "#a1a1aa", fontSize: 11 }}>Assigned role
                <select value={roleChanges[selectedAccount.id] ?? selectedAccount.role} onChange={e => setRoleChanges(v => ({ ...v, [selectedAccount.id]: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 8, background: "#19191c", color: "#f0f0f2", border: "1px solid #3a3a40", borderRadius: 7, padding: 12 }}>
                  {ROLES.filter(role => role.value !== "owner").map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
                </select>
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}><button className="tcadmin-save" disabled={busy || (roleChanges[selectedAccount.id] ?? selectedAccount.role) === selectedAccount.role} onClick={() => saveRole(selectedAccount)}><Save size={13} style={{ verticalAlign: "middle", marginRight: 5 }} />Save role</button></div>
            </>}
          </section>}
          <section style={{ border: "1px solid #303035", borderRadius: 10, padding: 18 }}>
            <h3 style={{ margin: "0 0 7px", fontSize: 15 }}>Account information</h3>
            <div style={{ display: "grid", gap: 12, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span style={{ color: "#85858d" }}>Username</span><strong>{selectedAccount.username}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span style={{ color: "#85858d" }}>Email</span><strong>{selectedAccount.email || "Not provided"}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span style={{ color: "#85858d" }}>Current role</span><strong>{ROLES.find(r => r.value === selectedAccount.role)?.label || selectedAccount.role}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span style={{ color: "#85858d" }}>Account status</span><strong>{selectedAccount.status || "Not provided"}</strong></div>
            </div>
          </section>
          <section className="tcadmin-subaccounts-panel">
            <div><h3>Sub-accounts</h3><p>Accounts linked to this main TC account. Link only after verifying ownership with the account holder.</p></div>
            {subAccountBusy ? <p className="tcadmin-muted">Updating sub-accounts…</p> : subAccounts.length ? <div className="tcadmin-subaccount-list">{subAccounts.map(child => <div className="tcadmin-subaccount-row" key={child.id}><div><strong>{child.username}</strong><span>TC account #{child.id} · {child.email} · {child.status}</span></div><button className="tcadmin-refresh" disabled={subAccountBusy} onClick={() => saveSubAccount("unlink", child.id)}>Unlink</button></div>)}</div> : <p className="tcadmin-muted">No sub-accounts are linked to this profile.</p>}
            <div className="tcadmin-subaccount-add"><label>Existing TC account ID<input type="number" min="2" step="1" value={subAccountId} onChange={e => setSubAccountId(e.target.value)} placeholder="Enter account ID" /></label><label className="tcadmin-verification"><input type="checkbox" checked={subAccountVerified} onChange={e => setSubAccountVerified(e.target.checked)} />I have verified that the account holder owns or authorizes this sub-account relationship.</label><button className="tcadmin-save" disabled={subAccountBusy || !subAccountVerified || !/^\d+$/.test(subAccountId) || Number(subAccountId) < 2} onClick={() => saveSubAccount("link")}>Link sub-account</button></div>
          </section>
          <p style={{ color: "#777780", fontSize: 11, lineHeight: 1.6, marginTop: 18 }}>Sub-account links are checked by TCAdmin on the server and recorded in TC Accounts audit logs.</p>
        </section>
      </div>}
      {activeSection === "apps" && <p className="tcadmin-security-note"><ShieldCheck size={15} /> OAuth client changes are checked against your TC role on the server.</p>}
    </main>}
  </div>;
}
