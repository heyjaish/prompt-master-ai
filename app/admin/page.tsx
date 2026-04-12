"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Users, ToggleRight, Sliders, Settings,
  ArrowLeft, Shield, Search, RefreshCw, Save, Ban, UserCheck,
  UserX, Crown, Zap, TrendingUp, AlertTriangle, CheckCircle,
  XCircle, ChevronDown, MoreHorizontal, Bell, Activity,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  AdminConfig, UserRecord, DEFAULT_CONFIG,
  getAdminConfig, saveAdminConfig, getAllUsers, updateUserRecord,
} from "@/lib/admin";

// ── Admin email list (comma-separated in env var) ──────────────
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);

type Tab = "overview" | "users" | "features" | "limits" | "settings";

// ── Helpers ─────────────────────────────────────────────────────
const PlanBadge = ({ plan }: { plan: string }) => {
  const styles: Record<string, { bg: string; color: string }> = {
    free:      { bg: "rgba(100,116,139,.18)", color: "#94a3b8" },
    pro:       { bg: "rgba(99,102,241,.18)",  color: "#818cf8" },
    unlimited: { bg: "rgba(34,197,94,.15)",   color: "#4ade80" },
  };
  const s = styles[plan] ?? styles.free;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 6, background: s.bg, color: s.color }}>
      {plan}
    </span>
  );
};

const StatusDot = ({ status }: { status: string }) => {
  const color = status === "active" ? "#22c55e" : status === "suspended" ? "#f59e0b" : "#ef4444";
  return <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: color, marginRight: 5 }} />;
};

const StatCard = ({ icon, label, value, sub, color = "var(--accent-fg)" }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string;
}) => (
  <div style={{
    background: "rgba(17,17,22,0.8)", border: "1px solid var(--border-lg)",
    borderRadius: "var(--r3)", padding: "18px 20px",
    backdropFilter: "blur(12px)",
  }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--tx-3)", textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</span>
      <div style={{ color, opacity: .8 }}>{icon}</div>
    </div>
    <div style={{ fontSize: 28, fontWeight: 800, color: "var(--tx-1)", letterSpacing: "-.02em", lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11.5, color: "var(--tx-3)", marginTop: 5 }}>{sub}</div>}
  </div>
);

const Toggle = ({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) => (
  <div style={{
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 16px", borderRadius: "var(--r2)",
    background: "rgba(17,17,22,0.6)", border: "1px solid var(--border)",
  }}>
    <div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--tx-1)", marginBottom: 2 }}>{label}</div>
      {desc && <div style={{ fontSize: 12, color: "var(--tx-3)" }}>{desc}</div>}
    </div>
    <button onClick={() => onChange(!checked)} style={{
      width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
      background: checked ? "var(--accent)" : "var(--bg-hover)",
      position: "relative", transition: "background .2s", flexShrink: 0,
    }}>
      <span style={{
        position: "absolute", top: 3, left: checked ? 23 : 3,
        width: 18, height: 18, borderRadius: "50%", background: "#fff",
        transition: "left .2s", display: "block",
        boxShadow: "0 1px 4px rgba(0,0,0,.4)",
      }} />
    </button>
  </div>
);

