"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Users, ToggleRight, Sliders, Settings,
  ArrowLeft, Shield, Search, RefreshCw, Save, Ban, UserCheck,
  Crown, TrendingUp, CheckCircle, XCircle, Activity, AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

// ── Hardcoded admin credentials ────────────────────────────────
const ADMIN_EMAIL    = "jaishkumar55@gmail.com";
const ADMIN_PASSWORD = "PromptMaster@2025";
const ADMIN_KEY      = process.env.NEXT_PUBLIC_ADMIN_SECRET_KEY ?? "admin-secret-2025";

type Tab = "overview" | "users" | "features" | "limits" | "settings";

interface UserRecord {
  uid: string; email: string; name: string; photoURL?: string;
  provider?: string; role?: string; status?: string; plan?: string;
  totalPrompts?: number; dailyPrompts?: number; dailyDate?: string;
  createdAt?: number; lastActiveAt?: number;
}

interface AdminConfig {
  features: { splitView: boolean; imageUpload: boolean; history: boolean; quickActions: boolean; templates: boolean; skillsarkSSO: boolean; };
  limits:   { free: number; pro: number; unlimited: number; };
  maintenance: { enabled: boolean; message: string; };
}

const DEFAULT_CONFIG: AdminConfig = {
  features: { splitView:true, imageUpload:true, history:true, quickActions:true, templates:true, skillsarkSSO:true },
  limits: { free:10, pro:100, unlimited:-1 },
  maintenance: { enabled:false, message:"We'll be back soon!" },
};

// ── API wrapper ────────────────────────────────────────────────
async function adminGet(action: string) {
  const res = await fetch(`/api/admin?action=${action}`, {
    headers: { "x-admin-key": ADMIN_KEY },
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? `HTTP ${res.status}`); }
  return res.json();
}

