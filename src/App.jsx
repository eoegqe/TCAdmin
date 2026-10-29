import { useMemo, useState } from "react";
import {
  Activity, ArrowDownLeft, ArrowRight, BadgeCheck, Bell, ChevronDown,
  CircleHelp, Clock3, Command, ExternalLink, FileCheck2, Filter, Headset,
  LayoutDashboard, Link2, LockKeyhole, LogOut, Menu, MoreHorizontal,
  Search, Settings2, Shield, ShieldAlert, ShieldCheck, SlidersHorizontal,
  UserCog, UserRound, Users, X
} from "lucide-react";

const initialRequests = [
  { id: "TC-1048", title: "Change linked account username", user: "northstar", type: "Identity change", service: "Eggser", date: "Today, 9:42 AM", status: "Needs review", priority: "High" },
  { id: "TC-1047", title: "Link an external account", user: "pixelpilot", type: "Sub-account link", service: "Eggser", date: "Today, 8:16 AM", status: "Needs review", priority: "Normal" },
  { id: "TC-1046", title: "Administrator restriction override", user: "blocksmith", type: "Security override", service: "Eggser", date: "Yesterday", status: "Waiting for support", priority: "High" },
  { id: "TC-1045", title: "Account access assistance", user: "mossybyte", type: "Account support", service: "TC Accounts", date: "Yesterday", status: "Waiting for support", priority: "Normal" }
];

const initialAccounts = [
  { username: "northstar", display: "North Star", email: "n•••••@example.com", joined: "Oct 18, 2026", status: "Active", subs: 2 },
  { username: "pixelpilot", display: "Pixel Pilot", email: "p•••••@example.com", joined: "Oct 12, 2026", status: "Active", subs: 1 },
  { username: "blocksmith", display: "Blocksmith", email: "b•••••@example.com", joined: "Sep 29, 2026", status: "Review", subs: 3 },
  { username: "mossybyte", display: "Mossy Byte", email: "m•••••@example.com", joined: "Sep 11, 2026", status: "Active", subs: 0 }
];

const initialSubAccounts = [
  { owner: "northstar", service: "Eggser", identity: "NorthStar_92", kind: "Personal", verified: "Verified", admin: "Eligible" },
  { owner: "northstar", service: "TC Store", identity: "northstar-store", kind: "Personal", verified: "Verified", admin: "Not applicable" },
  { owner: "pixelpilot", service: "Eggser", identity: "PixelPilot44", kind: "Shared", verified: "Verified", admin: "Ineligible" },
  { owner: "blocksmith", service: "Eggser", identity: "CraftBlocker", kind: "Personal", verified: "Pending", admin: "Ineligible" },
  { owner: "blocksmith", service: "Eggser", identity: "BlockSmithAlt", kind: "Shared", verified: "Verified", admin: "Ineligible" },
  { owner: "blocksmith", service: "TC Store", identity: "bs-store", kind: "Personal", verified: "Verified", admin: "Not applicable" }
];

const nav = [
  { group: "Workspace", items: [
    { id: "Overview", label: "Overview", icon: LayoutDashboard },
    { id: "Accounts", label: "Accounts", icon: Users, count: "4" },
    { id: "Sub-accounts", label: "Sub-accounts", icon: Link2, count: "6" },
    { id: "Support queue", label: "Support queue", icon: Headset, count: "4" }
  ]},
  { group: "Administration", items: [
    { id: "Staff & access", label: "Staff & access", icon: UserCog },
    { id: "Service policies", label: "Service policies", icon: ShieldCheck },
    { id: "Activity log", label: "Activity log", icon: Activity },
    { id: "Settings", label: "Settings", icon: Settings2 }
  ]}
];

function Badge({ children, tone = "neutral" }) {
  return <span className={`badge badge-${tone}`}><span className="badge-dot" />{children}</span>;
}

function StatCard({ icon: Icon, label, value, detail, tone = "default" }) {
  return <article className="stat-card">
    <div className={`stat-icon ${tone}`}><Icon size={18} /></div>
    <div className="stat-copy"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
  </article>;
}

function EmptyState({ title, detail }) {
  return <div className="empty-state"><Search size={23} /><strong>{title}</strong><span>{detail}</span></div>;
}