// ── Main Admin Page ─────────────────────────────────────────────
export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [config, setConfig] = useState<AdminConfig>(DEFAULT_CONFIG);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [actionUid, setActionUid] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const isAdmin = useMemo(() =>
    user ? ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? "") : false,
  [user]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const loadData = useCallback(async () => {
    setDataLoading(true);
    const [cfg, allUsers] = await Promise.all([getAdminConfig(), getAllUsers()]);
    setConfig(cfg); setUsers(allUsers);
    setDataLoading(false);
  }, []);

  useEffect(() => {
    if (!loading && !user) { router.replace("/login"); return; }
    if (!loading && user && !isAdmin) return; // show denied UI
    if (!loading && user && isAdmin) loadData();
  }, [user, loading, isAdmin, router, loadData]);

  const handleSaveConfig = async () => {
    setSaving(true);
    await saveAdminConfig(config);
    setSaving(false); setSaved(true);
    showToast("✅ Configuration saved!");
    setTimeout(() => setSaved(false), 2000);
  };

  const handleUserAction = async (uid: string, changes: Partial<UserRecord>) => {
    setActionUid(uid);
    await updateUserRecord(uid, changes);
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, ...changes } : u));
    setActionUid(null);
    showToast("✅ User updated!");
  };

  // ── Auth guards ────────────────────────────────────────────────
  if (loading) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div className="shimmer" style={{ width: 48, height: 48, borderRadius: 12 }} />
    </div>
  );

  if (!user) return null;

  if (!isAdmin) return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--bg)", gap: 16 }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Shield size={22} color="#f87171" />
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--tx-1)", marginBottom: 6 }}>Access Denied</div>
        <div style={{ fontSize: 13.5, color: "var(--tx-3)" }}>You don&apos;t have admin privileges.</div>
      </div>
      <Link href="/" style={{ padding: "8px 20px", borderRadius: "var(--r2)", background: "var(--accent)", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
        Go Back to App
      </Link>
    </div>
  );

  // ── Filtered users ─────────────────────────────────────────────
  const filteredUsers = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    const matchPlan = filterPlan === "all" || u.plan === filterPlan;
    const matchStatus = filterStatus === "all" || u.status === filterStatus;
    return matchSearch && matchPlan && matchStatus;
  });

  // ── Stats ──────────────────────────────────────────────────────
  const totalUsers    = users.length;
  const activeUsers   = users.filter(u => u.status === "active").length;
  const totalPrompts  = users.reduce((s, u) => s + (u.totalPrompts ?? 0), 0);
  const today         = new Date().toISOString().slice(0, 10);
  const todayPrompts  = users.filter(u => u.dailyDate === today).reduce((s, u) => s + (u.dailyPrompts ?? 0), 0);
  const proUsers      = users.filter(u => u.plan === "pro").length;
  const bannedUsers   = users.filter(u => u.status === "banned").length;

  const NAV_ITEMS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview",  label: "Overview",    icon: <LayoutDashboard size={15} /> },
    { id: "users",     label: "Users",       icon: <Users size={15} /> },
    { id: "features",  label: "Features",    icon: <ToggleRight size={15} /> },
    { id: "limits",    label: "Limits",      icon: <Sliders size={15} /> },
    { id: "settings",  label: "Settings",    icon: <Settings size={15} /> },
  ];

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg)", fontFamily: "Inter, sans-serif" }}>

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside style={{
        width: 200, flexShrink: 0, display: "flex", flexDirection: "column",
        background: "rgba(13,13,17,0.95)", borderRight: "1px solid var(--border)",
        padding: "16px 0",
      }}>
        {/* Logo */}
        <div style={{ padding: "0 14px 16px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(239,68,68,.15)", border: "1px solid rgba(239,68,68,.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Shield size={13} color="#f87171" />
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--tx-1)", lineHeight: 1.2 }}>Admin</div>
              <div style={{ fontSize: 10.5, color: "var(--tx-3)", lineHeight: 1.2 }}>Control Panel</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => setTab(item.id)} style={{
              display: "flex", alignItems: "center", gap: 9,
              padding: "8px 10px", borderRadius: "var(--r1)", border: "none",
              background: tab === item.id ? "rgba(99,102,241,.15)" : "transparent",
              color: tab === item.id ? "#818cf8" : "var(--tx-2)",
              fontSize: 13, fontWeight: tab === item.id ? 600 : 400,
              cursor: "pointer", transition: "all .15s", textAlign: "left", width: "100%",
              borderLeft: tab === item.id ? "2px solid #6366f1" : "2px solid transparent",
            }}>
              {item.icon} {item.label}
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div style={{ padding: "12px 8px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 6 }}>
          <button onClick={loadData} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
            borderRadius: "var(--r1)", border: "none", background: "transparent",
            color: "var(--tx-3)", fontSize: 12, cursor: "pointer", width: "100%",
          }}>
            <RefreshCw size={12} /> Refresh data
          </button>
          <Link href="/" style={{
            display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
            borderRadius: "var(--r1)", color: "var(--tx-3)", fontSize: 12,
            textDecoration: "none",
          }}>
            <ArrowLeft size={12} /> Back to App
          </Link>
          <div style={{ padding: "8px 10px", fontSize: 11, color: "var(--tx-3)" }}>
            {user.email?.split("@")[0]}
          </div>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────── */}
      <main style={{ flex: 1, overflow-y: "auto", display: "flex", flexDirection: "column" }}>

        {/* Header bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 24px", borderBottom: "1px solid var(--border)",
          background: "rgba(11,11,14,0.8)", backdropFilter: "blur(12px)", flexShrink: 0,
        }}>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: "var(--tx-1)", letterSpacing: "-.01em", marginBottom: 2 }}>
              {NAV_ITEMS.find(n => n.id === tab)?.label}
            </h1>
            <p style={{ fontSize: 12, color: "var(--tx-3)" }}>
              {tab === "overview" && `${totalUsers} users · ${totalPrompts} total prompts`}
              {tab === "users" && `${filteredUsers.length} of ${totalUsers} users shown`}
              {tab === "features" && "Toggle app features on/off globally"}
              {tab === "limits" && "Set daily prompt limits per plan"}
              {tab === "settings" && "App-wide settings and maintenance"}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {(tab === "features" || tab === "limits" || tab === "settings") && (
              <button onClick={handleSaveConfig} disabled={saving} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "7px 16px",
                borderRadius: "var(--r2)", background: saved ? "#22c55e" : "var(--accent)",
                color: "#fff", border: "none", fontSize: 13, fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer", transition: "background .2s",
              }}>
                <Save size={13} />{saving ? "Saving…" : saved ? "Saved!" : "Save Changes"}
              </button>
            )}
            <div style={{ fontSize: 11, color: "var(--tx-3)", background: "var(--bg-card)", padding: "5px 10px", borderRadius: "var(--rf)", border: "1px solid var(--border)" }}>
              {dataLoading ? "Loading…" : "Live data"}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>

          {/* ══ OVERVIEW ═══════════════════════════════════════ */}
          {tab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Stat cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <StatCard icon={<Users size={16} />}    label="Total Users"    value={totalUsers}   sub={`${activeUsers} active`} />
                <StatCard icon={<Activity size={16} />} label="Total Prompts"  value={totalPrompts} sub="all time" color="#22c55e" />
                <StatCard icon={<TrendingUp size={16} />} label="Today's Prompts" value={todayPrompts} sub="generated today" color="#f59e0b" />
                <StatCard icon={<Crown size={16} />}    label="Pro Users"      value={proUsers}     sub={`${bannedUsers} banned`} color="#818cf8" />
              </div>

              {/* Plan breakdown */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{
                  background: "rgba(17,17,22,0.8)", border: "1px solid var(--border-lg)",
                  borderRadius: "var(--r3)", padding: "18px 20px",
                }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--tx-2)", marginBottom: 14, textTransform: "uppercase", letterSpacing: ".06em" }}>Plan Distribution</h3>
                  {["free", "pro", "unlimited"].map(plan => {
                    const count = users.filter(u => u.plan === plan).length;
                    const pct   = totalUsers ? Math.round((count / totalUsers) * 100) : 0;
                    return (
                      <div key={plan} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 12, color: "var(--tx-2)", textTransform: "capitalize" }}>{plan}</span>
                          <span style={{ fontSize: 12, color: "var(--tx-3)" }}>{count} ({pct}%)</span>
                        </div>
                        <div style={{ height: 5, borderRadius: 3, background: "var(--border)" }}>
                          <div style={{ height: "100%", borderRadius: 3, background: plan === "unlimited" ? "#22c55e" : plan === "pro" ? "#6366f1" : "#475569", width: `${pct}%`, transition: "width .5s" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Feature status */}
                <div style={{
                  background: "rgba(17,17,22,0.8)", border: "1px solid var(--border-lg)",
                  borderRadius: "var(--r3)", padding: "18px 20px",
                }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--tx-2)", marginBottom: 14, textTransform: "uppercase", letterSpacing: ".06em" }}>Feature Status</h3>
                  {Object.entries(config.features).map(([key, val]) => (
                    <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 12.5, color: "var(--tx-2)", textTransform: "capitalize" }}>
                        {key.replace(/([A-Z])/g, " $1")}
                      </span>
                      {val ? <CheckCircle size={14} color="#22c55e" /> : <XCircle size={14} color="#ef4444" />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent users */}
              <div style={{ background: "rgba(17,17,22,0.8)", border: "1px solid var(--border-lg)", borderRadius: "var(--r3)", overflow: "hidden" }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--tx-2)", textTransform: "uppercase", letterSpacing: ".06em" }}>Recent Users</h3>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "rgba(0,0,0,.2)" }}>
                        {["User", "Plan", "Status", "Prompts", "Last Active"].map(h => (
                          <th key={h} style={{ padding: "9px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--tx-3)", textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {users.slice(0, 8).map(u => (
                        <tr key={u.uid} style={{ borderTop: "1px solid var(--border)" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.02)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={{ padding: "10px 16px" }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--tx-1)" }}>{u.name || "—"}</div>
                            <div style={{ fontSize: 11.5, color: "var(--tx-3)" }}>{u.email}</div>
                          </td>
                          <td style={{ padding: "10px 16px" }}><PlanBadge plan={u.plan ?? "free"} /></td>
                          <td style={{ padding: "10px 16px" }}>
                            <span style={{ fontSize: 12.5, color: "var(--tx-2)" }}><StatusDot status={u.status ?? "active"} />{u.status ?? "active"}</span>
                          </td>
                          <td style={{ padding: "10px 16px", fontSize: 13, color: "var(--tx-2)" }}>{u.totalPrompts ?? 0}</td>
                          <td style={{ padding: "10px 16px", fontSize: 12, color: "var(--tx-3)" }}>
                            {u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleDateString() : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ USERS ══════════════════════════════════════════ */}
          {tab === "users" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Filters */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 220, position: "relative" }}>
                  <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--tx-3)" }} />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…"
                    style={{ width: "100%", background: "var(--bg-card)", border: "1px solid var(--border-md)", borderRadius: "var(--r2)", color: "var(--tx-1)", fontSize: 13, padding: "8px 12px 8px 32px", outline: "none" }} />
                </div>
                <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)} style={{ background: "var(--bg-card)", border: "1px solid var(--border-md)", borderRadius: "var(--r2)", color: "var(--tx-2)", fontSize: 13, padding: "8px 12px", outline: "none", cursor: "pointer" }}>
                  <option value="all">All Plans</option>
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="unlimited">Unlimited</option>
                </select>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ background: "var(--bg-card)", border: "1px solid var(--border-md)", borderRadius: "var(--r2)", color: "var(--tx-2)", fontSize: 13, padding: "8px 12px", outline: "none", cursor: "pointer" }}>
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="banned">Banned</option>
                </select>
              </div>

              {/* User table */}
              <div style={{ background: "rgba(17,17,22,0.8)", border: "1px solid var(--border-lg)", borderRadius: "var(--r3)", overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "rgba(0,0,0,.25)" }}>
                        {["User", "Provider", "Plan", "Status", "Daily", "Total", "Joined", "Actions"].map(h => (
                          <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--tx-3)", textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(u => (
                        <tr key={u.uid} style={{ borderTop: "1px solid var(--border)" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.02)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={{ padding: "10px 14px", minWidth: 200 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                              {u.photoURL
                                ? <img src={u.photoURL} alt="" style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, border: "1px solid var(--border)" }} />
                                : <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "var(--accent-fg)", flexShrink: 0 }}>{u.name?.[0]?.toUpperCase() ?? "?"}</div>
                              }
                              <div>
                                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--tx-1)", display:"flex",alignItems:"center",gap:4 }}>
                                  {u.name || "Unknown"}
                                  {u.role === "admin" && <Crown size={10} color="#f59e0b" />}
                                </div>
                                <div style={{ fontSize: 11, color: "var(--tx-3)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: "var(--bg-hover)", color: "var(--tx-3)", textTransform: "capitalize" }}>{u.provider ?? "google"}</span>
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <select defaultValue={u.plan ?? "free"}
                              onChange={e => handleUserAction(u.uid, { plan: e.target.value as UserRecord["plan"] })}
                              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--tx-2)", fontSize: 12, padding: "3px 6px", cursor: "pointer", outline: "none" }}>
                              <option value="free">Free</option>
                              <option value="pro">Pro</option>
                              <option value="unlimited">Unlimited</option>
                            </select>
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <select defaultValue={u.status ?? "active"}
                              onChange={e => handleUserAction(u.uid, { status: e.target.value as UserRecord["status"] })}
                              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--tx-2)", fontSize: 12, padding: "3px 6px", cursor: "pointer", outline: "none" }}>
                              <option value="active">Active</option>
                              <option value="suspended">Suspended</option>
                              <option value="banned">Banned</option>
                            </select>
                          </td>
                          <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--tx-2)", textAlign: "center" }}>{u.dailyPrompts ?? 0}</td>
                          <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--tx-2)", textAlign: "center" }}>{u.totalPrompts ?? 0}</td>
                          <td style={{ padding: "10px 14px", fontSize: 11.5, color: "var(--tx-3)", whiteSpace: "nowrap" }}>
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <div style={{ display: "flex", gap: 5 }}>
                              <button title="Promote/Demote Admin"
                                onClick={() => handleUserAction(u.uid, { role: u.role === "admin" ? "user" : "admin" })}
                                style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: u.role === "admin" ? "#f59e0b" : "var(--tx-3)", cursor: "pointer", fontSize: 11 }}>
                                <Crown size={11} />
                              </button>
                              <button title={u.status === "banned" ? "Unban" : "Ban"}
                                onClick={() => handleUserAction(u.uid, { status: u.status === "banned" ? "active" : "banned" })}
                                style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: u.status === "banned" ? "#22c55e" : "#ef4444", cursor: "pointer", fontSize: 11 }}>
                                {u.status === "banned" ? <UserCheck size={11} /> : <Ban size={11} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && (
                        <tr><td colSpan={8} style={{ padding: "32px", textAlign: "center", color: "var(--tx-3)", fontSize: 13 }}>No users found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ FEATURES ═══════════════════════════════════════ */}
          {tab === "features" && (
            <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 13, color: "var(--tx-3)", marginBottom: 6, padding: "10px 14px", background: "rgba(99,102,241,.08)", border: "1px solid rgba(99,102,241,.2)", borderRadius: "var(--r2)" }}>
                💡 Disabling a feature hides it from all users instantly. No redeploy needed.
              </div>
              {([
                { key: "splitView",    label: "Split View",     desc: "Side-by-side original ↔ engineered prompt comparison" },
                { key: "imageUpload",  label: "Image Upload",   desc: "Allow users to attach images to their prompts" },
                { key: "history",      label: "Prompt History", desc: "Save and display previous prompts in the sidebar" },
                { key: "quickActions", label: "Quick Actions",  desc: "Action chips (16:9, 4K, Cinematic, etc.) above the input" },
                { key: "templates",    label: "Templates",      desc: "One-click starter templates on the home screen" },
                { key: "skillsarkSSO", label: "Skillsark SSO",  desc: "Continue with Skillsark button on the login page" },
              ] as const).map(f => (
                <Toggle
                  key={f.key}
                  checked={config.features[f.key]}
                  onChange={v => setConfig(c => ({ ...c, features: { ...c.features, [f.key]: v } }))}
                  label={f.label} desc={f.desc}
                />
              ))}
            </div>
          )}

          {/* ══ LIMITS ═════════════════════════════════════════ */}
          {tab === "limits" && (
            <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 13, color: "var(--tx-3)", padding: "10px 14px", background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.2)", borderRadius: "var(--r2)" }}>
                ⚠️ Setting a limit to <strong>-1</strong> means unlimited. Limits reset daily at midnight.
              </div>
              {([
                { key: "free",      label: "Free Plan",      desc: "Default for all new users", color: "#64748b" },
                { key: "pro",       label: "Pro Plan",        desc: "Upgraded users", color: "#6366f1" },
                { key: "unlimited", label: "Unlimited Plan",  desc: "VIP/Staff accounts (-1 = no limit)", color: "#22c55e" },
              ] as const).map(p => (
                <div key={p.key} style={{
                  background: "rgba(17,17,22,0.8)", border: "1px solid var(--border-lg)",
                  borderRadius: "var(--r3)", padding: "18px 20px",
                  borderLeft: `3px solid ${p.color}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--tx-1)", marginBottom: 3 }}>{p.label}</div>
                      <div style={{ fontSize: 12, color: "var(--tx-3)" }}>{p.desc}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="number"
                        value={config.limits[p.key]}
                        onChange={e => setConfig(c => ({ ...c, limits: { ...c.limits, [p.key]: parseInt(e.target.value) || 0 } }))}
                        style={{
                          width: 90, background: "var(--bg-card)", border: "1px solid var(--border-md)",
                          borderRadius: "var(--r2)", color: "var(--tx-1)", fontSize: 16, fontWeight: 700,
                          padding: "7px 12px", outline: "none", textAlign: "center",
                        }}
                      />
                      <span style={{ fontSize: 12, color: "var(--tx-3)", whiteSpace: "nowrap" }}>prompts/day</span>
                    </div>
                  </div>
                  {config.limits[p.key] === -1 && (
                    <div style={{ marginTop: 8, fontSize: 11.5, color: "#4ade80" }}>✓ Unlimited prompts</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ══ SETTINGS ═══════════════════════════════════════ */}
          {tab === "settings" && (
            <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Maintenance mode */}
              <div style={{
                background: "rgba(17,17,22,0.8)", border: "1px solid var(--border-lg)",
                borderRadius: "var(--r3)", padding: "20px",
                borderLeft: config.maintenance.enabled ? "3px solid #ef4444" : "3px solid var(--border)",
              }}>
                <Toggle
                  checked={config.maintenance.enabled}
                  onChange={v => setConfig(c => ({ ...c, maintenance: { ...c.maintenance, enabled: v } }))}
                  label="🔧 Maintenance Mode"
                  desc="Blocks all new logins and shows a custom message"
                />
                {config.maintenance.enabled && (
                  <div style={{ marginTop: 14 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--tx-2)", display: "block", marginBottom: 6 }}>Maintenance Message</label>
                    <textarea
                      value={config.maintenance.message}
                      onChange={e => setConfig(c => ({ ...c, maintenance: { ...c.maintenance, message: e.target.value } }))}
                      rows={3}
                      style={{
                        width: "100%", background: "var(--bg-card)", border: "1px solid var(--border-md)",
                        borderRadius: "var(--r2)", color: "var(--tx-1)", fontSize: 13,
                        padding: "10px 12px", outline: "none", resize: "vertical",
                      }}
                    />
                    <div style={{ marginTop: 8, padding: "10px 12px", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", borderRadius: "var(--r2)", fontSize: 12.5, color: "#fca5a5" }}>
                      ⚠️ Maintenance Mode is ON — new users cannot log in.
                    </div>
                  </div>
                )}
              </div>

              {/* Admin info */}
              <div style={{ background: "rgba(17,17,22,0.8)", border: "1px solid var(--border-lg)", borderRadius: "var(--r3)", padding: "18px 20px" }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--tx-2)", marginBottom: 12, textTransform: "uppercase", letterSpacing: ".06em" }}>Admin Access</h3>
                <div style={{ fontSize: 13, color: "var(--tx-3)", marginBottom: 8 }}>
                  Admin emails are configured via the <code style={{ background: "var(--bg-hover)", padding: "1px 6px", borderRadius: 4, fontSize: 12 }}>NEXT_PUBLIC_ADMIN_EMAILS</code> environment variable.
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ADMIN_EMAILS.length > 0 ? ADMIN_EMAILS.map(e => (
                    <span key={e} style={{ fontSize: 12, padding: "3px 10px", borderRadius: "var(--rf)", background: "rgba(99,102,241,.12)", border: "1px solid rgba(99,102,241,.2)", color: "#818cf8" }}>{e}</span>
                  )) : (
                    <span style={{ fontSize: 12.5, color: "#f87171" }}>⚠️ No admin emails set — add NEXT_PUBLIC_ADMIN_EMAILS to your env vars</span>
                  )}
                </div>
              </div>

              {/* App info */}
              <div style={{ background: "rgba(17,17,22,0.8)", border: "1px solid var(--border-lg)", borderRadius: "var(--r3)", padding: "18px 20px" }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--tx-2)", marginBottom: 12, textTransform: "uppercase", letterSpacing: ".06em" }}>App Info</h3>
                {[
                  ["App",       "Prompt Master AI"],
                  ["Firebase",  "ai-prmpt-master"],
                  ["Total Users", totalUsers.toString()],
                  ["Total Prompts", totalPrompts.toString()],
                  ["Config Updated", config.updatedAt ? new Date(config.updatedAt).toLocaleString() : "Never"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 13, color: "var(--tx-3)" }}>{k}</span>
                    <span style={{ fontSize: 13, color: "var(--tx-1)", fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 999,
          padding: "10px 18px", borderRadius: "var(--r2)",
          background: "rgba(23,23,29,0.95)", border: "1px solid var(--border-lg)",
          fontSize: 13, color: "var(--tx-1)", fontWeight: 500,
          boxShadow: "0 8px 32px rgba(0,0,0,.5)", backdropFilter: "blur(12px)",
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