async function adminPost(body: Record<string, unknown>) {
  const res = await fetch("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? `HTTP ${res.status}`); }
  return res.json();
}

// ── Small helpers ──────────────────────────────────────────────
const PlanBadge = ({ plan }: { plan: string }) => {
  const c = plan === "unlimited" ? "#4ade80" : plan === "pro" ? "#818cf8" : "#94a3b8";
  const bg = plan === "unlimited" ? "rgba(34,197,94,.15)" : plan === "pro" ? "rgba(99,102,241,.18)" : "rgba(100,116,139,.18)";
  return <span style={{ fontSize:11, fontWeight:700, letterSpacing:".05em", textTransform:"uppercase", padding:"2px 8px", borderRadius:6, background:bg, color:c }}>{plan}</span>;
};
const Dot = ({ status }: { status: string }) => {
  const c = status==="active"?"#22c55e":status==="suspended"?"#f59e0b":"#ef4444";
  return <span style={{ display:"inline-block", width:7, height:7, borderRadius:"50%", background:c, marginRight:5 }}/>;
};
const StatCard = ({ label, value, sub, color="#94a3b8", icon }: { label:string; value:string|number; sub?:string; color?:string; icon:React.ReactNode }) => (
  <div style={{ background:"rgba(17,17,22,.8)", border:"1px solid rgba(255,255,255,.08)", borderRadius:14, padding:"18px 20px" }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
      <span style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", color:"var(--tx-3)" }}>{label}</span>
      <span style={{ color, opacity:.75 }}>{icon}</span>
    </div>
    <div style={{ fontSize:28, fontWeight:800, letterSpacing:"-.02em", color:"var(--tx-1)", lineHeight:1 }}>{value}</div>
    {sub && <div style={{ fontSize:11.5, color:"var(--tx-3)", marginTop:5 }}>{sub}</div>}
  </div>
);
const Toggle = ({ checked, onChange, label, desc }: { checked:boolean; onChange:(v:boolean)=>void; label:string; desc?:string }) => (
  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", borderRadius:10, background:"rgba(17,17,22,.6)", border:"1px solid rgba(255,255,255,.07)" }}>
    <div>
      <div style={{ fontSize:13.5, fontWeight:600, color:"var(--tx-1)", marginBottom:2 }}>{label}</div>
      {desc && <div style={{ fontSize:12, color:"var(--tx-3)" }}>{desc}</div>}
    </div>
    <button onClick={() => onChange(!checked)} style={{ width:44, height:24, borderRadius:12, border:"none", cursor:"pointer", background:checked?"#6366f1":"rgba(255,255,255,.1)", position:"relative", transition:"background .2s", flexShrink:0 }}>
      <span style={{ position:"absolute", top:3, left:checked?23:3, width:18, height:18, borderRadius:"50%", background:"#fff", transition:"left .2s", display:"block", boxShadow:"0 1px 4px rgba(0,0,0,.4)" }}/>
    </button>
  </div>
);

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab]             = useState<Tab>("overview");
  const [passwordOk, setPwOk]     = useState(false);
  const [pwInput, setPwInput]     = useState("");
  const [pwError, setPwError]     = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [users, setUsers]         = useState<UserRecord[]>([]);
  const [config, setConfig]       = useState<AdminConfig>(DEFAULT_CONFIG);
  const [dataLoading, setDL]      = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string|null>(null);
  const [toast, setToast]         = useState("");
  const [search, setSearch]       = useState("");
  const [filterPlan, setFP]       = useState("all");
  const [filterStatus, setFS]     = useState("all");

  const isAdmin = useMemo(() =>
    user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase(), [user]);

  const showToast = (m: string) => { setToast(m); setTimeout(()=>setToast(""), 3200); };

  const loadData = useCallback(async () => {
    setDL(true); setError(null);
    try {
      const [ud, cd] = await Promise.all([adminGet("users"), adminGet("config")]);
      setUsers(ud.users ?? []);
      if (cd.config) setConfig({ ...DEFAULT_CONFIG, ...cd.config });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setDL(false); }
  }, []);

  useEffect(() => {
    if (!loading && !user) { router.replace("/login"); return; }
    if (!loading && user && isAdmin && passwordOk) loadData();
  }, [user, loading, isAdmin, passwordOk, loadData, router]);

  // ── Guards ────────────────────────────────────────────────────
  if (loading) return <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg)" }}><div style={{ width:36, height:36, borderRadius:"50%", border:"3px solid var(--accent)", borderTopColor:"transparent", animation:"spin 1s linear infinite" }}/></div>;
  if (!user) return null;

  if (!isAdmin) return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"var(--bg)", gap:16 }}>
      <div style={{ width:52, height:52, borderRadius:14, background:"rgba(239,68,68,.12)", border:"1px solid rgba(239,68,68,.3)", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <Shield size={22} color="#f87171"/>
      </div>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:18, fontWeight:700, color:"var(--tx-1)", marginBottom:6 }}>Access Denied</div>
        <div style={{ fontSize:13, color:"var(--tx-3)" }}>You must be signed in as <strong>{ADMIN_EMAIL}</strong></div>
      </div>
      <Link href="/" style={{ padding:"8px 20px", borderRadius:10, background:"var(--accent)", color:"#fff", textDecoration:"none", fontSize:13, fontWeight:600 }}>← Go Back</Link>
    </div>
  );

  // ── Password gate ─────────────────────────────────────────────
  if (!passwordOk) return (
    <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg)", backgroundImage:"radial-gradient(ellipse at 30% 60%, rgba(239,68,68,.07) 0%,transparent 55%)" }}>
      <div style={{ width:"100%", maxWidth:360, background:"rgba(23,23,29,.92)", backdropFilter:"blur(24px)", border:"1px solid rgba(255,255,255,.1)", borderRadius:20, padding:"32px 28px", boxShadow:"0 24px 64px rgba(0,0,0,.6)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:22 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:"rgba(239,68,68,.12)", border:"1px solid rgba(239,68,68,.28)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Shield size={16} color="#f87171"/>
          </div>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:"var(--tx-1)" }}>Admin Panel</div>
            <div style={{ fontSize:11.5, color:"var(--tx-3)" }}>Enter admin password to continue</div>
          </div>
        </div>
        <div style={{ fontSize:12, color:"var(--tx-3)", background:"var(--bg-card)", border:"1px solid rgba(255,255,255,.07)", borderRadius:8, padding:"6px 10px", marginBottom:16, display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ width:6, height:6, borderRadius:"50%", background:"#22c55e", display:"inline-block" }}/>
          {user.email}
        </div>
        <form onSubmit={e => {
          e.preventDefault();
          if (pwInput === ADMIN_PASSWORD) { setPwError(""); setPwOk(true); }
          else { setPwError("❌ Wrong password!"); setPwInput(""); }
        }} style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ position:"relative" }}>
            <input autoFocus type={showPw?"text":"password"} value={pwInput}
              onChange={e => { setPwInput(e.target.value); setPwError(""); }}
              placeholder="Admin password"
              style={{ width:"100%", background:"rgba(255,255,255,.05)", border:`1px solid ${pwError?"rgba(239,68,68,.5)":"rgba(255,255,255,.1)"}`, borderRadius:10, color:"var(--tx-1)", fontSize:14, padding:"11px 44px 11px 14px", outline:"none", letterSpacing:showPw?"normal":".12em" }}
            />
            <button type="button" onClick={() => setShowPw(s=>!s)} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"var(--tx-3)", fontSize:12, cursor:"pointer" }}>{showPw?"Hide":"Show"}</button>
          </div>
          {pwError && <div style={{ fontSize:12.5, color:"#f87171" }}>{pwError}</div>}
          <button type="submit" style={{ padding:11, borderRadius:10, background:"linear-gradient(135deg,#ef4444,#dc2626)", color:"#fff", border:"none", fontSize:14, fontWeight:700, cursor:"pointer" }}>Unlock Admin Panel</button>
          <Link href="/" style={{ textAlign:"center", fontSize:12.5, color:"var(--tx-3)", textDecoration:"none" }}>← Back to App</Link>
        </form>
      </div>
    </div>
  );

  // ── Filtered users ─────────────────────────────────────────────
  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return (!q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
      && (filterPlan==="all" || u.plan===filterPlan)
      && (filterStatus==="all" || u.status===filterStatus);
  });

  // ── Stats ──────────────────────────────────────────────────────
  const today      = new Date().toISOString().slice(0,10);
  const totalUsers = users.length;
  const totalP     = users.reduce((s,u)=>s+(u.totalPrompts??0),0);
  const todayP     = users.filter(u=>u.dailyDate===today).reduce((s,u)=>s+(u.dailyPrompts??0),0);
  const proCount   = users.filter(u=>u.plan==="pro").length;
  const banned     = users.filter(u=>u.status==="banned").length;

  const NAV: { id:Tab; label:string; icon:React.ReactNode }[] = [
    { id:"overview",  label:"Overview",  icon:<LayoutDashboard size={14}/> },
    { id:"users",     label:"Users",     icon:<Users size={14}/> },
    { id:"features",  label:"Features",  icon:<ToggleRight size={14}/> },
    { id:"limits",    label:"Limits",    icon:<Sliders size={14}/> },
    { id:"settings",  label:"Settings",  icon:<Settings size={14}/> },
  ];

  const handleUpdateUser = async (uid: string, data: Partial<UserRecord>) => {
    try {
      await adminPost({ action:"updateUser", uid, data });
      setUsers(prev => prev.map(u => u.uid===uid ? {...u,...data} : u));
      showToast("✅ User updated");
    } catch(e) { showToast("❌ " + (e instanceof Error ? e.message : e)); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminPost({ action:"saveConfig", config });
      showToast("✅ Configuration saved!");
    } catch(e) { showToast("❌ " + (e instanceof Error ? e.message : e)); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ display:"flex", height:"100vh", overflow:"hidden", background:"var(--bg)", fontFamily:"Inter,sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside style={{ width:196, flexShrink:0, display:"flex", flexDirection:"column", background:"rgba(11,11,15,.96)", borderRight:"1px solid rgba(255,255,255,.06)", padding:"16px 0" }}>
        <div style={{ padding:"0 14px 14px", borderBottom:"1px solid rgba(255,255,255,.06)", display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:"rgba(239,68,68,.14)", border:"1px solid rgba(239,68,68,.28)", display:"flex", alignItems:"center", justifyContent:"center" }}><Shield size={13} color="#f87171"/></div>
          <div><div style={{ fontSize:12.5, fontWeight:700, color:"var(--tx-1)" }}>Admin</div><div style={{ fontSize:10.5, color:"var(--tx-3)" }}>Control Panel</div></div>
        </div>
        <nav style={{ flex:1, padding:"10px 7px", display:"flex", flexDirection:"column", gap:2 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)} style={{ display:"flex", alignItems:"center", gap:9, padding:"8px 10px", borderRadius:8, border:"none", background:tab===n.id?"rgba(99,102,241,.14)":"transparent", color:tab===n.id?"#818cf8":"var(--tx-2)", fontSize:13, fontWeight:tab===n.id?600:400, cursor:"pointer", textAlign:"left", width:"100%", borderLeft:tab===n.id?"2px solid #6366f1":"2px solid transparent", transition:"all .15s" }}>
              {n.icon} {n.label}
            </button>
          ))}
        </nav>
        <div style={{ padding:"10px 7px", borderTop:"1px solid rgba(255,255,255,.06)", display:"flex", flexDirection:"column", gap:3 }}>
          <button onClick={loadData} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", border:"none", background:"transparent", color:"var(--tx-3)", fontSize:12, cursor:"pointer", borderRadius:7, width:"100%" }}>
            <RefreshCw size={11}/> Refresh
          </button>
          <Link href="/" style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", color:"var(--tx-3)", fontSize:12, textDecoration:"none", borderRadius:7 }}>
            <ArrowLeft size={11}/> Back to App
          </Link>
          <div style={{ padding:"6px 10px", fontSize:11, color:"var(--tx-3)", borderRadius:7, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.email?.split("@")[0]}</div>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────── */}
      <main style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column" }}>
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 24px", borderBottom:"1px solid rgba(255,255,255,.06)", background:"rgba(11,11,14,.8)", backdropFilter:"blur(12px)", flexShrink:0 }}>
          <div>
            <h1 style={{ fontSize:16, fontWeight:700, color:"var(--tx-1)", letterSpacing:"-.01em", marginBottom:2 }}>{NAV.find(n=>n.id===tab)?.label}</h1>
            <p style={{ fontSize:12, color:"var(--tx-3)" }}>
              {tab==="overview" && `${totalUsers} users · ${totalP} prompts total`}
              {tab==="users"    && `${filtered.length} of ${totalUsers} users`}
              {tab==="features" && "Toggle features globally — saved to Firestore instantly"}
              {tab==="limits"   && "Daily prompt limits per plan"}
              {tab==="settings" && "App-wide settings"}
            </p>
          </div>
          <div style={{ display:"flex", gap:9, alignItems:"center" }}>
            {(tab==="features"||tab==="limits"||tab==="settings") && (
              <button onClick={handleSave} disabled={saving} style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 16px", borderRadius:10, background:"var(--accent)", color:"#fff", border:"none", fontSize:13, fontWeight:600, cursor:"pointer", opacity:saving?.7:1 }}>
                <Save size={13}/>{saving?"Saving…":"Save Changes"}
              </button>
            )}
            <div style={{ fontSize:11, color:"var(--tx-3)", background:"rgba(255,255,255,.04)", padding:"5px 10px", borderRadius:20, border:"1px solid rgba(255,255,255,.06)" }}>
              {dataLoading ? "Loading…" : error ? "Error" : `${totalUsers} users`}
            </div>
          </div>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:24 }}>

          {/* Error banner */}
          {error && (
            <div style={{ marginBottom:20, padding:"14px 18px", background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.25)", borderRadius:14, display:"flex", flexDirection:"column", gap:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <AlertTriangle size={15} color="#f87171"/>
                <span style={{ fontSize:14, fontWeight:600, color:"#f87171" }}>
                  {error === "FIREBASE_ADMIN_NOT_CONFIGURED" ? "Firebase Admin SDK Not Configured" : "Data Load Error"}
                </span>
              </div>
              {error === "FIREBASE_ADMIN_NOT_CONFIGURED" ? (
                <>
                  <p style={{ fontSize:13, color:"#fca5a5", lineHeight:1.7 }}>Admin SDK needs a Firebase service account. Go to <strong>Firebase Console → Project Settings → Service Accounts → Generate new private key</strong></p>
                  <p style={{ fontSize:13, color:"var(--tx-2)", lineHeight:1.7 }}>Then add these to <strong>Vercel → Environment Variables:</strong></p>
                  <pre style={{ fontSize:11, background:"rgba(0,0,0,.3)", padding:"10px 12px", borderRadius:8, color:"#a5b4fc", overflowX:"auto" }}>{`FIREBASE_ADMIN_PROJECT_ID=ai-prmpt-master\nFIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxx@ai-prmpt-master.iam.gserviceaccount.com\nFIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nxxx...\\n-----END PRIVATE KEY-----\\n"\nADMIN_SECRET_KEY=admin-secret-2025\nNEXT_PUBLIC_ADMIN_SECRET_KEY=admin-secret-2025`}</pre>
                  <a href="https://console.firebase.google.com/project/ai-prmpt-master/settings/serviceaccounts/adminsdk" target="_blank"
                    style={{ display:"inline-flex", padding:"7px 16px", borderRadius:10, background:"rgba(99,102,241,.18)", border:"1px solid rgba(99,102,241,.3)", color:"#818cf8", fontSize:13, fontWeight:600, textDecoration:"none", width:"fit-content" }}>
                    Open Service Accounts →
                  </a>
                </>
              ) : (
                <>
                  <div style={{ fontSize:12.5, color:"#fca5a5", fontFamily:"monospace", background:"rgba(0,0,0,.2)", padding:"8px 12px", borderRadius:6 }}>{error}</div>
                  <button onClick={loadData} style={{ padding:"7px 16px", borderRadius:10, background:"var(--accent)", color:"#fff", border:"none", fontSize:13, fontWeight:600, cursor:"pointer", width:"fit-content" }}>Retry</button>
                </>
              )}
            </div>
          )}

          {/* ══ OVERVIEW ════════════════════════════════════════ */}
          {tab==="overview" && (
            <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:12 }}>
                <StatCard label="Total Users"    value={totalUsers} sub={`${users.filter(u=>u.status==="active").length} active`} icon={<Users size={16}/>}/>
                <StatCard label="Total Prompts"  value={totalP}     sub="all time"       color="#4ade80" icon={<Activity size={16}/>}/>
                <StatCard label="Today"          value={todayP}     sub="generated today" color="#fbbf24" icon={<TrendingUp size={16}/>}/>
                <StatCard label="Pro / Banned"   value={proCount}   sub={`${banned} banned`} color="#818cf8" icon={<Crown size={16}/>}/>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div style={{ background:"rgba(17,17,22,.8)", border:"1px solid rgba(255,255,255,.08)", borderRadius:14, padding:"16px 18px" }}>
                  <div style={{ fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", color:"var(--tx-3)", marginBottom:14 }}>Plan Distribution</div>
                  {(["free","pro","unlimited"] as const).map(p => {
                    const cnt = users.filter(u=>u.plan===p).length;
                    const pct = totalUsers ? Math.round((cnt/totalUsers)*100) : 0;
                    const col = p==="unlimited"?"#22c55e":p==="pro"?"#6366f1":"#475569";
                    return (
                      <div key={p} style={{ marginBottom:10 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <span style={{ fontSize:12, color:"var(--tx-2)", textTransform:"capitalize" }}>{p}</span>
                          <span style={{ fontSize:12, color:"var(--tx-3)" }}>{cnt} ({pct}%)</span>
                        </div>
                        <div style={{ height:5, borderRadius:3, background:"rgba(255,255,255,.07)" }}>
                          <div style={{ height:"100%", borderRadius:3, background:col, width:`${pct}%`, transition:"width .5s" }}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ background:"rgba(17,17,22,.8)", border:"1px solid rgba(255,255,255,.08)", borderRadius:14, padding:"16px 18px" }}>
                  <div style={{ fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", color:"var(--tx-3)", marginBottom:14 }}>Feature Flags</div>
                  {Object.entries(config.features).map(([k,v]) => (
                    <div key={k} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, fontSize:12.5, color:"var(--tx-2)" }}>
                      <span>{k.replace(/([A-Z])/g," $1").trim()}</span>
                      {v ? <CheckCircle size={13} color="#22c55e"/> : <XCircle size={13} color="#ef4444"/>}
                    </div>
                  ))}
                  <div style={{ marginTop:10, padding:"8px 10px", borderRadius:8, background:config.maintenance.enabled?"rgba(239,68,68,.1)":"rgba(34,197,94,.08)", border:`1px solid ${config.maintenance.enabled?"rgba(239,68,68,.25)":"rgba(34,197,94,.2)"}`, fontSize:12, color:config.maintenance.enabled?"#f87171":"#4ade80" }}>
                    {config.maintenance.enabled ? "🔧 Maintenance Mode ON" : "✅ App is live"}
                  </div>
                </div>
              </div>
              {/* Recent users */}
              <div style={{ background:"rgba(17,17,22,.8)", border:"1px solid rgba(255,255,255,.08)", borderRadius:14, overflow:"hidden" }}>
                <div style={{ padding:"12px 18px", borderBottom:"1px solid rgba(255,255,255,.06)", fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", color:"var(--tx-3)" }}>Recent Users</div>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead><tr style={{ background:"rgba(0,0,0,.2)" }}>
                      {["User","Plan","Status","Prompts","Joined"].map(h=><th key={h} style={{ padding:"9px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:"var(--tx-3)", textTransform:"uppercase", letterSpacing:".05em", whiteSpace:"nowrap" }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {users.slice(0,8).map(u=>(
                        <tr key={u.uid} style={{ borderTop:"1px solid rgba(255,255,255,.05)" }}>
                          <td style={{ padding:"9px 14px" }}>
                            <div style={{ fontSize:13, fontWeight:500, color:"var(--tx-1)" }}>{u.name||"—"}</div>
                            <div style={{ fontSize:11, color:"var(--tx-3)" }}>{u.email}</div>
                          </td>
                          <td style={{ padding:"9px 14px" }}><PlanBadge plan={u.plan??"free"}/></td>
                          <td style={{ padding:"9px 14px", fontSize:12.5, color:"var(--tx-2)" }}><Dot status={u.status??"active"}/>{u.status??"active"}</td>
                          <td style={{ padding:"9px 14px", fontSize:13, color:"var(--tx-2)" }}>{u.totalPrompts??0}</td>
                          <td style={{ padding:"9px 14px", fontSize:12, color:"var(--tx-3)" }}>{u.createdAt?new Date(u.createdAt).toLocaleDateString():"—"}</td>
                        </tr>
                      ))}
                      {users.length===0 && <tr><td colSpan={5} style={{ padding:32, textAlign:"center", color:"var(--tx-3)", fontSize:13 }}>{dataLoading?"Loading…":"No users yet. Ask someone to log into the app."}</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ USERS ════════════════════════════════════════════ */}
          {tab==="users" && (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div style={{ display:"flex", gap:9, flexWrap:"wrap" }}>
                <div style={{ flex:1, minWidth:200, position:"relative" }}>
                  <Search size={13} style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)", color:"var(--tx-3)" }}/>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or email…"
                    style={{ width:"100%", background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.09)", borderRadius:10, color:"var(--tx-1)", fontSize:13, padding:"8px 12px 8px 32px", outline:"none" }}/>
                </div>
                <select value={filterPlan} onChange={e=>setFP(e.target.value)} style={{ background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.09)", borderRadius:10, color:"var(--tx-2)", fontSize:13, padding:"8px 12px", outline:"none", cursor:"pointer" }}>
                  <option value="all">All Plans</option><option value="free">Free</option><option value="pro">Pro</option><option value="unlimited">Unlimited</option>
                </select>
                <select value={filterStatus} onChange={e=>setFS(e.target.value)} style={{ background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.09)", borderRadius:10, color:"var(--tx-2)", fontSize:13, padding:"8px 12px", outline:"none", cursor:"pointer" }}>
                  <option value="all">All Status</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="banned">Banned</option>
                </select>
              </div>
              <div style={{ background:"rgba(17,17,22,.8)", border:"1px solid rgba(255,255,255,.08)", borderRadius:14, overflow:"hidden" }}>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead><tr style={{ background:"rgba(0,0,0,.22)" }}>
                      {["User","Provider","Plan","Status","Daily","Total","Joined","Actions"].map(h=><th key={h} style={{ padding:"10px 13px", textAlign:"left", fontSize:10.5, fontWeight:700, color:"var(--tx-3)", textTransform:"uppercase", letterSpacing:".05em", whiteSpace:"nowrap" }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {filtered.map(u=>(
                        <tr key={u.uid} style={{ borderTop:"1px solid rgba(255,255,255,.05)" }}>
                          <td style={{ padding:"9px 13px", minWidth:190 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              {u.photoURL ? <img src={u.photoURL} alt="" style={{ width:27, height:27, borderRadius:"50%", border:"1px solid rgba(255,255,255,.1)", flexShrink:0 }}/> : <div style={{ width:27, height:27, borderRadius:"50%", background:"rgba(99,102,241,.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#818cf8", flexShrink:0 }}>{(u.name||"?")[0].toUpperCase()}</div>}
                              <div>
                                <div style={{ fontSize:12.5, fontWeight:600, color:"var(--tx-1)", display:"flex", alignItems:"center", gap:4 }}>{u.name||"Unknown"}{u.role==="admin"&&<Crown size={10} color="#f59e0b"/>}</div>
                                <div style={{ fontSize:11, color:"var(--tx-3)", maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding:"9px 13px" }}><span style={{ fontSize:11, padding:"2px 7px", borderRadius:4, background:"rgba(255,255,255,.06)", color:"var(--tx-3)" }}>{u.provider??"google"}</span></td>
                          <td style={{ padding:"9px 13px" }}>
                            <select defaultValue={u.plan??"free"} onChange={e=>handleUpdateUser(u.uid,{plan:e.target.value as UserRecord["plan"]})}
                              style={{ background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.09)", borderRadius:6, color:"var(--tx-2)", fontSize:12, padding:"3px 6px", cursor:"pointer", outline:"none" }}>
                              <option value="free">Free</option><option value="pro">Pro</option><option value="unlimited">Unlimited</option>
                            </select>
                          </td>
                          <td style={{ padding:"9px 13px" }}>
                            <select defaultValue={u.status??"active"} onChange={e=>handleUpdateUser(u.uid,{status:e.target.value as UserRecord["status"]})}
                              style={{ background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.09)", borderRadius:6, color:"var(--tx-2)", fontSize:12, padding:"3px 6px", cursor:"pointer", outline:"none" }}>
                              <option value="active">Active</option><option value="suspended">Suspended</option><option value="banned">Banned</option>
                            </select>
                          </td>
                          <td style={{ padding:"9px 13px", fontSize:12.5, color:"var(--tx-2)", textAlign:"center" }}>{u.dailyPrompts??0}</td>
                          <td style={{ padding:"9px 13px", fontSize:12.5, color:"var(--tx-2)", textAlign:"center" }}>{u.totalPrompts??0}</td>
                          <td style={{ padding:"9px 13px", fontSize:11.5, color:"var(--tx-3)", whiteSpace:"nowrap" }}>{u.createdAt?new Date(u.createdAt).toLocaleDateString():"—"}</td>
                          <td style={{ padding:"9px 13px" }}>
                            <div style={{ display:"flex", gap:5 }}>
                              <button title={u.role==="admin"?"Demote":"Make Admin"} onClick={()=>handleUpdateUser(u.uid,{role:u.role==="admin"?"user":"admin"})} style={{ padding:"4px 8px", borderRadius:6, border:"1px solid rgba(255,255,255,.09)", background:"transparent", color:u.role==="admin"?"#f59e0b":"var(--tx-3)", cursor:"pointer" }}><Crown size={11}/></button>
                              <button title={u.status==="banned"?"Unban":"Ban"} onClick={()=>handleUpdateUser(u.uid,{status:u.status==="banned"?"active":"banned"})} style={{ padding:"4px 8px", borderRadius:6, border:"1px solid rgba(255,255,255,.09)", background:"transparent", color:u.status==="banned"?"#22c55e":"#ef4444", cursor:"pointer" }}>
                                {u.status==="banned"?<UserCheck size={11}/>:<Ban size={11}/>}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filtered.length===0 && <tr><td colSpan={8} style={{ padding:32, textAlign:"center", color:"var(--tx-3)", fontSize:13 }}>No users found</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ FEATURES ════════════════════════════════════════ */}
          {tab==="features" && (
            <div style={{ maxWidth:540, display:"flex", flexDirection:"column", gap:10 }}>
              <div style={{ fontSize:13, color:"#818cf8", padding:"10px 14px", background:"rgba(99,102,241,.08)", border:"1px solid rgba(99,102,241,.2)", borderRadius:10 }}>
                💡 Click Save Changes after toggling. Changes apply in real-time via Firestore.
              </div>
              {([
                { key:"splitView",    label:"Split View",      desc:"Side-by-side prompt comparison" },
                { key:"imageUpload",  label:"Image Upload",    desc:"Let users attach images" },
                { key:"history",      label:"Prompt History",  desc:"Sidebar with saved prompts" },
                { key:"quickActions", label:"Quick Actions",   desc:"Action chips above input" },
                { key:"templates",    label:"Templates",       desc:"Starter templates on home screen" },
                { key:"skillsarkSSO", label:"Skillsark SSO",   desc:"Skillsark login button" },
              ] as const).map(f => (
                <Toggle key={f.key} label={f.label} desc={f.desc}
                  checked={config.features[f.key]}
                  onChange={v => setConfig(c => ({ ...c, features:{ ...c.features, [f.key]:v } }))}
                />
              ))}
            </div>
          )}

          {/* ══ LIMITS ══════════════════════════════════════════ */}
          {tab==="limits" && (
            <div style={{ maxWidth:540, display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ fontSize:13, color:"#fde68a", padding:"10px 14px", background:"rgba(245,158,11,.08)", border:"1px solid rgba(245,158,11,.2)", borderRadius:10 }}>
                ⚠️ Set to <strong>-1</strong> for unlimited. Resets daily at midnight.
              </div>
              {([
                { key:"free",      label:"Free Plan",      desc:"New users", color:"#64748b" },
                { key:"pro",       label:"Pro Plan",        desc:"Upgraded users", color:"#6366f1" },
                { key:"unlimited", label:"Unlimited Plan",  desc:"VIP / Staff (-1 = no limit)", color:"#22c55e" },
              ] as const).map(p => (
                <div key={p.key} style={{ background:"rgba(17,17,22,.8)", border:"1px solid rgba(255,255,255,.08)", borderRadius:14, padding:"18px 20px", borderLeft:`3px solid ${p.color}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:"var(--tx-1)", marginBottom:3 }}>{p.label}</div>
                    <div style={{ fontSize:12, color:"var(--tx-3)" }}>{p.desc}</div>
                    {config.limits[p.key]===-1 && <div style={{ fontSize:11.5, color:"#4ade80", marginTop:4 }}>✓ Unlimited</div>}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <input type="number" value={config.limits[p.key]}
                      onChange={e=>setConfig(c=>({...c,limits:{...c.limits,[p.key]:parseInt(e.target.value)||0}}))}
                      style={{ width:86, background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.1)", borderRadius:10, color:"var(--tx-1)", fontSize:17, fontWeight:700, padding:"7px 12px", outline:"none", textAlign:"center" }}
                    />
                    <span style={{ fontSize:12, color:"var(--tx-3)" }}>/ day</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ══ SETTINGS ════════════════════════════════════════ */}
          {tab==="settings" && (
            <div style={{ maxWidth:540, display:"flex", flexDirection:"column", gap:14 }}>
              {/* Maintenance mode */}
              <div style={{ background:"rgba(17,17,22,.8)", border:`1px solid ${config.maintenance.enabled?"rgba(239,68,68,.3)":"rgba(255,255,255,.08)"}`, borderRadius:14, padding:20, borderLeft:`3px solid ${config.maintenance.enabled?"#ef4444":"rgba(255,255,255,.1)"}` }}>
                <Toggle label="🔧 Maintenance Mode" desc="Blocks all logins and shows a message"
                  checked={config.maintenance.enabled}
                  onChange={v=>setConfig(c=>({...c,maintenance:{...c.maintenance,enabled:v}}))}
                />
                {config.maintenance.enabled && (
                  <div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:8 }}>
                    <label style={{ fontSize:12, fontWeight:600, color:"var(--tx-2)" }}>Message shown to users:</label>
                    <textarea value={config.maintenance.message}
                      onChange={e=>setConfig(c=>({...c,maintenance:{...c.maintenance,message:e.target.value}}))}
                      rows={3} style={{ width:"100%", background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.1)", borderRadius:10, color:"var(--tx-1)", fontSize:13, padding:"10px 12px", outline:"none", resize:"vertical" }}
                    />
                    <div style={{ fontSize:12.5, color:"#fca5a5", padding:"9px 12px", background:"rgba(239,68,68,.08)", border:"1px solid rgba(239,68,68,.2)", borderRadius:8 }}>⚠️ Save Changes to apply!</div>
                  </div>
                )}
              </div>

              {/* Reset daily */}
              <div style={{ background:"rgba(17,17,22,.8)", border:"1px solid rgba(255,255,255,.08)", borderRadius:14, padding:20 }}>
                <div style={{ fontSize:14, fontWeight:700, color:"var(--tx-1)", marginBottom:6 }}>Danger Zone</div>
                <div style={{ fontSize:12.5, color:"var(--tx-3)", marginBottom:12 }}>Reset all users' daily prompt counters to zero.</div>
                <button onClick={async()=>{ if(!confirm("Reset ALL daily counters?"))return; try{ await adminPost({action:"resetDailyAll"}); setUsers(u=>u.map(x=>({...x,dailyPrompts:0}))); showToast("✅ Daily counters reset!"); }catch(e){ showToast("❌ "+(e instanceof Error?e.message:e)); }}}
                  style={{ padding:"8px 16px", borderRadius:9, border:"1px solid rgba(239,68,68,.3)", background:"rgba(239,68,68,.08)", color:"#f87171", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                  🔄 Reset All Daily Counters
                </button>
              </div>

              {/* App info */}
              <div style={{ background:"rgba(17,17,22,.8)", border:"1px solid rgba(255,255,255,.08)", borderRadius:14, padding:"16px 20px" }}>
                <div style={{ fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", color:"var(--tx-3)", marginBottom:12 }}>App Info</div>
                {[["Project","ai-prmpt-master"],["Admin","jaishkumar55@gmail.com"],["Total Users",totalUsers],["Total Prompts",totalP]].map(([k,v])=>(
                  <div key={String(k)} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid rgba(255,255,255,.05)" }}>
                    <span style={{ fontSize:13, color:"var(--tx-3)" }}>{k}</span>
                    <span style={{ fontSize:13, color:"var(--tx-1)", fontWeight:500 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Toast */}
      {toast && <div style={{ position:"fixed", bottom:24, right:24, zIndex:999, padding:"10px 18px", borderRadius:10, background:"rgba(23,23,29,.96)", border:"1px solid rgba(255,255,255,.1)", fontSize:13, color:"var(--tx-1)", fontWeight:500, boxShadow:"0 8px 32px rgba(0,0,0,.5)", backdropFilter:"blur(12px)" }}>{toast}</div>}
    </div>
  );
}