export default function App() {
  const [page, setPage] = useState("Overview");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [requests, setRequests] = useState(initialRequests);
  const [notice, setNotice] = useState("");
  const [showProfile, setShowProfile] = useState(false);

  const filteredAccounts = useMemo(() => initialAccounts.filter(a =>
    [a.username, a.display, a.email, a.status].join(" ").toLowerCase().includes(query.toLowerCase()) &&
    (filter === "All" || a.status === filter)
  ), [query, filter]);

  const filteredSubs = useMemo(() => initialSubAccounts.filter(a =>
    [a.owner, a.service, a.identity, a.kind, a.verified, a.admin].join(" ").toLowerCase().includes(query.toLowerCase()) &&
    (filter === "All" || a.kind === filter)
  ), [query, filter]);

  const filteredRequests = useMemo(() => requests.filter(r =>
    [r.id, r.title, r.user, r.type, r.service, r.status].join(" ").toLowerCase().includes(query.toLowerCase()) &&
    (filter === "All" || r.status === filter)
  ), [requests, query, filter]);

  function changePage(next) {
    setPage(next);
    setQuery("");
    setFilter("All");
    setMobileNav(false);
    setSelectedRequest(null);
    setNotice("");
  }

  function updateRequest(id, status) {
    setRequests(current => current.map(r => r.id === id ? { ...r, status } : r));
    setSelectedRequest(null);
    setNotice(`${id} marked as ${status.toLowerCase()} in this demo.`);
  }

  const pageDescription = {
    "Overview": "A snapshot of account activity and support operations.",
    "Accounts": "Find TC accounts and review their current status.",
    "Sub-accounts": "Review linked identities from services connected to TC.",
    "Support queue": "Review identity changes, ownership checks, and security requests.",
    "Staff & access": "Review staff roles and the boundaries of their access.",
    "Service policies": "Service-specific security and sub-account requirements.",
    "Activity log": "A view of administrative events and review history.",
    "Settings": "Administration workspace preferences."
  }[page];

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <div className="brand-row">
        <div className="tc-mark">TC</div>
        <div className="brand-text"><strong>Theegget Creations</strong><span>ADMINISTRATION</span></div>
        <button className="icon-button sidebar-close" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={18} /></button>
      </div>
      <div className="workspace-switcher"><div className="workspace-avatar">T</div><div><strong>TC Workspace</strong><span>Administration</span></div><ChevronDown size={15} /></div>
      <nav className="side-nav">
        {nav.map(section => <div className="nav-section" key={section.group}>
          <span className="nav-heading">{section.group}</span>
          {section.items.map(item => <button key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => changePage(item.id)}>
            <item.icon size={17} strokeWidth={1.8} /><span>{item.label}</span>{item.count && <span className="nav-count">{item.count}</span>}
          </button>)}
        </div>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="secure-note"><div><LockKeyhole size={15} /><strong>Protected workspace</strong></div><p>Access should be limited to authorized TC staff.</p></div>
        <button className="profile-row" onClick={() => setShowProfile(!showProfile)}>
          <div className="profile-avatar">TC</div><div className="profile-info"><strong>Admin preview</strong><span>Demo session · no sign-in</span></div><MoreHorizontal size={18} />
        </button>
        {showProfile && <div className="profile-popover"><strong>Preview mode</strong><p>Authentication is not connected. This interface does not grant admin access.</p></div>}
      </div>
    </aside>

    {mobileNav && <button className="mobile-scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}

    <main className="main-area">
      <header className="topbar">
        <button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={20} /></button>
        <div className="breadcrumbs"><span>TC Admin</span><span className="crumb-slash">/</span><strong>{page}</strong></div>
        <div className="topbar-actions">
          <div className="environment-pill"><span /> Demo environment</div>
          <button className="icon-button notification-button" aria-label="Notifications" onClick={() => setNotice("Notifications are not connected in this demo.")}><Bell size={18} /><i /></button>
          <div className="topbar-divider" />
          <div className="topbar-avatar">TC</div>
        </div>
      </header>

      <div className="page-content">
        <div className="demo-banner"><div className="demo-banner-icon"><ShieldAlert size={17} /></div><div><strong>Preview only — no live account data</strong><span>Actions and records on this screen are sample data. Authentication, API connections, and audit storage still need to be implemented.</span></div><Badge tone="warning">Not connected</Badge></div>

        <section className="page-heading">
          <div><div className="eyebrow">THEEGGET CREATIONS <span>/</span> ADMIN</div><h1>{page}</h1><p>{pageDescription}</p></div>
          <div className="heading-actions">
            {page === "Support queue" && <button className="button button-primary" onClick={() => setNotice("New support request creation will be connected to the support API.")}><CircleHelp size={16} /> New request</button>}
            {page === "Accounts" && <button className="button button-secondary" onClick={() => setNotice("Account creation belongs in TC Accounts, not this support dashboard.")}><Users size={16} /> Account tools</button>}
            <button className="button button-secondary" onClick={() => setNotice("This view is using local sample data.")}><Activity size={16} /> Status: demo</button>
          </div>
        </section>

        {notice && <div className="inline-notice"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss"><X size={15} /></button></div>}

        {page === "Overview" && <Overview onNavigate={changePage} requests={requests} />}
        {page === "Accounts" && <section className="panel">
          <PanelHeader title="TC accounts" subtitle="Sample accounts for interface preview" />
          <Toolbar query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} filters={["All", "Active", "Review"]} placeholder="Search username, display name..." />
          <div className="table-wrap"><table><thead><tr><th>Account</th><th>Email</th><th>Joined</th><th>Sub-accounts</th><th>Status</th><th /></tr></thead><tbody>
            {filteredAccounts.map(a => <tr key={a.username}><td><div className="account-cell"><div className="table-avatar">{a.username.slice(0,1).toUpperCase()}</div><div><strong>@{a.username}</strong><span>{a.display}</span></div></div></td><td className="muted-cell">{a.email}</td><td>{a.joined}</td><td><span className="number-chip">{a.subs}</span></td><td><Badge tone={a.status === "Active" ? "success" : "warning"}>{a.status}</Badge></td><td><button className="row-action" onClick={() => setNotice(`Account details for @${a.username} will open here when TC Accounts is connected.`)} aria-label={`View ${a.username}`}><ArrowRight size={16} /></button></td></tr>)}
          </tbody></table>{filteredAccounts.length === 0 && <EmptyState title="No accounts found" detail="Try a different search or filter." />}</div>
          <div className="panel-footer"><span>Sample data · {filteredAccounts.length} accounts shown</span><span>Account changes are not enabled</span></div>
        </section>}

        {page === "Sub-accounts" && <section className="panel">
          <PanelHeader title="Linked service identities" subtitle="Sub-accounts associate an external service identity with a TC account. They are not separate TC logins." />
          <div className="policy-callout"><ShieldCheck size={17} /><p><strong>Creation is controlled.</strong> A user cannot create a sub-account directly. A service must be explicitly authorized to link it, or TC Support must verify external-account ownership before adding it.</p></div>
          <Toolbar query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} filters={["All", "Personal", "Shared"]} placeholder="Search owner, service, identity..." />
          <div className="table-wrap"><table><thead><tr><th>TC account</th><th>Service</th><th>External username</th><th>Type</th><th>Ownership</th><th>Admin eligibility</th></tr></thead><tbody>
            {filteredSubs.map((s, i) => <tr key={s.owner + s.identity}><td><strong>@{s.owner}</strong></td><td><span className="service-label"><Command size={14} />{s.service}</span></td><td><strong>{s.identity}</strong></td><td><Badge tone={s.kind === "Personal" ? "info" : "neutral"}>{s.kind}</Badge></td><td><Badge tone={s.verified === "Verified" ? "success" : "warning"}>{s.verified}</Badge></td><td>{s.admin === "Eligible" ? <Badge tone="success">Eligible</Badge> : s.admin === "Ineligible" ? <Badge tone="danger">Ineligible</Badge> : <span className="muted-cell">{s.admin}</span>}</td></tr>)}
          </tbody></table>{filteredSubs.length === 0 && <EmptyState title="No linked identities found" detail="Try another search or account type." />}</div>
          <div className="panel-footer"><span>Sample data · {filteredSubs.length} linked identities shown</span><span>Identity details require support verification to change</span></div>
        </section>}

        {page === "Support queue" && <section className="panel">
          <PanelHeader title="Requests requiring attention" subtitle="Review identity changes, external account verification, and security overrides." />
          <Toolbar query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} filters={["All", "Needs review", "Waiting for support", "Approved", "Declined"]} placeholder="Search request, user, or service..." />
          <div className="table-wrap"><table><thead><tr><th>Request</th><th>Requester</th><th>Service</th><th>Priority</th><th>Status</th><th>Submitted</th><th /></tr></thead><tbody>
            {filteredRequests.map(r => <tr key={r.id}><td><button className="request-title" onClick={() => setSelectedRequest(r)}><span>{r.id}</span><strong>{r.title}</strong></button></td><td>@{r.user}</td><td>{r.service}</td><td><Badge tone={r.priority === "High" ? "danger" : "neutral"}>{r.priority}</Badge></td><td><Badge tone={r.status === "Needs review" ? "warning" : r.status === "Approved" ? "success" : r.status === "Declined" ? "danger" : "neutral"}>{r.status}</Badge></td><td className="muted-cell">{r.date}</td><td><button className="row-action" onClick={() => setSelectedRequest(r)} aria-label="Review request"><ArrowRight size={16} /></button></td></tr>)}
          </tbody></table>{filteredRequests.length === 0 && <EmptyState title="No requests found" detail="There are no matching sample requests." />}</div>
          <div className="panel-footer"><span>{filteredRequests.length} sample requests</span><span>Review decisions are local to this demo</span></div>
        </section>}

        {page === "Staff & access" && <StaffPage />}
        {page === "Service policies" && <PoliciesPage />}
        {page === "Activity log" && <ActivityPage />}
        {page === "Settings" && <SettingsPage onNotice={setNotice} />}
        <footer className="page-footer"><span>TC Admin <span className="footer-dot">·</span> Theegget Creations</span><span><LockKeyhole size={12} /> Authorized staff only <span className="footer-dot">·</span> Interface preview</span></footer>
      </div>
    </main>

    {selectedRequest && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setSelectedRequest(null); }}>
      <section className="request-modal" role="dialog" aria-modal="true" aria-labelledby="request-heading">
        <div className="modal-top"><div><span className="eyebrow">{selectedRequest.id} · SUPPORT REQUEST</span><h2 id="request-heading">{selectedRequest.title}</h2></div><button className="icon-button" onClick={() => setSelectedRequest(null)} aria-label="Close"><X size={18} /></button></div>
        <div className="modal-summary"><div><span>Requester</span><strong>@{selectedRequest.user}</strong></div><div><span>Service</span><strong>{selectedRequest.service}</strong></div><div><span>Request type</span><strong>{selectedRequest.type}</strong></div><div><span>Submitted</span><strong>{selectedRequest.date}</strong></div></div>
        <div className="policy-callout"><ShieldAlert size={18} /><p><strong>Verification required.</strong> Before approving identity changes or overrides, verify ownership of the external account. Decline changes that would impersonate another person.</p></div>
        {selectedRequest.type === "Security override" && <div className="warning-box"><strong>Eggser security rule</strong><p>Override requires a submitted request. The owner can override without a request. Any approved override must record the decision and the account holder's in-game accountability acknowledgment.</p></div>}
        <div className="modal-note"><strong>Demo review controls</strong><p>These buttons update only the sample status on this screen. They do not verify ownership, contact a user, or change a real account.</p></div>
        <div className="modal-actions"><button className="button button-secondary" onClick={() => updateRequest(selectedRequest.id, "Declined")}>Decline</button><button className="button button-primary" onClick={() => updateRequest(selectedRequest.id, "Approved")}><BadgeCheck size={16} /> Mark approved</button></div>
      </section>
    </div>}
  </div>;
}

