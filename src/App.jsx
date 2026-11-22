import React, { useEffect, useState } from "react";
import { ShieldCheck, Users, LogOut, RefreshCw, LockKeyhole, AlertCircle, UserCog, KeyRound, Copy, Trash2, Save, ExternalLink, X, Mail, Paperclip, Send, Download, BadgeCheck, FileCheck2, Settings, AppWindow, UserRound, ChevronDown, Power } from "lucide-react";

const ACCOUNTS = "https://accounts.theegget.com";
const CLIENT_ID = import.meta.env.VITE_TC_OAUTH_CLIENT_ID || "tc_B5LqoZygi4pJcaM_y7YF_roDmGtjYUax";
const REDIRECT_URI = "https://admin.theegget.com/oauth/callback";
const SUPPORT_MAILBOX = "support@theegget.com";
const ROLES = [
  { value: "user", label: "1 · User" },
  { value: "support", label: "2 · Support" },
  { value: "admin", label: "3 · Admin" },
  { value: "co_owner", label: "4 · Co-owner" },
  { value: "owner", label: "5 · Owner" },
  { value: "banned", label: "0 · Banned" }
];
const CAN_MANAGE_CLIENTS = role => ["admin", "co_owner", "owner"].includes(role);
const CAN_MANAGE_OFFICIAL_APPS = role => ["co_owner", "owner"].includes(role);
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
  const [officialApps, setOfficialApps] = useState([]);
  const [officialAppChanges, setOfficialAppChanges] = useState({});
  const [newOfficialApp, setNewOfficialApp] = useState({ name: "", url: "", category: "", description: "", icon: "", sort_order: 0 });
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
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [serviceMaintenance, setServiceMaintenance] = useState([]);
  const [serviceMaintenanceLoading, setServiceMaintenanceLoading] = useState(false);
  const [serviceMaintenanceSaving, setServiceMaintenanceSaving] = useState("");
  const [previewRole, setPreviewRole] = useState("");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [subAccounts, setSubAccounts] = useState([]);
  const [subAccountUsername, setSubAccountUsername] = useState("");
  const [subAccountService, setSubAccountService] = useState("");
  const [subAccountBusy, setSubAccountBusy] = useState(false);
  const [supportEmail, setSupportEmail] = useState(SUPPORT_MAILBOX);
  const [supportPassword, setSupportPassword] = useState("");
  const [supportMailboxUser, setSupportMailboxUser] = useState("");
  const [supportLoginOpen, setSupportLoginOpen] = useState(false);
  const [supportLoginBusy, setSupportLoginBusy] = useState(false);
  const [supportMessages, setSupportMessages] = useState([]);
  const [selectedSupportMessage, setSelectedSupportMessage] = useState(null);
  const [supportReply, setSupportReply] = useState("");
  const [supportInboxBusy, setSupportInboxBusy] = useState(false);
  const [supportReplyBusy, setSupportReplyBusy] = useState(false);
  const [supportSearch, setSupportSearch] = useState("");
  const [supportTickets, setSupportTickets] = useState([]);
  const [selectedSupportTicket, setSelectedSupportTicket] = useState(null);
  const [supportTicketMessages, setSupportTicketMessages] = useState([]);
  const [supportTicketReply, setSupportTicketReply] = useState("");
  const [supportTicketStatus, setSupportTicketStatus] = useState("Open");
  const [supportTicketBusy, setSupportTicketBusy] = useState(false);
  const [supportTicketReplyBusy, setSupportTicketReplyBusy] = useState(false);
  const [verificationRequests, setVerificationRequests] = useState([]);
  const [verificationBusy, setVerificationBusy] = useState(false);

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
    api("/api/auth/me", token).then(async result => {
      if (cancelled) return;
      setUser(result.user);
      if (Number(result.user?.id) === 1) {
        try {
          const response = await fetch(`${ACCOUNTS}/api/tcadmin/role-preview`, { headers: { Authorization: `Bearer ${token}` } });
          const preview = await response.json().catch(() => ({}));
          if (response.ok && !cancelled) setPreviewRole(preview.preview_role || "");
        } catch {}
      }
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


  async function loadOfficialApps() {
    if (!token || !CAN_MANAGE_CLIENTS(user?.role)) return;
    setBusy(true);
    setError("");
    try {
      const result = await api("/api/admin/official-apps", token);
      setOfficialApps(result.apps || []);
      setOfficialAppChanges({});
    } catch (e) {
      setError(e.message || "Could not load official apps.");
    } finally {
      setBusy(false);
    }
  }

  async function saveOfficialApp(app) {
    const draft = app ? (officialAppChanges[app.id] || app) : newOfficialApp;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api("/api/admin/official-apps", token, {
        method: "POST",
        body: JSON.stringify({ ...(app ? { id: app.id } : {}), ...draft })
      });
      setNotice(app ? `Updated ${draft.name} on the homepage.` : `Added ${draft.name} to the homepage.`);
      if (!app) setNewOfficialApp({ name: "", url: "", category: "", description: "", icon: "", sort_order: 0 });
      await loadOfficialApps();
    } catch (e) {
      setError(e.message || "Could not save the official app.");
    } finally {
      setBusy(false);
    }
  }

  async function removeOfficialApp(app) {
    if (!window.confirm(`Remove "${app.name}" from Theegget Creations' homepage?`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/api/admin/official-apps?id=${encodeURIComponent(app.id)}`, token, { method: "DELETE" });
      setNotice(`Removed ${app.name} from the homepage.`);
      await loadOfficialApps();
    } catch (e) {
      setError(e.message || "Could not remove the official app.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (activeSection === "apps" && token && CAN_MANAGE_CLIENTS(user?.role)) loadOfficialApps();
  }, [activeSection, token, user?.role]);

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

  useEffect(() => {
    if (!token || !user) return;
    const sendHeartbeat = () => api("/api/presence/heartbeat", token, { method: "POST" }).catch(() => {});
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000);
    return () => clearInterval(interval);
  }, [token, user?.id]);

  useEffect(() => { if (CAN_MANAGE_SUBACCOUNTS(user?.role)) loadAccounts(); }, [user?.role, token]);
  useEffect(() => { if (CAN_MANAGE_CLIENTS(user?.role)) loadClients(); }, [user?.role, token]);

  async function saveRole(account) {
    const role = roleChanges[account.id];
    if (!role) return;
    let reason = "";
    if (role === "banned") {
      reason = window.prompt("Enter the reason for banning " + account.username + ":") || "";
      reason = reason.trim();
      if (reason.length < 3 || reason.length > 1000) {
        setError("A ban reason between 3 and 1,000 characters is required. The account was not changed.");
        return;
      }
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api("/api/admin/roles", token, {
        method: "POST",
        body: JSON.stringify({ user_id: account.id, role, reason })
      });
      setNotice(`Role updated for TC account #${account.id}.`);
      setSelectedAccount(current => current?.id === account.id ? { ...current, role, ban_reason: role === "banned" ? reason : "" } : current);
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


  async function loadVerificationRequests() {
    if (!token || !CAN_MANAGE_SUBACCOUNTS(user?.role)) return;
    setVerificationBusy(true);
    try {
      const result = await api("/api/admin/verification-requests", token);
      setVerificationRequests(result.requests || []);
      setError("");
    } catch (e) {
      setError(e.message || "Could not load verification requests.");
    } finally {
      setVerificationBusy(false);
    }
  }

  async function reviewVerificationRequest(id, status) {
    if (!["approved", "rejected"].includes(status)) return;
    setVerificationBusy(true);
    setError("");
    setNotice("");
    try {
      await api("/api/admin/verification-requests", token, {
        method: "PATCH",
        body: JSON.stringify({ id, status })
      });
      setNotice(status === "approved" ? "Verification approved." : "Verification request rejected.");
      await loadVerificationRequests();
    } catch (e) {
      setError(e.message || "Could not review this request.");
    } finally {
      setVerificationBusy(false);
    }
  }

  async function openVerificationProof(id) {
    try {
      const response = await fetch("/api/admin/verification-requests?id=" + encodeURIComponent(id) + "&proof=1", {
        headers: { Authorization: "Bearer " + token }
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || result.error || "Could not open proof.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const opened = window.open(url, "_blank", "noopener");
      if (!opened) {
        const link = document.createElement("a");
        link.href = url;
        link.download = "verification-proof";
        link.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setError(e.message || "Could not open proof.");
    }
  }

  useEffect(() => {
    if (activeSection === "verification" && token && CAN_MANAGE_SUBACCOUNTS(user?.role)) loadVerificationRequests();
  }, [activeSection, token, user?.role]);

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

  async function saveSubAccount(action, subAccountId) {
    if (!selectedAccount) return;
    if (action === "create" && (!subAccountUsername.trim() || !subAccountService.trim())) return;
    setSubAccountBusy(true);
    setError("");
    setNotice("");
    try {
      await api("/api/admin/subaccounts", token, {
        method: "POST",
        body: JSON.stringify(action === "create"
          ? { action, main_user_id: selectedAccount.id, username: subAccountUsername.trim(), service: subAccountService.trim() }
          : { action, main_user_id: selectedAccount.id, sub_account_id: subAccountId })
      });
      setNotice(action === "create" ? "Sub-account created and linked to " + selectedAccount.username + "." : "Sub-account unlinked.");
      if (action === "create") {
        setSubAccountUsername("");
        setSubAccountService("");
      }
      await loadSubAccounts(selectedAccount.id);
    } catch (e) {
      setError(e.message || "Could not update sub-accounts.");
    } finally {
      setSubAccountBusy(false);
    }
  }


  async function supportMailboxRequest(path, email = supportMailboxUser, password = supportPassword, payload = {}) {
    const response = await fetch(ACCOUNTS + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ email, password, ...payload })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || result.error || "Mailbox request failed.");
    return result;
  }

  async function loadSupportInbox(email = supportMailboxUser, password = supportPassword) {
    if (!email || !password) return;
    setSupportInboxBusy(true);
    try {
      const result = await supportMailboxRequest("/api/support/mailbox/inbox", email, password);
      setSupportMessages(result.messages || []);
      setError("");
    } catch (e) {
      setError(e.message || "Could not load the support inbox.");
    } finally {
      setSupportInboxBusy(false);
    }
  }

  async function openSupportMessage(uid) {
    setSupportInboxBusy(true);
    setSupportReply("");
    try {
      const result = await supportMailboxRequest("/api/support/mailbox/message", supportMailboxUser, supportPassword, { uid });
      setSelectedSupportMessage(result);
      setSupportMessages(current => current.map(message => message.uid === uid ? { ...message, unread: false } : message));
      setError("");
    } catch (e) {
      setError(e.message || "Could not open this message.");
    } finally {
      setSupportInboxBusy(false);
    }
  }

  async function sendSupportReply(event) {
    event.preventDefault();
    if (!selectedSupportMessage || !supportReply.trim()) return;
    setSupportReplyBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await supportMailboxRequest("/api/support/mailbox/reply", supportMailboxUser, supportPassword, { uid: selectedSupportMessage.uid, message: supportReply.trim(), sender_name: `${user?.username || "Support"} From TC` });
      setNotice(result.message || "Reply sent.");
      setSupportReply("");
      await loadSupportInbox();
    } catch (e) {
      setError(e.message || "Could not send the reply.");
    } finally {
      setSupportReplyBusy(false);
    }
  }

  function downloadSupportAttachment(attachment) {
    try {
      const link = document.createElement("a");
      link.href = "data:" + (attachment.content_type || "application/octet-stream") + ";base64," + attachment.content_base64;
      link.download = attachment.filename || "attachment";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setError("The attachment could not be downloaded.");
    }
  }

  async function loginSupportMailbox(event) {
    event.preventDefault();
    const email = SUPPORT_MAILBOX;
    if (!supportPassword) {
      setError("Enter the support mailbox password.");
      return;
    }
    setSupportLoginBusy(true);
    setError("");
    setNotice("");
    try {
      await supportMailboxRequest("/api/support/mailbox/login", email, supportPassword);
      setSupportMailboxUser(email);
      setSupportLoginOpen(false);
      setSelectedSupportMessage(null);
      setNotice("Mailbox connected: " + email + ".");
      await loadSupportInbox(email, supportPassword);
    } catch (e) {
      setError(e.message || "Mailbox sign-in failed.");
    } finally {
      setSupportLoginBusy(false);
    }
  }

  function signOutSupportMailbox() {
    setSupportMailboxUser("");
    setSupportPassword("");
    setSupportEmail("");
    setSupportMessages([]);
    setSelectedSupportMessage(null);
    setSupportReply("");
    setSupportSearch("");
  }


  async function supportTicketRequest(path, payload = {}) {
    const response = await fetch(ACCOUNTS + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || result.error || "Ticket request failed.");
    return result;
  }

  async function loadSupportTickets() {
    if (!token) return;
    setSupportTicketBusy(true);
    try {
      const result = await supportTicketRequest("/api/support/tickets/list");
      setSupportTickets(result.tickets || []);
      if (selectedSupportTicket) {
        const refreshed = (result.tickets || []).find(ticket => ticket.id === selectedSupportTicket.id);
        if (refreshed) setSelectedSupportTicket(refreshed);
      }
      setError("");
    } catch (e) {
      setError(e.message || "Could not load support tickets.");
    } finally {
      setSupportTicketBusy(false);
    }
  }

  async function openSupportTicket(ticket) {
    setSupportTicketBusy(true);
    setSupportTicketReply("");
    try {
      const result = await supportTicketRequest("/api/support/tickets/messages", { ticket_id: ticket.id });
      setSelectedSupportTicket(result.ticket);
      setSupportTicketStatus(result.ticket.status);
      setSupportTicketMessages(result.messages || []);
      setError("");
    } catch (e) {
      setError(e.message || "Could not open this ticket.");
    } finally {
      setSupportTicketBusy(false);
    }
  }

  async function claimSupportTicket(ticket) {
    setSupportTicketBusy(true);
    setError("");
    setNotice("");
    try {
      await supportTicketRequest("/api/support/tickets/claim", { ticket_id: ticket.id });
      setNotice("Ticket " + ticket.ticket_number + " is now assigned to you. It cannot be reassigned.");
      await loadSupportTickets();
      await openSupportTicket({ ...ticket, assigned_admin_id: user?.id, assigned_admin_username: user?.username });
    } catch (e) {
      setError(e.message || "Could not claim this ticket.");
    } finally {
      setSupportTicketBusy(false);
    }
  }

  async function saveSupportTicketStatus(nextStatus) {
    if (!selectedSupportTicket) return;
    setSupportTicketStatus(nextStatus);
    setSupportTicketBusy(true);
    try {
      await supportTicketRequest("/api/support/tickets/status", { ticket_id: selectedSupportTicket.id, status: nextStatus });
      await loadSupportTickets();
      setSelectedSupportTicket(current => current ? { ...current, status: nextStatus } : current);
      setNotice("Ticket status updated.");
    } catch (e) {
      setError(e.message || "Could not update ticket status.");
      setSupportTicketStatus(selectedSupportTicket.status);
    } finally {
      setSupportTicketBusy(false);
    }
  }

  async function sendSupportTicketReply(event) {
    event.preventDefault();
    if (!selectedSupportTicket || !supportTicketReply.trim()) return;
    setSupportTicketReplyBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await supportTicketRequest("/api/support/tickets/reply", { ticket_id: selectedSupportTicket.id, message: supportTicketReply.trim() });
      setNotice(result.message || "Reply sent.");
      setSupportTicketReply("");
      await openSupportTicket(selectedSupportTicket);
      await loadSupportTickets();
    } catch (e) {
      setError(e.message || "Could not send the ticket reply.");
    } finally {
      setSupportTicketReplyBusy(false);
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
    setSupportTickets([]);
    setSelectedSupportTicket(null);
    setSupportTicketMessages([]);
    setSupportTicketReply("");
    setActiveSection("home");
    signOutSupportMailbox();
    try {
      await fetch(`${ACCOUNTS}/oauth/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: current })
      });
    } catch {}
  }

  const displayRole = user?.id === 1 && previewRole ? previewRole : user?.role;

  useEffect(() => {
    if (activeSection === "support" && token && user) loadSupportTickets();
  }, [activeSection, token, user?.id]);

  useEffect(() => {
    if (activeSection !== "maintenance" || !token || user?.role !== "owner") return;
    let cancelled = false;
    setMaintenanceLoading(true);
    api("/api/admin/maintenance", token).then(result => {
      if (!cancelled) setMaintenanceEnabled(Number(result.maintenance) === 1);
    }).catch(e => {
      if (!cancelled) setError(e.message || "Could not load server maintenance status.");
    }).finally(() => { if (!cancelled) setMaintenanceLoading(false); });
    return () => { cancelled = true; };
  }, [activeSection, token, user?.role]);

  useEffect(() => {
    if (activeSection !== "maintenance" || !token || user?.role !== "owner") return;
    let cancelled = false;
    setServiceMaintenanceLoading(true);
    api("/api/admin/service-maintenance", token).then(result => {
      if (!cancelled) setServiceMaintenance(result.services || []);
    }).catch(e => {
      if (!cancelled) setError(e.message || "Could not load individual service maintenance.");
    }).finally(() => { if (!cancelled) setServiceMaintenanceLoading(false); });
    return () => { cancelled = true; };
  }, [activeSection, token, user?.role]);

  async function toggleServiceMaintenance(service) {
    if (user?.role !== "owner" || serviceMaintenanceSaving) return;
    const next = Number(service.maintenance) === 1 ? 0 : 1;
    setServiceMaintenanceSaving(service.service_id);
    setError("");
    setNotice("");
    try {
      const result = await api("/api/admin/service-maintenance", token, { method: "POST", body: JSON.stringify({ service_id: service.service_id, maintenance: next }) });
      setServiceMaintenance(result.services || []);
      setNotice((next ? "Maintenance enabled for " : "Maintenance disabled for ") + service.name + ".");
    } catch (e) {
      setError(e.message || "Could not update service maintenance.");
    } finally { setServiceMaintenanceSaving(""); }
  }
  async function toggleMaintenance() {
    if (user?.role !== "owner" || maintenanceSaving) return;
    setMaintenanceSaving(true);
    setError("");
    setNotice("");
    try {
      const next = maintenanceEnabled ? 0 : 1;
      const result = await api("/api/admin/maintenance", token, {
        method: "POST",
        body: JSON.stringify({ maintenance: next })
      });
      setMaintenanceEnabled(Number(result.maintenance) === 1);
      setNotice(next ? "Server-wide maintenance enabled." : "Server-wide maintenance disabled.");
    } catch (e) {
      setError(e.message || "Could not update server maintenance.");
    } finally {
      setMaintenanceSaving(false);
    }
  }

  return <div className="tcadmin-root">
    <header className="tcadmin-header">
      <div className="tcadmin-brand"><div className="tcadmin-mark">TC</div><div><strong>Theegget Creations</strong><span>ADMINISTRATION</span></div></div>
      {user && <div className="tcadmin-profile-menu"><button className="tcadmin-profile-trigger" aria-label="Open account menu" aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen(value => !value)}><UserRound size={19} /><ChevronDown size={14} /></button>{profileMenuOpen && <><button className="tcadmin-menu-backdrop" aria-label="Close account menu" onClick={() => setProfileMenuOpen(false)} /><div className="tcadmin-profile-dropdown"><div className="tcadmin-profile-identity"><strong>{user.username}</strong><span>TC Account · #{user.id}</span></div><a href={ACCOUNTS} className="tcadmin-profile-option" onClick={() => setProfileMenuOpen(false)}><UserCog size={16} /> Go to TC Accounts</a><button className="tcadmin-profile-option" onClick={() => { setProfileMenuOpen(false); signOut(); }}><LogOut size={16} /> Sign out</button></div></>}</div>}
    </header>
    {loading ? <main className="tcadmin-centered"><div className="tcadmin-spinner" /><h1>Checking TC Accounts</h1><p>Verifying your sign-in and access level.</p></main> :
    !user ? <main className="tcadmin-centered"><div className="tcadmin-hero-icon"><LockKeyhole size={24} /></div><p className="tcadmin-kicker">SECURE ADMINISTRATION</p><h1>Sign in with TC</h1><p className="tcadmin-subtitle">Use your TC Account to continue. Access to this admin panel is granted separately from a normal TC sign-in.</p>
      {error && <div className="tcadmin-error"><AlertCircle size={17} />{error}</div>}
      <button className="tcadmin-primary" onClick={() => startLogin().catch(e => setError(e.message))}>Continue with TC <span>→</span></button>
      <p className="tcadmin-footnote">A TC account alone does not grant administrative access.</p>
    </main> :
    user.role === "banned" ? <main className="tcadmin-centered tcadmin-banned-screen"><div className="tcadmin-banned-card"><div className="tcadmin-banned-icon"><LockKeyhole size={25} /></div><p className="tcadmin-kicker">THEEGGET CREATIONS / ACCOUNT STATUS</p><h1>Access restricted</h1><p className="tcadmin-subtitle">This TC account has been banned from TCAdmin. Access to the administration workspace is disabled.</p><div className="tcadmin-ban-details"><div><span>Account</span><strong>{user.username}</strong></div><div><span>TC account ID</span><strong>#{user.id}</strong></div><div><span>Status</span><strong className="tcadmin-ban-status">Banned</strong></div></div><p className="tcadmin-ban-help">If you believe this action was made in error, contact TC Support and include your account ID.</p><a className="tcadmin-ban-contact" href="mailto:support@theegget.com">Contact TC Support</a><button className="tcadmin-secondary" onClick={signOut}><LogOut size={16} /> Sign out</button></div></main> :
    user.role === "user" ? <main className="tcadmin-centered"><div className="tcadmin-hero-icon"><ShieldCheck size={24} /></div><h1>Access not granted</h1><p className="tcadmin-subtitle">Signed in as <strong>{user.username}</strong> (TC account #{user.id}). Your TC account has the default User role, which does not grant access to the admin workspace.</p><button className="tcadmin-secondary" onClick={signOut}><LogOut size={16} /> Sign out</button></main> :
    <main className="tcadmin-dashboard">
      <div className="tcadmin-page-heading"><div><p className="tcadmin-kicker">THEEGGET CREATIONS / ADMIN</p><h1>TC administration</h1><p>Manage registered applications and access to TCAdmin.</p></div><span className="tcadmin-role-chip">{ROLES.find(r => r.value === displayRole)?.label || displayRole}</span></div>
      {error && <div className="tcadmin-error"><AlertCircle size={17} />{error}</div>}
      {notice && <div className="tcadmin-notice">{notice}</div>}

      <div className="tcadmin-workspace">
      <aside className="tcadmin-sidebar">
        <div className="tcadmin-sidebar-label">WORKSPACE</div>
        <nav className="tcadmin-navigation" aria-label="Administration sections">
        {[
          { id: "home", label: "Overview", icon: <ShieldCheck size={16} /> },
          { id: "users", label: "Users", icon: <Users size={16} /> },
          ...(CAN_MANAGE_SUBACCOUNTS(displayRole) ? [{ id: "support", label: "Support", icon: <Mail size={16} /> }] : []),
          ...(CAN_MANAGE_SUBACCOUNTS(displayRole) ? [{ id: "verification", label: "Verification", icon: <BadgeCheck size={16} /> }] : []),
          ...(CAN_MANAGE_CLIENTS(displayRole) ? [{ id: "apps", label: "Apps", icon: <KeyRound size={16} /> }] : []),
          ...(user?.role === "owner" ? [{ id: "maintenance", label: "Maintenance", icon: <Power size={16} /> }] : []),
          { id: "settings", label: "Settings", icon: <Settings size={16} /> }
        ].map(item => <button key={item.id} className={activeSection === item.id ? "tcadmin-nav-button active" : "tcadmin-nav-button"} onClick={() => setActiveSection(item.id)}>{item.icon}{item.label}</button>)}
      </nav>
      </aside>
      <div className="tcadmin-workspace-content">

      {user.id === 1 && previewRole && <div className="tcadmin-notice">Acting as {ROLES.find(r => r.value === previewRole)?.label || previewRole}. This is a UI preview only; server permissions remain Owner.</div>}
      {activeSection === "maintenance" && user?.role === "owner" && <section className="tcadmin-panel">
<div className="tcadmin-panel-title"><div><Power size={19} /><div><h2>Maintenance</h2><p>Manage server-wide and individual service maintenance.</p></div></div><button className="tcadmin-refresh" onClick={() => setActiveSection("home")}>Back to overview</button></div>
<div style={{ padding: 20 }}>
<div className="tcadmin-maintenance-block"><div><h3>Server-wide maintenance</h3><p>Overrides individual settings and marks every service as under maintenance.</p></div><strong>{maintenanceLoading ? "Checking…" : maintenanceEnabled ? "Enabled" : "Disabled"}</strong><button className={maintenanceEnabled ? "tcadmin-danger" : "tcadmin-save"} onClick={toggleMaintenance} disabled={maintenanceLoading || maintenanceSaving}>{maintenanceSaving ? "Saving…" : maintenanceEnabled ? "Disable server maintenance" : "Enable server maintenance"}</button></div>
<div className="tcadmin-maintenance-services"><div><h3>Individual services</h3><p>These settings only affect the selected service unless server-wide maintenance is enabled.</p></div>
{serviceMaintenanceLoading ? <p className="tcadmin-muted">Loading services…</p> : serviceMaintenance.map(service => <div className="tcadmin-maintenance-service" key={service.service_id}><div><strong>{service.name}</strong><span>{service.host}</span></div><span className={Number(service.maintenance) === 1 ? "tcadmin-maintenance-on" : "tcadmin-maintenance-off"}>{Number(service.maintenance) === 1 ? "Maintenance" : "Operational checks"}</span><button className={Number(service.maintenance) === 1 ? "tcadmin-danger" : "tcadmin-save"} disabled={Boolean(serviceMaintenanceSaving)} onClick={() => toggleServiceMaintenance(service)}>{serviceMaintenanceSaving === service.service_id ? "Saving…" : Number(service.maintenance) === 1 ? "Disable" : "Enable maintenance"}</button></div>)}
</div><p className="tcadmin-muted">Only the Owner can change these settings. Values are stored in the shared TC D1 database (0 = off, 1 = on).</p></div></section>}

      {activeSection === "settings" && <section className="tcadmin-panel"><div className="tcadmin-panel-title"><div><Settings size={19} /><div><h2>Settings</h2><p>Manage your TCAdmin workspace preferences.</p></div></div></div><p className="tcadmin-muted">TC Admin display preferences are managed in TC Accounts.</p></section>}

      {activeSection === "home" && <section className="tcadmin-section-grid">
        <button className="tcadmin-section-card" onClick={() => setActiveSection("users")}><Users size={21} /><strong>Users</strong><span>Manage TC accounts, roles, and permissions.</span><b>Open Users →</b></button>
        {CAN_MANAGE_SUBACCOUNTS(displayRole) && <button className="tcadmin-section-card" onClick={() => setActiveSection("verification")}><BadgeCheck size={21} /><strong>Verification requests</strong><span>Review account, business, and group verification applications.</span><b>Review requests →</b></button>}
        <button className="tcadmin-section-card" onClick={() => setActiveSection("support")}><Mail size={21} /><strong>Support</strong><span>Open the employee support mailbox workspace.</span><b>Open Support →</b></button>
        {CAN_MANAGE_CLIENTS(displayRole) && <button className="tcadmin-section-card" onClick={() => setActiveSection("apps")}><KeyRound size={21} /><strong>Apps</strong><span>Manage OAuth registrations and application settings.</span><b>Open Apps →</b></button>}
      </section>}

      
      {activeSection === "verification" && <section className="tcadmin-panel">
        <div className="tcadmin-panel-title"><div><BadgeCheck size={19} /><div><h2>Verification requests</h2><p>Review proof submitted by TC Social accounts.</p></div></div><button className="tcadmin-refresh" onClick={loadVerificationRequests} disabled={verificationBusy}><RefreshCw size={14} /> Refresh</button></div>
        {verificationRequests.length ? <div className="tcadmin-verification-list">{verificationRequests.map(item => <article className="tcadmin-verification-request" key={item.id}>
          <div className="tcadmin-verification-request-heading"><div><strong>@{item.username}</strong><span>{item.verification_type} verification · Request #{item.id}</span></div><span className="tcadmin-role-chip">{item.status}</span></div>
          <p>{item.explanation}</p><div className="tcadmin-verification-request-actions"><button className="tcadmin-secondary" onClick={() => openVerificationProof(item.id)}><FileCheck2 size={14} /> View proof · {item.file_name}</button>{["admin","co_owner","owner"].includes(displayRole) && item.status === "pending" && <><button className="tcadmin-save" disabled={verificationBusy} onClick={() => reviewVerificationRequest(item.id,"approved")}>Approve</button><button className="tcadmin-danger" disabled={verificationBusy} onClick={() => reviewVerificationRequest(item.id,"rejected")}>Reject</button></>}</div>
          <small>Submitted {new Date(item.created_at).toLocaleString()}</small>
        </article>)}</div> : <div className="tcadmin-muted">{verificationBusy ? "Loading requests…" : "No pending verification requests."}</div>}
        {["support"].includes(displayRole) && <div className="tcadmin-support-note"><LockKeyhole size={15} /> Support can inspect submitted proof. Admin, co-owner, and owner roles can approve or reject requests.</div>}
      </section>}


      {activeSection === "support" && <section className="tcadmin-panel tcadmin-support-workspace">
        <div className="tcadmin-panel-title">
          <div><Mail size={19} /><div><h2>Support tickets</h2><p>Every request has one ticket number and one permanent assigned admin.</p></div></div>
          <button className="tcadmin-refresh" onClick={loadSupportTickets} disabled={supportTicketBusy}><RefreshCw size={14} /> Refresh</button>
        </div>
        <div className="tcadmin-support-split tcadmin-support-connected" style={{ minHeight: 520 }}>
          <div className="tcadmin-support-list">
            <div className="tcadmin-support-search"><input value={supportSearch} onChange={e => setSupportSearch(e.target.value)} placeholder="Search tickets" aria-label="Search tickets" /></div>
            <div className="tcadmin-support-message-list">
              {supportTicketBusy && !supportTickets.length ? <div className="tcadmin-support-empty"><div className="tcadmin-spinner" /><span>Loading tickets…</span></div> : supportTickets.filter(ticket => (ticket.ticket_number + " " + ticket.sender_email + " " + ticket.subject + " " + ticket.status).toLowerCase().includes(supportSearch.toLowerCase())).map(ticket => <button key={ticket.id} className={"tcadmin-support-message" + (selectedSupportTicket?.id === ticket.id ? " active" : "")} onClick={() => openSupportTicket(ticket)}>
                <span className="tcadmin-support-message-top"><strong>{ticket.ticket_number}</strong><i style={{ fontStyle: "normal", fontSize: 10, color: "#a1a1aa" }}>{ticket.status}</i></span>
                <span className="tcadmin-support-message-subject">{ticket.subject}</span>
                <span className="tcadmin-support-message-date">{ticket.sender_email} · {ticket.assigned_username ? "Assigned to " + ticket.assigned_username : "Unassigned"}</span>
              </button>)}
              {!supportTicketBusy && !supportTickets.length && <div className="tcadmin-support-empty"><Mail size={22} /><strong>No support tickets</strong><span>New emails to support@theegget.com appear automatically, usually within five minutes.</span></div>}
              {!supportTicketBusy && supportTickets.length > 0 && !supportTickets.some(ticket => (ticket.ticket_number + " " + ticket.sender_email + " " + ticket.subject + " " + ticket.status).toLowerCase().includes(supportSearch.toLowerCase())) && <div className="tcadmin-support-empty"><strong>No matching tickets</strong></div>}
            </div>
          </div>
          <div className="tcadmin-support-conversation tcadmin-support-message-view">
            {selectedSupportTicket ? <div className="tcadmin-support-message-content">
              <div className="tcadmin-support-message-heading">
                <div><h3>{selectedSupportTicket.ticket_number}</h3><span>{selectedSupportTicket.subject}</span><span style={{ display: "block", marginTop: 5 }}>{selectedSupportTicket.sender_email}</span></div>
                <span className="tcadmin-role-chip">{selectedSupportTicket.status}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "12px 0", borderBottom: "1px solid #29292d" }}>
                <span style={{ color: "#a1a1aa", fontSize: 12 }}>{selectedSupportTicket.assigned_username ? "Assigned to " + selectedSupportTicket.assigned_username : "This ticket has not been claimed."}</span>
                {!selectedSupportTicket.assigned_admin_id ? <button className="tcadmin-save" disabled={supportTicketBusy} onClick={() => claimSupportTicket(selectedSupportTicket)}>Claim ticket</button> : String(selectedSupportTicket.assigned_admin_id) === String(user?.id) ? <select value={supportTicketStatus} disabled={supportTicketBusy} onChange={e => saveSupportTicketStatus(e.target.value)} style={{ background: "#19191c", color: "#f0f0f2", border: "1px solid #3a3a40", borderRadius: 7, padding: "9px 11px" }}><option>Open</option><option>In Progress</option><option>Waiting for User</option><option>Resolved</option><option>Closed</option></select> : <span className="tcadmin-role-chip">Assigned · Locked</span>}
              </div>
              <div style={{ display: "grid", gap: 12, padding: "16px 0" }}>
                {supportTicketMessages.map(message => <article key={message.id} style={{ border: "1px solid #303035", borderRadius: 9, padding: 13, background: message.direction === "outbound" ? "#17171a" : "#101012" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}><strong style={{ fontSize: 12 }}>{message.direction === "outbound" ? "TC Support" : message.sender_email || "Customer"}</strong><span style={{ color: "#777780", fontSize: 10 }}>{message.created_at ? new Date(message.created_at).toLocaleString() : ""}</span></div>
                  <pre className="tcadmin-support-message-body" style={{ margin: 0 }}>{message.body}</pre>
                </article>)}
                {!supportTicketMessages.length && <p className="tcadmin-muted">No messages are attached to this ticket.</p>}
              </div>
              {String(selectedSupportTicket.assigned_admin_id || "") === String(user?.id) ? <form className="tcadmin-support-reply" onSubmit={sendSupportTicketReply}><label htmlFor="tcadmin-ticket-reply">Reply to customer</label><textarea id="tcadmin-ticket-reply" rows={5} maxLength={20000} value={supportTicketReply} onChange={e => setSupportTicketReply(e.target.value)} placeholder="Write your reply…" required /><div><span>Replies include the ticket number and end with “Best, TC”.</span><button className="tcadmin-save" type="submit" disabled={supportTicketReplyBusy || !supportTicketReply.trim()}><Send size={14} />{supportTicketReplyBusy ? "Sending…" : "Send reply"}</button></div></form> : <div className="tcadmin-support-note"><LockKeyhole size={15} />{selectedSupportTicket.assigned_admin_id ? "Only " + selectedSupportTicket.assigned_username + " can reply or change this ticket." : "Claim this ticket to become its permanent assigned admin."}</div>}
            </div> : <div className="tcadmin-support-empty"><Mail size={26} /><strong>Select a ticket</strong><span>Choose a ticket to read the conversation, claim it, and respond.</span></div>}
          </div>
        </div>
        <div className="tcadmin-support-note"><ShieldCheck size={15} /> Tickets cannot be reassigned. Once an admin claims a ticket, only that admin can reply or change its status.</div>
      </section>}

      {activeSection === "apps" && CAN_MANAGE_CLIENTS(displayRole) && <section className="tcadmin-panel" style={{ marginBottom: 22 }}>
        <div className="tcadmin-panel-title"><div><AppWindow size={19} /><div><h2>Official apps</h2><p>Control which apps appear in the Apps section of Theegget Creations' homepage.</p></div></div><button className="tcadmin-refresh" onClick={loadOfficialApps} disabled={busy}><RefreshCw size={15} /> Refresh</button></div>
        {CAN_MANAGE_OFFICIAL_APPS(displayRole) && <><form onSubmit={event => { event.preventDefault(); saveOfficialApp(null); }} style={{ padding: 20, display: "grid", gap: 13, borderBottom: "1px solid #29292d" }}>
          <strong style={{ fontSize: 13 }}>Add an official app</strong>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 12 }}>
            <label style={{ color: "#a1a1aa", fontSize: 11 }}>App name<input required minLength={2} maxLength={70} value={newOfficialApp.name} onChange={e => setNewOfficialApp(v => ({ ...v, name: e.target.value }))} placeholder="App name" style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 6, background: "#19191c", color: "#f0f0f2", border: "1px solid #3a3a40", borderRadius: 7, padding: 10 }} /></label>
            <label style={{ color: "#a1a1aa", fontSize: 11 }}>App URL<input required type="url" maxLength={2048} value={newOfficialApp.url} onChange={e => setNewOfficialApp(v => ({ ...v, url: e.target.value }))} placeholder="https://app.theegget.com" style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 6, background: "#19191c", color: "#f0f0f2", border: "1px solid #3a3a40", borderRadius: 7, padding: 10 }} /></label>
            <label style={{ color: "#a1a1aa", fontSize: 11 }}>Category label<input maxLength={50} value={newOfficialApp.category} onChange={e => setNewOfficialApp(v => ({ ...v, category: e.target.value }))} placeholder="PRODUCTIVITY APP" style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 6, background: "#19191c", color: "#f0f0f2", border: "1px solid #3a3a40", borderRadius: 7, padding: 10 }} /></label>
            <label style={{ color: "#a1a1aa", fontSize: 11 }}>Card icon text<input maxLength={8} value={newOfficialApp.icon} onChange={e => setNewOfficialApp(v => ({ ...v, icon: e.target.value }))} placeholder="e.g. TC" style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 6, background: "#19191c", color: "#f0f0f2", border: "1px solid #3a3a40", borderRadius: 7, padding: 10 }} /></label>
            <label style={{ color: "#a1a1aa", fontSize: 11 }}>Display order<input type="number" step="1" value={newOfficialApp.sort_order} onChange={e => setNewOfficialApp(v => ({ ...v, sort_order: Number(e.target.value) }))} style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 6, background: "#19191c", color: "#f0f0f2", border: "1px solid #3a3a40", borderRadius: 7, padding: 10 }} /></label>
          </div>
          <label style={{ color: "#a1a1aa", fontSize: 11 }}>Description<textarea maxLength={240} rows={2} value={newOfficialApp.description} onChange={e => setNewOfficialApp(v => ({ ...v, description: e.target.value }))} placeholder="Briefly describe this app." style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 6, resize: "vertical", background: "#19191c", color: "#f0f0f2", border: "1px solid #3a3a40", borderRadius: 7, padding: 10 }} /></label>
          <div><button className="tcadmin-save" type="submit" disabled={busy || !newOfficialApp.name.trim() || !newOfficialApp.url.trim()}><AppWindow size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />Add to homepage</button></div>
        </form>
        {busy && !officialApps.length ? <p className="tcadmin-muted">Loading official apps…</p> : officialApps.length ? <div style={{ display: "grid", gap: 0 }}>
          {officialApps.map(app => {
            const draft = officialAppChanges[app.id] || app;
            const changed = ["name", "url", "category", "description", "icon", "sort_order"].some(key => String(draft[key] ?? "") !== String(app[key] ?? ""));
            return <article key={app.id} style={{ padding: 20, borderBottom: "1px solid #252529" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12 }}><div><strong>{app.name}</strong><div style={{ color: "#85858d", fontSize: 11, marginTop: 4 }}>Homepage listing · ID {app.id}</div></div><a href={app.url} target="_blank" rel="noreferrer" style={{ color: "#d5d5dc", fontSize: 11 }}>Open app ↗</a></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 12 }}>
                {[
                  ["name", "App name", 70],
                  ["url", "App URL", 2048],
                  ["category", "Category label", 50],
                  ["icon", "Card icon text", 8]
                ].map(([key, label, max]) => <label key={key} style={{ color: "#a1a1aa", fontSize: 11 }}>{label}<input maxLength={max} value={draft[key] || ""} disabled={!CAN_MANAGE_OFFICIAL_APPS(displayRole)} onChange={e => setOfficialAppChanges(v => ({ ...v, [app.id]: { ...draft, [key]: e.target.value } }))} style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 6, background: "#19191c", color: "#f0f0f2", border: "1px solid #3a3a40", borderRadius: 7, padding: 10 }} /></label>)}
                <label style={{ color: "#a1a1aa", fontSize: 11 }}>Display order<input type="number" step="1" value={draft.sort_order ?? 0} disabled={!CAN_MANAGE_OFFICIAL_APPS(displayRole)} onChange={e => setOfficialAppChanges(v => ({ ...v, [app.id]: { ...draft, sort_order: Number(e.target.value) } }))} style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 6, background: "#19191c", color: "#f0f0f2", border: "1px solid #3a3a40", borderRadius: 7, padding: 10 }} /></label>
              </div>
              <label style={{ display: "block", color: "#a1a1aa", fontSize: 11, marginTop: 12 }}>Description<textarea maxLength={240} rows={2} value={draft.description || ""} disabled={!CAN_MANAGE_OFFICIAL_APPS(displayRole)} onChange={e => setOfficialAppChanges(v => ({ ...v, [app.id]: { ...draft, description: e.target.value } }))} style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 6, resize: "vertical", background: "#19191c", color: "#f0f0f2", border: "1px solid #3a3a40", borderRadius: 7, padding: 10 }} /></label>
              {CAN_MANAGE_OFFICIAL_APPS(displayRole) && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 13 }}><button className="tcadmin-save" disabled={busy || !changed} onClick={() => saveOfficialApp(app)}><Save size={13} style={{ verticalAlign: "middle", marginRight: 5 }} />Save changes</button><button className="tcadmin-refresh" disabled={busy} onClick={() => removeOfficialApp(app)}><Trash2 size={13} /> Remove from homepage</button></div>}
            </article>;
          })}
        </div> : <p className="tcadmin-muted" style={{ padding: 20 }}>No official apps are listed on the homepage.</p>}
        <p className="tcadmin-muted" style={{ margin: 0, padding: "0 20px 18px" }}>Only Co-Owners and the Owner can add, edit, or remove homepage listings.</p></>}
        {!CAN_MANAGE_OFFICIAL_APPS(displayRole) && <div style={{ padding: 20 }}><p className="tcadmin-muted">Read-only access. Only Co-Owners and the Owner can manage these listings.</p>{officialApps.length ? officialApps.map(app => <div key={app.id} style={{ padding: "10px 0", borderBottom: "1px solid #252529" }}><strong>{app.name}</strong><div className="tcadmin-muted">{app.category} · {app.description}</div><a href={app.url} target="_blank" rel="noreferrer">Open app ↗</a></div>) : <p className="tcadmin-muted">No official apps are listed on the homepage.</p>}</div>}
      </section>}

      {activeSection === "apps" && CAN_SEND_MAIL(displayRole) && <section className="tcadmin-panel" style={{ marginBottom: 22 }}>
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

      {activeSection === "apps" && CAN_MANAGE_CLIENTS(displayRole) && <section className="tcadmin-panel" style={{ marginBottom: 22 }}>
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

      {activeSection === "users" && (CAN_MANAGE_SUBACCOUNTS(displayRole) ? <section className="tcadmin-panel"><div className="tcadmin-panel-title"><div><Users size={19} /><div><h2>TC accounts</h2><p>{displayRole === "owner" ? "Only TC account ID 1 can change roles. Support and higher roles can manage sub-accounts." : "Support and higher roles can manage sub-account relationships after ownership verification."}</p></div></div><button className="tcadmin-refresh" onClick={loadAccounts} disabled={busy}><RefreshCw size={15} /> Refresh</button></div>
        {busy && !accounts.length ? <p className="tcadmin-muted">Loading accounts…</p> : accounts.length ? <div className="tcadmin-table-wrap"><table className="tcadmin-table"><thead><tr><th>TC account</th><th>Email</th><th>Current role</th>{displayRole === "owner" && <><th>Assign role</th><th /></>}</tr></thead><tbody>{accounts.map(account => <tr key={account.id} onClick={() => { setSelectedAccount(account); loadSubAccounts(account.id); }} style={{ cursor: "pointer" }} title={"Open management profile for " + account.username}><td><div className={`tcadmin-account-identity`}><span className={`tcadmin-presence-ring ${account.is_online ? "is-online" : "is-offline"}`}>{account.username.slice(0,1).toUpperCase()}</span><span><strong>{account.username}</strong><span className="tcadmin-cell-sub">Account ID {account.id}{account.status ? " · " + account.status : ""}</span></span></div></td><td>{account.email || "Not provided"}</td><td><span className="tcadmin-role-chip">{account.id === 1 ? "5 · Owner" : ROLES.find(r => r.value === account.role)?.label || "1 · User"}</span></td>{displayRole === "owner" && <><td>{account.id === 1 ? <span className="tcadmin-muted">Permanent owner</span> : <select onClick={e => e.stopPropagation()} value={roleChanges[account.id] ?? account.role} onChange={e => setRoleChanges(v => ({ ...v, [account.id]: e.target.value }))}>{ROLES.filter(role => role.value !== "owner").map(role => <option key={role.value} value={role.value}>{role.label}</option>)}</select>}</td><td>{account.id === 1 ? null : <button className="tcadmin-save" disabled={busy || (roleChanges[account.id] ?? account.role) === account.role} onClick={e => { e.stopPropagation(); saveRole(account); }}>Save</button>}</td></>}</tr>)}</tbody></table></div> : <p className="tcadmin-muted">No TC accounts were returned.</p>}
      </section> : !CAN_MANAGE_CLIENTS(displayRole) ? <section className="tcadmin-panel tcadmin-no-role-tools"><UserCog size={24} /><h2>Administrative tools</h2><p>Your role allows access to the TCAdmin workspace, but only TC account ID 1 can assign or change roles.</p></section> : null)}
      {activeSection === "users" && selectedAccount && CAN_MANAGE_SUBACCOUNTS(displayRole) && <div onClick={() => setSelectedAccount(null)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.72)", display: "flex", justifyContent: "flex-end" }}>
        <section onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Management panel for ${selectedAccount.username}`} style={{ width: "min(620px, 100%)", height: "100%", overflowY: "auto", background: "#111113", borderLeft: "1px solid #303035", padding: "24px", boxSizing: "border-box", boxShadow: "-20px 0 60px rgba(0,0,0,.35)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 28 }}>
            <div><p className="tcadmin-kicker">ACCOUNT MANAGEMENT</p><h2 style={{ margin: "8px 0 5px", fontSize: 25 }}>{selectedAccount.username}</h2><p style={{ color: "#85858d", margin: 0, fontSize: 12 }}>TC account #{selectedAccount.id}</p></div>
            <button className="tcadmin-refresh" onClick={() => setSelectedAccount(null)} aria-label="Close management panel"><X size={17} /> Close</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginBottom: 24 }}>
            <div style={{ background: "#19191c", border: "1px solid #303035", borderRadius: 9, padding: 15 }}><div style={{ color: "#85858d", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Account ID</div><strong style={{ display: "block", marginTop: 8, fontSize: 18 }}>#{selectedAccount.id}</strong></div>
            <div style={{ background: "#19191c", border: "1px solid #303035", borderRadius: 9, padding: 15 }}><div style={{ color: "#85858d", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Account status</div><strong style={{ display: "block", marginTop: 8, fontSize: 18, textTransform: "capitalize" }}>{selectedAccount.status || "Unknown"}</strong></div>
          </div>
          {displayRole === "owner" && <section style={{ border: "1px solid #303035", borderRadius: 10, padding: 18, marginBottom: 16 }}>
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
              {selectedAccount.role === "banned" && <div style={{ display: "grid", gap: 6 }}><span style={{ color: "#85858d" }}>Ban reason</span><strong style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{selectedAccount.ban_reason || "No reason recorded"}</strong></div>}
            </div>
          </section>
          <section className="tcadmin-subaccounts-panel">
            <div><h3>Sub-accounts</h3><p>Create service-specific usernames under {selectedAccount.username}. The parent account is assigned automatically.</p></div>
            {subAccountBusy ? <p className="tcadmin-muted">Updating sub-accounts…</p> : subAccounts.length ? <div className="tcadmin-subaccount-list">{subAccounts.map(child => <div className="tcadmin-subaccount-row" key={child.id}><div><strong>{child.username}</strong><span>{child.service} · Created {child.created_at ? new Date(child.created_at).toLocaleDateString() : "date unavailable"}</span></div><button className="tcadmin-refresh" disabled={subAccountBusy} onClick={() => saveSubAccount("unlink", child.id)}>Unlink</button></div>)}</div> : <p className="tcadmin-muted">No sub-accounts have been created for this profile.</p>}
            <div className="tcadmin-subaccount-add">
              <label>Sub username<input type="text" value={subAccountUsername} onChange={e => setSubAccountUsername(e.target.value)} placeholder="Enter sub username" maxLength={32} autoComplete="off" /></label>
              <label>Service<input type="text" value={subAccountService} onChange={e => setSubAccountService(e.target.value)} placeholder="Enter service name" maxLength={64} autoComplete="off" /></label>
              <button className="tcadmin-save" disabled={subAccountBusy || !subAccountUsername.trim() || !subAccountService.trim()} onClick={() => saveSubAccount("create")}>Create sub-account</button>
            </div>
          </section>
          <p style={{ color: "#777780", fontSize: 11, lineHeight: 1.6, marginTop: 18 }}>Sub-account creation and removal are recorded in TC Accounts audit logs.</p>
        </section>
      </div>}
      {activeSection === "apps" && <p className="tcadmin-security-note"><ShieldCheck size={15} /> OAuth client changes are checked against your TC role on the server.</p>}
      </div>
      </div>
    </main>}
  </div>;
}