function PanelHeader({ title, subtitle }) {
  return <div className="panel-header"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" title="More options" onClick={() => {}}><MoreHorizontal size={19} /></button></div>;
}

function Toolbar({ query, setQuery, filter, setFilter, filters, placeholder }) {
  return <div className="toolbar"><label className="search-box"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={placeholder} /></label><label className="filter-select"><Filter size={15} /><select value={filter} onChange={e => setFilter(e.target.value)}>{filters.map(f => <option key={f}>{f}</option>)}</select><ChevronDown size={14} /></label></div>;
}

function Overview({ onNavigate, requests }) {
  const pending = requests.filter(r => r.status === "Needs review" || r.status === "Waiting for support");
  return <>
    <div className="stats-grid">
      <StatCard icon={Users} label="TC accounts" value="1,284" detail="Sample dashboard value" />
      <StatCard icon={Link2} label="Linked identities" value="326" detail="Across connected services" tone="purple" />
      <StatCard icon={Headset} label="Open support requests" value={pending.length.toString().padStart(2, "0")} detail="Sample queue records" tone="amber" />
      <StatCard icon={ShieldCheck} label="Service connections" value="04" detail="Integration status not verified" tone="green" />
    </div>
    <div className="overview-grid">
      <section className="panel overview-panel">
        <PanelHeader title="Support queue" subtitle="Recent requests that may need staff attention" />
        <div className="recent-list">{requests.slice(0, 4).map(r => <button className="recent-row" key={r.id} onClick={() => onNavigate("Support queue")}><div className={`recent-icon ${r.priority === "High" ? "recent-high" : ""}`}>{r.type === "Security override" ? <ShieldAlert size={17} /> : r.type === "Identity change" ? <UserRound size={17} /> : <Headset size={17} />}</div><div className="recent-main"><strong>{r.title}</strong><span>@{r.user} <span className="bullet">·</span> {r.service}</span></div><div className="recent-meta"><Badge tone={r.status === "Needs review" ? "warning" : "neutral"}>{r.status}</Badge><span>{r.date}</span></div><ArrowRight className="recent-arrow" size={16} /></button>)}</div>
        <button className="panel-link" onClick={() => onNavigate("Support queue")}>View all requests <ArrowRight size={15} /></button>
      </section>
      <section className="panel quick-panel">
        <PanelHeader title="Administration" subtitle="Common workspaces" />
        <div className="quick-links">
          <button onClick={() => onNavigate("Accounts")}><div className="quick-icon"><Users size={18} /></div><div><strong>Account directory</strong><span>Find a TC account</span></div><ArrowRight size={16} /></button>
          <button onClick={() => onNavigate("Sub-accounts")}><div className="quick-icon"><Link2 size={18} /></div><div><strong>Linked identities</strong><span>Review external accounts</span></div><ArrowRight size={16} /></button>
          <button onClick={() => onNavigate("Staff & access")}><div className="quick-icon"><Shield size={18} /></div><div><strong>Staff permissions</strong><span>Roles and access boundaries</span></div><ArrowRight size={16} /></button>
          <button onClick={() => onNavigate("Service policies")}><div className="quick-icon"><FileCheck2 size={18} /></div><div><strong>Service policies</strong><span>Security rules by service</span></div><ArrowRight size={16} /></button>
        </div>
      </section>
    </div>
    <section className="panel policy-panel">
      <PanelHeader title="Security principles" subtitle="Core rules to enforce when live services are connected" />
      <div className="principles-grid">
        <div><div className="principle-icon"><BadgeCheck size={17} /></div><strong>Verify ownership</strong><p>TC Support verifies ownership before manually linking external accounts or changing identity information.</p></div>
        <div><div className="principle-icon"><LockKeyhole size={17} /></div><strong>Limit creation</strong><p>Users can manage or unlink existing links, but cannot create arbitrary sub-accounts themselves.</p></div>
        <div><div className="principle-icon"><ShieldAlert size={17} /></div><strong>Protect Eggser</strong><p>Security-related account-type changes can remove admin permissions for 14 days under Eggser policy.</p></div>
      </div>
    </section>
  </>;
}

function StaffPage() {
  const [expanded, setExpanded] = useState("Support staff");
  const roles = [
    { name: "Owner", desc: "Full authority, including direct overrides without a submitted override request.", level: "Highest" },
    { name: "Administrator", desc: "Administrative tools limited to explicitly assigned permissions.", level: "Elevated" },
    { name: "Support staff", desc: "Review ownership evidence and requests; access limited account tools.", level: "Limited" }
  ];
  return <section className="panel"><PanelHeader title="Staff roles and access" subtitle="Separate support responsibilities from broader administrative authority." /><div className="role-list">{roles.map((r, i) => <div className="role-card" key={r.name}><button className="role-head" onClick={() => setExpanded(expanded === r.name ? "" : r.name)}><div className={`role-icon role-${i}`}>{i === 0 ? <ShieldCheck size={19} /> : i === 1 ? <UserCog size={19} /> : <Headset size={19} />}</div><div><strong>{r.name}</strong><span>{r.desc}</span></div><Badge tone={i === 0 ? "success" : "neutral"}>{r.level}</Badge><ChevronDown size={17} /></button>{expanded === r.name && <div className="role-details"><strong>Permission design</strong><p>Production permission checks must run on the server for every protected action. Hiding a button in the interface is not an access-control system.</p><div className="permission-chips"><span>Audit trail</span><span>Least privilege</span><span>Server-side checks</span></div></div>}</div>)}</div><div className="policy-callout"><LockKeyhole size={17} /><p>Staff lists and permissions are illustrative until a trusted TC identity provider and server-side authorization service are connected.</p></div></section>;
}

function PoliciesPage() {
  return <div className="policy-page-grid">
    <section className="panel"><PanelHeader title="TC sub-account rules" subtitle="Shared rules for integrated services." /><div className="policy-rule-list">
      <div><Badge tone="success">Allowed</Badge><strong>Manage an existing link</strong><p>Users can view and manage ordinary settings or unlink an existing sub-account.</p></div>
      <div><Badge tone="warning">Support only</Badge><strong>Create or change identity details</strong><p>Creation requires an explicitly authorized service or TC Support after ownership verification. Identity information changes go through support.</p></div>
      <div><Badge tone="danger">Decline</Badge><strong>Impersonation</strong><p>Support must decline a requested identity change that impersonates another person.</p></div>
    </div></section>
    <section className="panel"><PanelHeader title="Eggser security rules" subtitle="Service-specific admin eligibility controls." /><div className="policy-rule-list">
      <div><Badge tone="warning">14 days</Badge><strong>Security-related type change</strong><p>Existing administrator permissions are removed for 14 days after a qualifying support-approved change.</p></div>
      <div><Badge tone="neutral">Request required</Badge><strong>Override process</strong><p>Non-owner overrides require a submitted request and support review. The owner can override without a request.</p></div>
      <div><Badge tone="danger">Eligibility</Badge><strong>Shared account restriction</strong><p>A shared account cannot hold admin privileges unless converted to personal, or every person using it already has admin privileges.</p></div>
      <div><Badge tone="info">Accountability</Badge><strong>In-game actions</strong><p>Users are responsible for in-game actions performed through their account, including administrator actions.</p></div>
    </div></section>
  </div>;
}

function ActivityPage() {
  const events = [
    ["Policy draft opened", "TC Admin interface", "Just now", "neutral"],
    ["Support queue sample loaded", "Demo data", "Just now", "info"],
    ["No live account actions recorded", "System status", "Current session", "success"]
  ];
  return <section className="panel"><PanelHeader title="Activity log" subtitle="The production audit log must be append-only and recorded server-side." /><div className="activity-list">{events.map((e, i) => <div className="activity-row" key={e[0]}><div className="activity-mark"><Activity size={16} /></div><div><strong>{e[0]}</strong><span>{e[1]}</span></div><span className="activity-time">{e[2]}</span><Badge tone={e[3]}>{i === 2 ? "Informational" : "Demo"}</Badge></div>)}</div><div className="policy-callout"><Shield size={17} /><p>These are local preview entries, not a durable security audit trail. Real actions should record actor, target, timestamp, reason, outcome, and request ID.</p></div></section>;
}

function SettingsPage({ onNotice }) {
  return <section className="panel"><PanelHeader title="Workspace settings" subtitle="Preview settings and future integration points." /><div className="settings-list">
    <div><div className="setting-icon"><LockKeyhole size={18} /></div><div><strong>Authentication</strong><span>TC sign-in and staff session validation</span></div><Badge tone="warning">Not connected</Badge><button className="button button-secondary" onClick={() => onNotice("Connect TC authentication before enabling the production dashboard.")}>View setup</button></div>
    <div><div className="setting-icon"><Link2 size={18} /></div><div><strong>Service integrations</strong><span>Approved services, signed requests, and link verification</span></div><Badge tone="warning">Not connected</Badge><button className="button button-secondary" onClick={() => onNotice("Service API registry will be implemented with the backend.")}>View setup</button></div>
    <div><div className="setting-icon"><FileCheck2 size={18} /></div><div><strong>Audit storage</strong><span>Durable log for sensitive administrative changes</span></div><Badge tone="warning">Not connected</Badge><button className="button button-secondary" onClick={() => onNotice("Audit storage is not configured in this frontend-only preview.")}>View setup</button></div>
  </div></section>;
}
