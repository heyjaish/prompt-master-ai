"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Users, ToggleRight, Sliders, Settings,
  ArrowLeft, Shield, Search, RefreshCw, Save, Ban, UserCheck,
  Crown, TrendingUp, Activity, AlertTriangle, Download, Megaphone,
  Bot, ChevronDown, ChevronUp, Trash2, CheckSquare, Square,
  BarChart2, Zap, Lock, Unlock, Globe, Bell, AlertCircle, CheckCircle, XCircle, User,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

// ── Credentials ───────────────────────────────────────────────
const ADMIN_EMAIL    = "jaishkumar55@gmail.com";
const ADMIN_PASSWORD = "PromptMaster@2025";
const ADMIN_KEY      = process.env.NEXT_PUBLIC_ADMIN_SECRET_KEY ?? "admin-secret-2025";

type Tab = "overview"|"analytics"|"users"|"features"|"aiconfig"|"announcements"|"limits"|"settings"|"analyst"|"errors";

interface ErrorLog {
  id: string;
  uid: string;
  email: string;
  errorType: string;
  errorMessage: string;
  specialist?: string | null;
  modelUsed?: string | null;
  timestamp: number;
  resolved: boolean;
  severity?: "Low" | "Medium" | "High" | "Critical";
  stack?: string | null;
  route?: string | null;
  userAction?: string | null;
}

// ── Types ──────────────────────────────────────────────────────
interface UserRow {
  uid:string; email:string; name:string; photoURL?:string; provider?:string;
  role?:string; status?:string; plan?:string; totalPrompts?:number;
  dailyPrompts?:number; dailyDate?:string; createdAt?:number; lastActiveAt?:number;
  note?:string; customDailyLimit?:number|null;
}
interface GlobalConfig {
  features:{ splitView:boolean; imageUpload:boolean; history:boolean; quickActions:boolean; templates:boolean; skillsarkSSO:boolean; };
  limits:{ free:number; pro:number; unlimited:number; };
  maintenance:{ enabled:boolean; message:string; };
}
interface AIConfig {
  model:string; temperature:number; maxTokens:number;
  systemPromptPrefix:string; enableHistory:boolean; enableSplitView:boolean;
}
interface Announcement {
  enabled:boolean; title:string; message:string;
  type:"info"|"warning"|"success"|"error"; expiresAt?:number;
}

const DEFAULT_CFG: GlobalConfig = {
  features:{ splitView:true, imageUpload:true, history:true, quickActions:true, templates:true, skillsarkSSO:true },
  limits:{ free:10, pro:100, unlimited:-1 },
  maintenance:{ enabled:false, message:"We'll be back soon!" },
};
const DEFAULT_AI: AIConfig = {
  model:"gemini-2.0-flash", temperature:0.7, maxTokens:8192,
  systemPromptPrefix:"", enableHistory:true, enableSplitView:true,
};
const DEFAULT_ANN: Announcement = {
  enabled:false, title:"", message:"", type:"info",
};

// ── API helpers ────────────────────────────────────────────────
async function ag(action:string) {
  const r = await fetch(`/api/admin?action=${action}`, { headers:{"x-admin-key":ADMIN_KEY} });
  if (!r.ok) { const e=await r.json(); throw new Error(e.error||`HTTP ${r.status}`); }
  return r.json();
}
async function ap(body:Record<string,unknown>) {
  const r = await fetch("/api/admin", { method:"POST", headers:{"Content-Type":"application/json","x-admin-key":ADMIN_KEY}, body:JSON.stringify(body) });
  if (!r.ok) { const e=await r.json(); throw new Error(e.error||`HTTP ${r.status}`); }
  return r.json();
}

// ── Small components ───────────────────────────────────────────
const S = { card:"rgba(17,17,22,.8)", border:"rgba(255,255,255,.08)", bdR:14, tx1:"var(--tx-1)", tx2:"var(--tx-2)", tx3:"var(--tx-3)" };

const PlanBadge=({plan}:{plan:string})=>{
  const c=plan==="unlimited"?"#4ade80":plan==="pro"?"#818cf8":"#94a3b8";
  const bg=plan==="unlimited"?"rgba(34,197,94,.15)":plan==="pro"?"rgba(99,102,241,.18)":"rgba(100,116,139,.18)";
  return <span style={{fontSize:10.5,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",padding:"2px 8px",borderRadius:5,background:bg,color:c}}>{plan||"free"}</span>;
};
const StatusBadge=({s}:{s:string})=>{
  const c=s==="active"?"#22c55e":s==="suspended"?"#f59e0b":"#ef4444";
  const bg=s==="active"?"rgba(34,197,94,.12)":s==="suspended"?"rgba(245,158,11,.12)":"rgba(239,68,68,.12)";
  return <span style={{fontSize:10.5,fontWeight:700,padding:"2px 8px",borderRadius:5,background:bg,color:c,display:"flex",alignItems:"center",gap:4,width:"fit-content"}}>
    <span style={{width:5,height:5,borderRadius:"50%",background:c,display:"inline-block"}}/>
    {s||"active"}
  </span>;
};
const Stat=({label,value,sub,color="#94a3b8",icon}:{label:string;value:string|number;sub?:string;color?:string;icon:React.ReactNode})=>(
  <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:S.bdR,padding:"18px 20px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
      <span style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:S.tx3}}>{label}</span>
      <span style={{color,opacity:.8}}>{icon}</span>
    </div>
    <div style={{fontSize:28,fontWeight:800,letterSpacing:"-.02em",color:S.tx1,lineHeight:1}}>{value}</div>
    {sub&&<div style={{fontSize:11.5,color:S.tx3,marginTop:5}}>{sub}</div>}
  </div>
);
const Toggle=({checked,onChange,label,desc}:{checked:boolean;onChange:(v:boolean)=>void;label:string;desc?:string})=>(
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 15px",borderRadius:10,background:"rgba(17,17,22,.6)",border:`1px solid ${S.border}`}}>
    <div><div style={{fontSize:13.5,fontWeight:600,color:S.tx1,marginBottom:2}}>{label}</div>
    {desc&&<div style={{fontSize:12,color:S.tx3}}>{desc}</div>}</div>
    <button onClick={()=>onChange(!checked)} style={{width:44,height:24,borderRadius:12,border:"none",cursor:"pointer",background:checked?"#6366f1":"rgba(255,255,255,.1)",position:"relative",transition:"background .2s",flexShrink:0}}>
      <span style={{position:"absolute",top:3,left:checked?23:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left .2s",display:"block",boxShadow:"0 1px 4px rgba(0,0,0,.4)"}}/>
    </button>
  </div>
);
const Note=({type,children}:{type:"blue"|"yellow"|"red"|"green";children:React.ReactNode})=>{
  const c={blue:["rgba(99,102,241,.08)","rgba(99,102,241,.2)","#818cf8"],yellow:["rgba(245,158,11,.08)","rgba(245,158,11,.2)","#fde68a"],red:["rgba(239,68,68,.08)","rgba(239,68,68,.2)","#fca5a5"],green:["rgba(34,197,94,.08)","rgba(34,197,94,.2)","#4ade80"]}[type];
  return <div style={{fontSize:13,color:c[2],padding:"10px 14px",background:c[0],border:`1px solid ${c[1]}`,borderRadius:10}}>{children}</div>;
};

export default function AdminPage() {
  const {user,loading} = useAuth();
  const router = useRouter();
  const [tab, setTab]       = useState<Tab>("overview");
  const [pwOk,setPwOk]      = useState(false);
  const [pwIn,setPwIn]      = useState(""); const [pwErr,setPwErr] = useState(""); const [showPw,setShowPw] = useState(false);
  const [users,setUsers]    = useState<UserRow[]>([]);
  const [analytics,setAna]  = useState<Record<string,unknown>|null>(null);
  const [cfg,setCfg]        = useState<GlobalConfig>(DEFAULT_CFG);
  const [aiCfg,setAiCfg]   = useState<AIConfig>(DEFAULT_AI);
  const [ann,setAnn]        = useState<Announcement>(DEFAULT_ANN);
  const [contact,setContact]= useState({email:"jaishkumar55@gmail.com",message:"Please contact admin for help.",supportUrl:""});
  const [dl,setDl]          = useState(false);
  const [saving,setSaving]  = useState(false);
  const [err,setErr]        = useState<string|null>(null);
  const [toast,setToast]    = useState("");
  const [search,setSrch]    = useState("");
  const [fPlan,setFPlan]    = useState("all");
  const [fStatus,setFSt]    = useState("all");
  const [selected,setSelectable] = useState<Set<string>>(new Set());
  const [expandedUid,setExpUid] = useState<string|null>(null);
  const [editNote,setEditNote] = useState("");
  const [editCDL,setEditCDL]  = useState<number|null>(null);
  const [analystInsights, setAnalystInsights] = useState<string|"">("");
  const [analystLoading, setAnalystLoading]   = useState(false);
  const [analystQ, setAnalystQ]               = useState("");
  const [analystCache, setAnalystCache]       = useState<Record<string,unknown>|null>(null);
  const [analystTime, setAnalystTime]         = useState<number|null>(null);
  const [errorLogs, setErrorLogs]             = useState<ErrorLog[]>([]);
  const [errLogsLoading, setErrLogsLoading]   = useState(false);
  const [errFilter, setErrFilter]             = useState<"all"|"today"|"7d"|"unresolved"|"quota"|"frontend"|string>("all");
  const [errSearch, setErrSearch]             = useState("");
  const [expandedErr, setExpandedErr]         = useState<string|null>(null);
  
  // ── User Intelligence States ──────────────────────────────
  const [inspectedUser, setInspectedUser]     = useState<UserRow|null>(null);
  const [inspectedHistory, setInspectedHistory] = useState<any[]>([]);
  const [inspectLoading, setInspectLoading]   = useState(false);
  const [inspectTab, setInspectTab]           = useState<"intel"|"history">("intel");

  const isAdmin = useMemo(()=>user?.email?.toLowerCase()===ADMIN_EMAIL.toLowerCase(),[user]);
  const st=(m:string)=>{setToast(m);setTimeout(()=>setToast(""),3200);};

  const load = useCallback(async()=>{
    if(!isAdmin||!pwOk) return;
    setDl(true); setErr(null);
    try {
      const [ud,cd,ad,acd,annd]=await Promise.all([ag("users"),ag("config"),ag("analytics"),ag("aiConfig"),ag("announcement")]);
      setUsers(ud.users??[]);
      if(cd.config) setCfg({...DEFAULT_CFG,...cd.config});
      if(cd.contact) setContact(c=>({...c,...cd.contact}));
      setAna(ad);
      if(acd.aiConfig) setAiCfg({...DEFAULT_AI,...acd.aiConfig});
      if(annd.announcement) setAnn({...DEFAULT_ANN,...annd.announcement});
    } catch(e:unknown){ setErr(e instanceof Error?e.message:String(e)); }
    finally{ setDl(false); }
  },[isAdmin,pwOk]);

  const loadErrors = useCallback(async () => {
    if (!isAdmin || !pwOk) return;
    setErrLogsLoading(true);
    try {
      const d = await ag("errors");
      setErrorLogs(d.errors ?? []);
    } catch { /* silent */ }
    finally { setErrLogsLoading(false); }
  }, [isAdmin, pwOk]);

  useEffect(()=>{if(!loading&&!user){router.replace("/login");return;} if(!loading&&user&&isAdmin&&pwOk)load();},[user,loading,isAdmin,pwOk,load,router]);

  useEffect(() => { if (tab === "errors") loadErrors(); }, [tab, loadErrors]);

  // ── Guards ────────────────────────────────────────────────────
  if(loading) return <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg)"}}><div style={{width:36,height:36,borderRadius:"50%",border:"3px solid #6366f1",borderTopColor:"transparent",animation:"spin 1s linear infinite"}}/></div>;
  if(!user) return null;

  if(!isAdmin) return (
    <div style={{height:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"var(--bg)",gap:16}}>
      <div style={{width:52,height:52,borderRadius:14,background:"rgba(239,68,68,.12)",border:"1px solid rgba(239,68,68,.3)",display:"flex",alignItems:"center",justifyContent:"center"}}><Shield size={22} color="#f87171"/></div>
      <div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:700,color:S.tx1,marginBottom:6}}>Access Denied</div><div style={{fontSize:13,color:S.tx3}}>Must sign in as <code style={{color:"#f87171"}}>{ADMIN_EMAIL}</code></div></div>
      <Link href="/" style={{padding:"8px 20px",borderRadius:10,background:"#6366f1",color:"#fff",textDecoration:"none",fontSize:13,fontWeight:600}}>← Back</Link>
    </div>
  );

  if(!pwOk) return (
    <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg)",backgroundImage:"radial-gradient(ellipse at 30% 60%,rgba(239,68,68,.07) 0%,transparent 55%)"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{width:"100%",maxWidth:360,background:"rgba(23,23,29,.93)",backdropFilter:"blur(24px)",border:`1px solid ${S.border}`,borderRadius:20,padding:"32px 28px",boxShadow:"0 24px 64px rgba(0,0,0,.6)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:22}}>
          <div style={{width:38,height:38,borderRadius:10,background:"rgba(239,68,68,.12)",border:"1px solid rgba(239,68,68,.3)",display:"flex",alignItems:"center",justifyContent:"center"}}><Shield size={17} color="#f87171"/></div>
          <div><div style={{fontSize:15,fontWeight:700,color:S.tx1}}>Admin Panel</div><div style={{fontSize:11.5,color:S.tx3}}>Prompt Master AI</div></div>
        </div>
        <div style={{fontSize:12,color:S.tx3,background:"rgba(255,255,255,.04)",border:`1px solid ${S.border}`,borderRadius:8,padding:"6px 10px",marginBottom:16,display:"flex",alignItems:"center",gap:6}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:"#22c55e",display:"inline-block"}}/>{user.email}
        </div>
        <form onSubmit={e=>{e.preventDefault();if(pwIn===ADMIN_PASSWORD){setPwErr("");setPwOk(true);}else{setPwErr("❌ Wrong password!");setPwIn("");}}} style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{position:"relative"}}>
            <input autoFocus type={showPw?"text":"password"} value={pwIn} onChange={e=>{setPwIn(e.target.value);setPwErr("");}} placeholder="Admin password"
              style={{width:"100%",background:"rgba(255,255,255,.05)",border:`1px solid ${pwErr?"rgba(239,68,68,.5)":S.border}`,borderRadius:10,color:S.tx1,fontSize:14,padding:"11px 44px 11px 14px",outline:"none",letterSpacing:showPw?"normal":".12em"}}/>
            <button type="button" onClick={()=>setShowPw(s=>!s)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:S.tx3,fontSize:12,cursor:"pointer"}}>{showPw?"Hide":"Show"}</button>
          </div>
          {pwErr&&<div style={{fontSize:12.5,color:"#f87171"}}>{pwErr}</div>}
          <button type="submit" style={{padding:11,borderRadius:10,background:"linear-gradient(135deg,#ef4444,#dc2626)",color:"#fff",border:"none",fontSize:14,fontWeight:700,cursor:"pointer"}}>🔓 Unlock Admin Panel</button>
          <Link href="/" style={{textAlign:"center",fontSize:12.5,color:S.tx3,textDecoration:"none"}}>← Back to App</Link>
        </form>
      </div>
    </div>
  );

  // ── Filtered users ─────────────────────────────────────────────
  const filtered=users.filter(u=>{
    const q=search.toLowerCase();
    return(!q||u.name?.toLowerCase().includes(q)||u.email?.toLowerCase().includes(q))&&(fPlan==="all"||u.plan===fPlan)&&(fStatus==="all"||u.status===fStatus);
  });
  const today=new Date().toISOString().slice(0,10);
  const totalU=users.length, totalP=users.reduce((s,u)=>s+(u.totalPrompts??0),0), todayP=users.filter(u=>u.dailyDate===today).reduce((s,u)=>s+(u.dailyPrompts??0),0);

  const NAV:[Tab,string,React.ReactNode][]=[
    ["overview","Overview",<LayoutDashboard size={13}/>],
    ["analytics","Analytics",<BarChart2 size={13}/>],
    ["users","Users",<Users size={13}/>],
    ["errors","🔴 Errors",<AlertCircle size={13}/>],
    ["analyst","🤖 AI Analyst",<Zap size={13}/>],
    ["features","Features",<ToggleRight size={13}/>],
    ["aiconfig","AI Config",<Bot size={13}/>],
    ["announcements","Alerts",<Megaphone size={13}/>],
    ["limits","Limits",<Sliders size={13}/>],
    ["settings","Settings",<Settings size={13}/>],
  ];

    try{ await ap({action:"updateUser",uid,data}); setUsers(p=>p.map(u=>u.uid===uid?{...u,...data}:u)); st("✅ User updated"); }
    catch(e){ st("❌ "+(e instanceof Error?e.message:e)); }
  };

  const handleInspectUser = async (u: UserRow) => {
    setInspectedUser(u);
    setInspectLoading(true);
    setInspectTab("intel");
    try {
      const res = await fetch(`/api/admin?action=userHistory&uid=${u.uid}`, {
        headers: { "x-admin-key": process.env.NEXT_PUBLIC_ADMIN_SECRET_KEY || "admin-secret-2025" }
      });
      const data = await res.json();
      setInspectedHistory(data.history || []);
    } catch { st("❌ Failed to load history"); }
    finally { setInspectLoading(false); }
  };
  const handleDelete=async(uid:string)=>{
    if(!confirm("Delete this user permanently?")) return;
    try{ await ap({action:"deleteUser",uid}); setUsers(p=>p.filter(u=>u.uid!==uid)); st("✅ User deleted"); }
    catch(e){ st("❌ "+(e instanceof Error?e.message:e)); }
  };
  const handleBulkPlan=async(plan:string)=>{
    if(!selected.size)return;
    try{ await ap({action:"bulkUpdatePlan",uids:[...selected],plan}); setUsers(p=>p.map(u=>selected.has(u.uid)?{...u,plan:plan as UserRow["plan"]}:u)); setSelectable(new Set()); st(`✅ ${selected.size} users set to ${plan}`); }
    catch(e){ st("❌ "+(e instanceof Error?e.message:e)); }
  };
  const handleBulkStatus=async(status:string)=>{
    if(!selected.size)return;
    try{ await ap({action:"bulkUpdateStatus",uids:[...selected],status}); setUsers(p=>p.map(u=>selected.has(u.uid)?{...u,status:status as UserRow["status"]}:u)); setSelectable(new Set()); st(`✅ ${selected.size} users updated`); }
    catch(e){ st("❌ "+(e instanceof Error?e.message:e)); }
  };
  const handleSaveCfg=async()=>{setSaving(true);try{await ap({action:"saveConfig",config:cfg});st("✅ Configuration saved!");}catch(e){st("❌ "+(e instanceof Error?e.message:e));}finally{setSaving(false);}};
  const handleSaveAI=async()=>{setSaving(true);try{await ap({action:"saveAIConfig",aiConfig:aiCfg});st("✅ AI Config saved!");}catch(e){st("❌ "+(e instanceof Error?e.message:e));}finally{setSaving(false);}};
  const handleSaveAnn=async()=>{setSaving(true);try{await ap({action:"saveAnnouncement",announcement:ann});st("✅ Announcement saved!");}catch(e){st("❌ "+(e instanceof Error?e.message:e));}finally{setSaving(false);}};
  const handleSaveContact=async()=>{setSaving(true);try{await ap({action:"saveContact",contact});st("✅ Contact info saved!");}catch(e){st("❌ "+(e instanceof Error?e.message:e));}finally{setSaving(false);}};
  const exportCSV=async()=>{
    try{ const r=await fetch("/api/admin?action=exportCSV",{headers:{"x-admin-key":ADMIN_KEY}}); const blob=await r.blob(); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="users.csv"; a.click(); st("✅ CSV downloaded!"); }
    catch(e){ st("❌ Export failed"); }
  };
  const toggleSelect=(uid:string)=>{ setSelectable(p=>{const n=new Set(p);n.has(uid)?n.delete(uid):n.add(uid);return n;}); };
  const selectAll=()=>{ setSelectable(filtered.length===selected.size?new Set():new Set(filtered.map(u=>u.uid))); };
  const showSave = ["features","limits","settings","aiconfig","announcements"].includes(tab);
  const onSave = async()=>{ if(tab==="features"||tab==="limits") handleSaveCfg(); if(tab==="settings"){ await handleSaveCfg(); await handleSaveContact(); } if(tab==="aiconfig") handleSaveAI(); if(tab==="announcements") handleSaveAnn(); };

  return (
    <div style={{display:"flex",height:"100vh",overflow:"hidden",background:"var(--bg)",fontFamily:"Inter,sans-serif"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}.nav-btn:hover{background:rgba(255,255,255,.05)!important}`}</style>

      {/* ── SIDEBAR ── */}
      <aside style={{width:200,flexShrink:0,display:"flex",flexDirection:"column",background:"rgba(9,9,13,.97)",borderRight:`1px solid ${S.border}`,padding:"14px 0"}}>
        <div style={{padding:"0 13px 13px",borderBottom:`1px solid ${S.border}`,display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:30,height:30,borderRadius:9,background:"rgba(239,68,68,.14)",border:"1px solid rgba(239,68,68,.28)",display:"flex",alignItems:"center",justifyContent:"center"}}><Shield size={13} color="#f87171"/></div>
          <div><div style={{fontSize:12.5,fontWeight:800,color:S.tx1,letterSpacing:"-.02em"}}>Admin</div><div style={{fontSize:10.5,color:S.tx3}}>Prompt Master AI</div></div>
        </div>
        <nav style={{flex:1,padding:"8px 6px",display:"flex",flexDirection:"column",gap:1,overflowY:"auto"}}>
          {NAV.map(([id,label,icon])=>(
            <button key={id} className="nav-btn" onClick={()=>setTab(id)} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:8,border:"none",background:tab===id?"rgba(99,102,241,.15)":"transparent",color:tab===id?"#818cf8":S.tx2,fontSize:12.5,fontWeight:tab===id?600:400,cursor:"pointer",textAlign:"left",width:"100%",borderLeft:tab===id?"2px solid #6366f1":"2px solid transparent",transition:"all .15s"}}>
              <span style={{opacity:.85}}>{icon}</span>{label}
            </button>
          ))}
        </nav>
        <div style={{padding:"8px 6px",borderTop:`1px solid ${S.border}`,display:"flex",flexDirection:"column",gap:2}}>
          <button onClick={load} style={{display:"flex",alignItems:"center",gap:7,padding:"7px 10px",border:"none",background:"transparent",color:S.tx3,fontSize:12,cursor:"pointer",borderRadius:7,width:"100%"}}><RefreshCw size={11}/> Refresh</button>
          <Link href="/" style={{display:"flex",alignItems:"center",gap:7,padding:"7px 10px",color:S.tx3,fontSize:12,textDecoration:"none",borderRadius:7}}><ArrowLeft size={11}/> Back to App</Link>
          <div style={{padding:"5px 10px",fontSize:11,color:S.tx3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{user.email?.split("@")[0]}</div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
        {/* Topbar */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 22px",borderBottom:`1px solid ${S.border}`,background:"rgba(11,11,14,.85)",backdropFilter:"blur(12px)",flexShrink:0}}>
          <div>
            <h1 style={{fontSize:15.5,fontWeight:700,color:S.tx1,letterSpacing:"-.01em",marginBottom:2}}>{NAV.find(n=>n[0]===tab)?.[1]}</h1>
            <p style={{fontSize:11.5,color:S.tx3}}>
              {tab==="overview"&&`${totalU} users · ${totalP} total prompts`}
              {tab==="analytics"&&"Usage data & charts"}
              {tab==="users"&&`${filtered.length} of ${totalU} users`}
              {tab==="errors"&&`${errorLogs.filter(e=>!e.resolved).length} unresolved · ${errorLogs.length} total`}
              {tab==="features"&&"Toggle app features globally"}
              {tab==="aiconfig"&&"Gemini model & generation settings"}
              {tab==="announcements"&&"Banner shown to all users"}
              {tab==="limits"&&"Daily prompt limits per plan"}
              {tab==="settings"&&"Maintenance, danger zone, app info"}
            </p>
          </div>
          <div style={{display:"flex",gap:9,alignItems:"center"}}>
            {(showSave||tab==="aiconfig"||tab==="announcements")&&(
              <button onClick={onSave} disabled={saving} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 15px",borderRadius:9,background:"#6366f1",color:"#fff",border:"none",fontSize:12.5,fontWeight:600,cursor:"pointer",opacity:saving?.7:1}}>
                <Save size={12}/>{saving?"Saving…":"Save Changes"}
              </button>
            )}
            <div style={{fontSize:11,color:dl?"#fbbf24":err?"#f87171":"#4ade80",background:S.card,padding:"5px 10px",borderRadius:20,border:`1px solid ${S.border}`}}>
              {dl?"⏳ Loading…":err?"⚠️ Error":"✅ Live"}
            </div>
          </div>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:22}}>

          {/* Error */}
          {err&&(
            <div style={{marginBottom:18,padding:"13px 17px",background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.25)",borderRadius:13,display:"flex",flexDirection:"column",gap:9}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}><AlertTriangle size={14} color="#f87171"/><span style={{fontSize:13.5,fontWeight:600,color:"#f87171"}}>{err==="FIREBASE_ADMIN_NOT_CONFIGURED"?"Firebase Admin Not Configured":"Error Loading Data"}</span></div>
              {err==="FIREBASE_ADMIN_NOT_CONFIGURED"?(
                <><p style={{fontSize:12.5,color:"#fca5a5"}}>Add these to <strong>Vercel → Environment Variables</strong> then Redeploy:</p>
                <pre style={{fontSize:11,background:"rgba(0,0,0,.3)",padding:"9px 12px",borderRadius:7,color:"#a5b4fc",overflowX:"auto"}}>{`FIREBASE_ADMIN_PROJECT_ID=ai-prmpt-master\nFIREBASE_ADMIN_CLIENT_EMAIL=...\nFIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n..."\nADMIN_SECRET_KEY=admin-secret-2025\nNEXT_PUBLIC_ADMIN_SECRET_KEY=admin-secret-2025`}</pre>
                <a href="https://console.firebase.google.com/project/ai-prmpt-master/settings/serviceaccounts/adminsdk" target="_blank" style={{display:"inline-flex",padding:"6px 14px",borderRadius:9,background:"rgba(99,102,241,.18)",color:"#818cf8",fontSize:12.5,fontWeight:600,textDecoration:"none",width:"fit-content"}}>Open Service Accounts →</a></>
              ):<><div style={{fontSize:12,color:"#fca5a5",fontFamily:"monospace",background:"rgba(0,0,0,.2)",padding:"7px 11px",borderRadius:6}}>{err}</div><button onClick={load} style={{padding:"6px 14px",borderRadius:9,background:"#6366f1",color:"#fff",border:"none",fontSize:12.5,fontWeight:600,cursor:"pointer",width:"fit-content"}}>Retry</button></>}
            </div>
          )}

          {/* ══ OVERVIEW ══ */}
          {tab==="overview"&&(
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(165px,1fr))",gap:11}}>
                <Stat label="Total Users" value={totalU} sub={`${users.filter(u=>u.status==="active").length} active`} icon={<Users size={15}/>}/>
                <Stat label="Total Prompts" value={totalP} sub="all time" color="#4ade80" icon={<Activity size={15}/>}/>
                <Stat label="Today" value={todayP} sub="prompts today" color="#fbbf24" icon={<TrendingUp size={15}/>}/>
                <Stat label="Pro Users" value={users.filter(u=>u.plan==="pro").length} sub={`${users.filter(u=>u.plan==="unlimited").length} unlimited`} color="#818cf8" icon={<Crown size={15}/>}/>
                <Stat label="Banned" value={users.filter(u=>u.status==="banned").length} sub={`${users.filter(u=>u.status==="suspended").length} suspended`} color="#f87171" icon={<Ban size={15}/>}/>
                <Stat label="Maintenance" value={cfg.maintenance.enabled?"ON":"OFF"} sub={cfg.maintenance.enabled?"Login blocked":"App live"} color={cfg.maintenance.enabled?"#f87171":"#4ade80"} icon={cfg.maintenance.enabled?<Lock size={15}/>:<Unlock size={15}/>}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:11}}>
                {/* Recent users */}
                <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:S.bdR,overflow:"hidden"}}>
                  <div style={{padding:"11px 16px",borderBottom:`1px solid ${S.border}`,fontSize:11.5,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:S.tx3}}>Recent Users</div>
                  <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr style={{background:"rgba(0,0,0,.18)"}}>{["User","Plan","Status","Prompts"].map(h=><th key={h} style={{padding:"8px 13px",textAlign:"left",fontSize:10.5,fontWeight:700,color:S.tx3,textTransform:"uppercase",letterSpacing:".05em"}}>{h}</th>)}</tr></thead>
                    <tbody>{users.slice(0,8).map(u=>(
                      <tr key={u.uid} style={{borderTop:`1px solid ${S.border}`}}>
                        <td style={{padding:"8px 13px"}}><div style={{fontSize:12.5,fontWeight:500,color:S.tx1}}>{u.name||"—"}</div><div style={{fontSize:10.5,color:S.tx3}}>{u.email}</div></td>
                        <td style={{padding:"8px 13px"}}><PlanBadge plan={u.plan??"free"}/></td>
                        <td style={{padding:"8px 13px"}}><StatusBadge s={u.status??"active"}/></td>
                        <td style={{padding:"8px 13px",fontSize:13,color:S.tx2}}>{u.totalPrompts??0}</td>
                      </tr>
                    ))}{users.length===0&&<tr><td colSpan={4} style={{padding:24,textAlign:"center",color:S.tx3,fontSize:12}}>No users yet</td></tr>}</tbody>
                  </table></div>
                </div>
                {/* Quick status */}
                <div style={{display:"flex",flexDirection:"column",gap:11}}>
                  <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:S.bdR,padding:"14px 16px"}}>
                    <div style={{fontSize:11.5,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:S.tx3,marginBottom:12}}>Announcement</div>
                    <div style={{fontSize:12.5,color:ann.enabled?"#4ade80":"#94a3b8",marginBottom:6}}>{ann.enabled?"🟢 Active":"⚪ Off"}</div>
                    {ann.enabled&&<div style={{fontSize:12,color:S.tx2,lineHeight:1.5}}><strong>{ann.title}</strong><br/>{ann.message}</div>}
                    {!ann.enabled&&<div style={{fontSize:12,color:S.tx3}}>No active announcement</div>}
                  </div>
                  <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:S.bdR,padding:"14px 16px"}}>
                    <div style={{fontSize:11.5,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:S.tx3,marginBottom:10}}>AI Model</div>
                    <div style={{fontSize:12.5,color:"#818cf8",fontFamily:"monospace"}}>{aiCfg.model}</div>
                    <div style={{fontSize:11.5,color:S.tx3,marginTop:4}}>Temp: {aiCfg.temperature} · Max: {aiCfg.maxTokens}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ ANALYTICS ══ */}
          {tab==="analytics"&&(
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              {analytics?(
                <>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:11}}>
                    <Stat label="Total Users"  value={(analytics.totalUsers as number)||0}  icon={<Users size={14}/>}/>
                    <Stat label="Active"       value={(analytics.activeUsers as number)||0}  color="#22c55e" icon={<Activity size={14}/>}/>
                    <Stat label="Banned"       value={(analytics.bannedUsers as number)||0}  color="#ef4444" icon={<Ban size={14}/>}/>
                    <Stat label="All Prompts"  value={(analytics.totalPrompts as number)||0} color="#818cf8" icon={<Zap size={14}/>}/>
                    <Stat label="Today"        value={(analytics.todayPrompts as number)||0} color="#fbbf24" icon={<TrendingUp size={14}/>}/>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:11}}>
                    {/* Daily chart */}
                    <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:S.bdR,padding:"16px 18px"}}>
                      <div style={{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:S.tx3,marginBottom:16}}>Last 7 Days — Prompts</div>
                      {(()=>{
                        const days=analytics.dailyChart as Record<string,number>;
                        const maxVal=Math.max(...Object.values(days),1);
                        return(
                          <div style={{display:"flex",alignItems:"flex-end",gap:6,height:100}}>
                            {Object.entries(days).map(([d,v])=>(
                              <div key={d} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                                <div style={{fontSize:11,color:S.tx3,fontWeight:600}}>{v||""}</div>
                                <div style={{width:"100%",borderRadius:"4px 4px 0 0",height:`${Math.max((v/maxVal)*80,v>0?8:2)}px`,transition:"height .4s",background:v>0?"linear-gradient(to top,#6366f1,#818cf8)":"rgba(255,255,255,.06)"}}/>
                                <div style={{fontSize:10,color:S.tx3}}>{d.slice(5)}</div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                    {/* Plan + Provider dist */}
                    <div style={{display:"flex",flexDirection:"column",gap:11}}>
                      <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:S.bdR,padding:"14px 16px"}}>
                        <div style={{fontSize:11.5,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:S.tx3,marginBottom:12}}>Plan Split</div>
                        {Object.entries((analytics.planDist as Record<string,number>)||{}).map(([p,n])=>{
                          const col=p==="unlimited"?"#22c55e":p==="pro"?"#6366f1":"#475569";
                          const pct=(analytics.totalUsers as number)>0?Math.round((n/(analytics.totalUsers as number))*100):0;
                          return <div key={p} style={{marginBottom:8}}>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3,fontSize:11.5}}><span style={{color:S.tx2,textTransform:"capitalize"}}>{p}</span><span style={{color:S.tx3}}>{n} ({pct}%)</span></div>
                            <div style={{height:5,borderRadius:3,background:"rgba(255,255,255,.07)"}}><div style={{height:"100%",borderRadius:3,background:col,width:`${pct}%`,transition:"width .5s"}}/></div>
                          </div>;
                        })}
                      </div>
                      <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:S.bdR,padding:"14px 16px"}}>
                        <div style={{fontSize:11.5,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:S.tx3,marginBottom:12}}>Auth Provider</div>
                        {Object.entries((analytics.providerDist as Record<string,number>)||{}).map(([p,n])=>(
                          <div key={p} style={{display:"flex",justifyContent:"space-between",marginBottom:7,fontSize:12,color:S.tx2}}>
                            <span style={{textTransform:"capitalize"}}>{p==="google"?"🔵 Google":"🟠 Skillsark"}</span><span style={{color:S.tx1,fontWeight:600}}>{n}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Top users */}
                  <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:S.bdR,overflow:"hidden"}}>
                    <div style={{padding:"11px 16px",borderBottom:`1px solid ${S.border}`,fontSize:11.5,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:S.tx3}}>Top Users by Prompts</div>
                    <table style={{width:"100%",borderCollapse:"collapse"}}>
                      <thead><tr style={{background:"rgba(0,0,0,.18)"}}>{["#","User","Plan","Prompts"].map(h=><th key={h} style={{padding:"8px 13px",textAlign:"left",fontSize:10.5,fontWeight:700,color:S.tx3,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                      <tbody>{((analytics.topUsers as Record<string,unknown>[])||[]).map((u,i)=>(
                        <tr key={i} style={{borderTop:`1px solid ${S.border}`}}>
                          <td style={{padding:"8px 13px",fontSize:13,fontWeight:700,color:i<3?"#fbbf24":S.tx3}}>#{i+1}</td>
                          <td style={{padding:"8px 13px"}}><div style={{fontSize:12.5,fontWeight:500,color:S.tx1}}>{u.name as string||"—"}</div><div style={{fontSize:11,color:S.tx3}}>{u.email as string}</div></td>
                          <td style={{padding:"8px 13px"}}><PlanBadge plan={u.plan as string??"free"}/></td>
                          <td style={{padding:"8px 13px",fontSize:13,fontWeight:700,color:"#4ade80"}}>{u.totalPrompts as number||0}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </>
              ):<div style={{textAlign:"center",padding:48,color:S.tx3}}>{dl?"Loading analytics…":"Click Refresh to load analytics"}</div>}
            </div>
          )}

          {/* ══ USERS ══ */}
          {tab==="users"&&(
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {/* Toolbar */}
              <div style={{display:"flex",gap:9,flexWrap:"wrap",alignItems:"center"}}>
                <div style={{flex:1,minWidth:200,position:"relative"}}>
                  <Search size={12} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:S.tx3}}/>
                  <input value={search} onChange={e=>setSrch(e.target.value)} placeholder="Search name or email…"
                    style={{width:"100%",background:"rgba(255,255,255,.04)",border:`1px solid ${S.border}`,borderRadius:10,color:S.tx1,fontSize:12.5,padding:"8px 12px 8px 30px",outline:"none"}}/>
                </div>
                <select value={fPlan} onChange={e=>setFPlan(e.target.value)} style={{background:"rgba(255,255,255,.04)",border:`1px solid ${S.border}`,borderRadius:10,color:S.tx2,fontSize:12.5,padding:"8px 11px",outline:"none",cursor:"pointer"}}>
                  <option value="all">All Plans</option><option value="free">Free</option><option value="pro">Pro</option><option value="unlimited">Unlimited</option>
                </select>
                <select value={fStatus} onChange={e=>setFSt(e.target.value)} style={{background:"rgba(255,255,255,.04)",border:`1px solid ${S.border}`,borderRadius:10,color:S.tx2,fontSize:12.5,padding:"8px 11px",outline:"none",cursor:"pointer"}}>
                  <option value="all">All Status</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="banned">Banned</option>
                </select>
                <button onClick={exportCSV} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",borderRadius:10,background:"rgba(34,197,94,.12)",border:"1px solid rgba(34,197,94,.25)",color:"#4ade80",fontSize:12.5,fontWeight:600,cursor:"pointer"}}>
                  <Download size={12}/> Export CSV
                </button>
              </div>
              {/* Bulk actions */}
              {selected.size>0&&(
                <div style={{display:"flex",alignItems:"center",gap:9,padding:"10px 14px",background:"rgba(99,102,241,.1)",border:"1px solid rgba(99,102,241,.2)",borderRadius:10}}>
                  <span style={{fontSize:12.5,color:"#818cf8",fontWeight:600}}>{selected.size} selected</span>
                  <span style={{color:S.tx3}}>|</span>
                  {["free","pro","unlimited"].map(p=><button key={p} onClick={()=>handleBulkPlan(p)} style={{padding:"4px 10px",borderRadius:7,border:"1px solid rgba(99,102,241,.3)",background:"transparent",color:"#818cf8",fontSize:12,cursor:"pointer",textTransform:"capitalize"}}>{p}</button>)}
                  <span style={{color:S.tx3}}>|</span>
                  <button onClick={()=>handleBulkStatus("active")} style={{padding:"4px 10px",borderRadius:7,border:"1px solid rgba(34,197,94,.3)",background:"transparent",color:"#4ade80",fontSize:12,cursor:"pointer"}}>Activate</button>
                  <button onClick={()=>handleBulkStatus("banned")} style={{padding:"4px 10px",borderRadius:7,border:"1px solid rgba(239,68,68,.3)",background:"transparent",color:"#f87171",fontSize:12,cursor:"pointer"}}>Ban All</button>
                  <button onClick={()=>setSelectable(new Set())} style={{marginLeft:"auto",padding:"4px 10px",borderRadius:7,border:`1px solid ${S.border}`,background:"transparent",color:S.tx3,fontSize:12,cursor:"pointer"}}>Clear</button>
                </div>
              )}
              {/* Table */}
              <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:S.bdR,overflow:"hidden"}}>
                <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr style={{background:"rgba(0,0,0,.22)"}}>
                    <th style={{padding:"9px 12px",textAlign:"center",width:36}}>
                      <button onClick={selectAll} style={{background:"none",border:"none",cursor:"pointer",color:S.tx3,display:"flex"}}>
                        {selected.size===filtered.length&&filtered.length>0?<CheckSquare size={14} color="#818cf8"/>:<Square size={14}/>}
                      </button>
                    </th>
                    {["User","Plan","Status","Daily","Total","Joined","Actions"].map(h=><th key={h} style={{padding:"9px 12px",textAlign:"left",fontSize:10.5,fontWeight:700,color:S.tx3,textTransform:"uppercase",letterSpacing:".05em",whiteSpace:"nowrap"}}>{h}</th>)}
                    <th/>
                  </tr></thead>
                  <tbody>
                    {filtered.map(u=>(
                      <>
                        <tr key={u.uid} style={{borderTop:`1px solid ${S.border}`}}>
                          <td style={{padding:"8px 12px",textAlign:"center"}}>
                            <button onClick={()=>toggleSelect(u.uid)} style={{background:"none",border:"none",cursor:"pointer",color:S.tx3,display:"flex"}}>{selected.has(u.uid)?<CheckSquare size={13} color="#818cf8"/>:<Square size={13}/>}</button>
                          </td>
                          <td style={{padding:"8px 12px",minWidth:180}}>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              {u.photoURL?<img src={u.photoURL} alt="" style={{width:26,height:26,borderRadius:"50%",border:`1px solid ${S.border}`,flexShrink:0}}/>:<div style={{width:26,height:26,borderRadius:"50%",background:"rgba(99,102,241,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#818cf8",flexShrink:0}}>{(u.name||"?")[0].toUpperCase()}</div>}
                              <div>
                                <div style={{fontSize:12.5,fontWeight:600,color:S.tx1,display:"flex",alignItems:"center",gap:4}}>{u.name||"Unknown"}{u.role==="admin"&&<Crown size={9} color="#f59e0b"/>}</div>
                                <div style={{fontSize:10.5,color:S.tx3,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{padding:"8px 12px"}}>
                            <select defaultValue={u.plan??"free"} onChange={e=>handleUpdateUser(u.uid,{plan:e.target.value as UserRow["plan"]})}
                              style={{background:"rgba(255,255,255,.05)",border:`1px solid ${S.border}`,borderRadius:6,color:S.tx2,fontSize:11.5,padding:"3px 6px",cursor:"pointer",outline:"none"}}>
                              <option value="free">Free</option><option value="pro">Pro</option><option value="unlimited">Unlimited</option>
                            </select>
                          </td>
                          <td style={{padding:"8px 12px"}}>
                            <select defaultValue={u.status??"active"} onChange={e=>handleUpdateUser(u.uid,{status:e.target.value as UserRow["status"]})}
                              style={{background:"rgba(255,255,255,.05)",border:`1px solid ${S.border}`,borderRadius:6,color:S.tx2,fontSize:11.5,padding:"3px 6px",cursor:"pointer",outline:"none"}}>
                              <option value="active">Active</option><option value="suspended">Suspended</option><option value="banned">Banned</option>
                            </select>
                          </td>
                          <td style={{padding:"8px 12px",fontSize:12.5,color:S.tx2,textAlign:"center"}}>{u.dailyPrompts??0}{u.customDailyLimit!=null&&<span style={{fontSize:10,color:"#818cf8",marginLeft:4}}>/{u.customDailyLimit}</span>}</td>
                          <td style={{padding:"8px 12px",fontSize:12.5,color:S.tx2,textAlign:"center"}}>{u.totalPrompts??0}</td>
                          <td style={{padding:"8px 12px",fontSize:11,color:S.tx3,whiteSpace:"nowrap"}}>{u.createdAt?new Date(u.createdAt).toLocaleDateString():"—"}</td>
                          <td style={{padding:"8px 12px"}}>
                            <div style={{display:"flex",gap:4}}>
                              <button title={u.role==="admin"?"Demote":"Make Admin"} onClick={()=>handleUpdateUser(u.uid,{role:u.role==="admin"?"user":"admin"})} style={{padding:"3px 7px",borderRadius:5,border:`1px solid ${S.border}`,background:"transparent",color:u.role==="admin"?"#f59e0b":S.tx3,cursor:"pointer"}}><Crown size={10}/></button>
                              <button title={u.status==="banned"?"Unban":"Ban"} onClick={()=>handleUpdateUser(u.uid,{status:u.status==="banned"?"active":"banned"})} style={{padding:"3px 7px",borderRadius:5,border:`1px solid ${S.border}`,background:"transparent",color:u.status==="banned"?"#22c55e":"#ef4444",cursor:"pointer"}}>{u.status==="banned"?<UserCheck size={10}/>:<Ban size={10}/>}</button>
                              <button title="User Intelligence" onClick={()=>handleInspectUser(u)} style={{padding:"3px 7px",borderRadius:5,border:`1px solid rgba(99,102,241,.4)`,background:"rgba(99,102,241,.1)",color:"#818cf8",cursor:"pointer"}}><Zap size={10}/></button>
                              <button title="Details / Notes" onClick={()=>{if(expandedUid===u.uid){setExpUid(null);}else{setExpUid(u.uid);setEditNote(u.note||"");setEditCDL(u.customDailyLimit??null);}}} style={{padding:"3px 7px",borderRadius:5,border:`1px solid ${S.border}`,background:expandedUid===u.uid?"rgba(99,102,241,.2)":"transparent",color:"#818cf8",cursor:"pointer"}}>{expandedUid===u.uid?<ChevronUp size={10}/>:<ChevronDown size={10}/>}</button>
                              <button title="Delete User" onClick={()=>handleDelete(u.uid)} style={{padding:"3px 7px",borderRadius:5,border:"1px solid rgba(239,68,68,.3)",background:"transparent",color:"#f87171",cursor:"pointer"}}><Trash2 size={10}/></button>
                            </div>
                          </td>
                        </tr>
                        {expandedUid===u.uid&&(
                          <tr key={u.uid+"-exp"} style={{borderTop:`1px solid ${S.border}`,background:"rgba(99,102,241,.04)"}}>
                            <td colSpan={9} style={{padding:"14px 18px"}}>
                              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:12,alignItems:"flex-end"}}>
                                <div>
                                  <label style={{fontSize:11.5,fontWeight:600,color:S.tx3,display:"block",marginBottom:5}}>📝 Admin Note (private)</label>
                                  <textarea value={editNote} onChange={e=>setEditNote(e.target.value)} rows={2}
                                    style={{width:"100%",background:"rgba(255,255,255,.05)",border:`1px solid ${S.border}`,borderRadius:8,color:S.tx1,fontSize:12.5,padding:"8px 10px",outline:"none",resize:"vertical"}} placeholder="Add notes about this user…"/>
                                </div>
                                <div>
                                  <label style={{fontSize:11.5,fontWeight:600,color:S.tx3,display:"block",marginBottom:5}}>⚡ Custom Daily Limit (overrides plan) <span style={{color:S.tx3,fontWeight:400}}>(-1 = unlimited, empty = use plan default)</span></label>
                                  <input type="number" value={editCDL??""} onChange={e=>setEditCDL(e.target.value?parseInt(e.target.value):null)}
                                    style={{width:"100%",background:"rgba(255,255,255,.05)",border:`1px solid ${S.border}`,borderRadius:8,color:S.tx1,fontSize:13,padding:"8px 10px",outline:"none"}} placeholder="e.g. 50"/>
                                </div>
                                <button onClick={async()=>{await handleUpdateUser(u.uid,{note:editNote,customDailyLimit:editCDL});setExpUid(null);}} style={{padding:"9px 18px",borderRadius:9,background:"#6366f1",color:"#fff",border:"none",fontSize:13,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>Save</button>
                              </div>
                              <div style={{marginTop:10,display:"flex",gap:20,fontSize:11.5,color:S.tx3}}>
                                <span>UID: <code style={{color:S.tx2}}>{u.uid}</code></span>
                                <span>Provider: <code style={{color:S.tx2}}>{u.provider||"google"}</code></span>
                                <span>Last active: <code style={{color:S.tx2}}>{u.lastActiveAt?new Date(u.lastActiveAt).toLocaleString():"—"}</code></span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                    {filtered.length===0&&<tr><td colSpan={9} style={{padding:32,textAlign:"center",color:S.tx3,fontSize:12}}>{dl?"Loading…":"No users found"}</td></tr>}
                  </tbody>
                </table></div>
              </div>
            </div>
          )}

          {/* ══ FEATURES ══ */}
          {tab==="features"&&(
            <div style={{maxWidth:540,display:"flex",flexDirection:"column",gap:10}}>
              <Note type="blue">💡 Changes apply in real-time via Firestore. Click <strong>Save Changes</strong> after toggling.</Note>
              {([
                {key:"splitView",label:"Split View",desc:"Side-by-side original vs engineered prompt"},
                {key:"imageUpload",label:"Image Upload",desc:"Let users attach images to prompts"},
                {key:"history",label:"Prompt History",desc:"Sidebar with saved prompt history"},
                {key:"quickActions",label:"Quick Actions",desc:"Chip buttons above the input box"},
                {key:"templates",label:"Templates",desc:"Starter templates on home screen"},
                {key:"skillsarkSSO",label:"Skillsark SSO",desc:"Skillsark login button on auth page"},
              ] as const).map(f=><Toggle key={f.key} label={f.label} desc={f.desc} checked={cfg.features[f.key]} onChange={v=>setCfg(c=>({...c,features:{...c.features,[f.key]:v}}))}/>)}
            </div>
          )}

          {/* ══ AI CONFIG ══ */}
          {tab==="aiconfig"&&(
            <div style={{maxWidth:560,display:"flex",flexDirection:"column",gap:14}}>
              <Note type="blue">🤖 Controls how the Gemini AI generates prompt suggestions. Click <strong>Save Changes</strong> to apply.</Note>
              {/* Model */}
              <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:S.bdR,padding:"18px 20px"}}>
                <label style={{fontSize:13,fontWeight:700,color:S.tx1,display:"block",marginBottom:10}}>AI Model</label>
                <select value={aiCfg.model} onChange={e=>setAiCfg(c=>({...c,model:e.target.value}))}
                  style={{width:"100%",background:"rgba(255,255,255,.05)",border:`1px solid ${S.border}`,borderRadius:10,color:S.tx1,fontSize:13,padding:"10px 12px",outline:"none",cursor:"pointer"}}>
                  <option value="gemini-2.0-flash">⚡ gemini-2.0-flash (Fastest)</option>
                  <option value="gemini-2.0-flash-lite">🔹 gemini-2.0-flash-lite (Lightest)</option>
                  <option value="gemini-1.5-pro">💎 gemini-1.5-pro (Most Capable)</option>
                  <option value="gemini-1.5-flash">🚀 gemini-1.5-flash (Balanced)</option>
                </select>
              </div>
              {/* Temperature */}
              <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:S.bdR,padding:"18px 20px"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                  <label style={{fontSize:13,fontWeight:700,color:S.tx1}}>Temperature (Creativity)</label>
                  <span style={{fontSize:14,fontWeight:800,color:"#818cf8"}}>{aiCfg.temperature}</span>
                </div>
                <input type="range" min={0} max={1} step={0.05} value={aiCfg.temperature}
                  onChange={e=>setAiCfg(c=>({...c,temperature:parseFloat(e.target.value)}))}
                  style={{width:"100%",accentColor:"#6366f1"}}/>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:S.tx3,marginTop:4}}><span>0 — Precise</span><span>1 — Creative</span></div>
              </div>
              {/* Max tokens */}
              <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:S.bdR,padding:"18px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div><div style={{fontSize:13,fontWeight:700,color:S.tx1,marginBottom:3}}>Max Output Tokens</div><div style={{fontSize:12,color:S.tx3}}>Maximum response length from Gemini</div></div>
                <input type="number" value={aiCfg.maxTokens} onChange={e=>setAiCfg(c=>({...c,maxTokens:parseInt(e.target.value)||8192}))}
                  style={{width:100,background:"rgba(255,255,255,.05)",border:`1px solid ${S.border}`,borderRadius:9,color:S.tx1,fontSize:15,fontWeight:700,padding:"7px 10px",outline:"none",textAlign:"center"}}/>
              </div>
              {/* System prompt prefix */}
              <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:S.bdR,padding:"18px 20px"}}>
                <label style={{fontSize:13,fontWeight:700,color:S.tx1,display:"block",marginBottom:6}}>System Prompt Prefix</label>
                <div style={{fontSize:12,color:S.tx3,marginBottom:10}}>Prepended to every AI request. Use to customize AI behavior globally.</div>
                <textarea value={aiCfg.systemPromptPrefix} onChange={e=>setAiCfg(c=>({...c,systemPromptPrefix:e.target.value}))} rows={4}
                  style={{width:"100%",background:"rgba(255,255,255,.05)",border:`1px solid ${S.border}`,borderRadius:9,color:S.tx1,fontSize:13,padding:"10px 12px",outline:"none",resize:"vertical",fontFamily:"monospace"}}
                  placeholder="e.g. Always respond in a professional tone. Focus on visual content creation."/>
              </div>
            </div>
          )}

          {/* ══ ANNOUNCEMENTS ══ */}
          {tab==="announcements"&&(
            <div style={{maxWidth:560,display:"flex",flexDirection:"column",gap:13}}>
              <Note type="blue">📢 Announcement banner shown to all users at the top of the app. Click <strong>Save Changes</strong> to update.</Note>
              <Toggle label="🟢 Enable Announcement" desc="Show banner to all users" checked={ann.enabled} onChange={v=>setAnn(c=>({...c,enabled:v}))}/>
              {ann.enabled&&(
                <>
                  {/* Preview */}
                  <div style={{padding:"12px 16px",borderRadius:10,background:ann.type==="error"?"rgba(239,68,68,.12)":ann.type==="warning"?"rgba(245,158,11,.12)":ann.type==="success"?"rgba(34,197,94,.12)":"rgba(99,102,241,.12)",border:`1px solid ${ann.type==="error"?"rgba(239,68,68,.25)":ann.type==="warning"?"rgba(245,158,11,.25)":ann.type==="success"?"rgba(34,197,94,.25)":"rgba(99,102,241,.25)"}`}}>
                    <div style={{fontSize:12,fontWeight:700,color:ann.type==="error"?"#f87171":ann.type==="warning"?"#fbbf24":ann.type==="success"?"#4ade80":"#818cf8",marginBottom:4}}>{ann.title||"Announcement Title"}</div>
                    <div style={{fontSize:12.5,color:"var(--tx-2)"}}>{ann.message||"Announcement message will appear here..."}</div>
                  </div>
                  <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:S.bdR,padding:"18px 20px",display:"flex",flexDirection:"column",gap:12}}>
                    <div>
                      <label style={{fontSize:12,fontWeight:600,color:S.tx2,display:"block",marginBottom:5}}>Type</label>
                      <div style={{display:"flex",gap:8}}>
                        {(["info","success","warning","error"] as const).map(t=>(
                          <button key={t} onClick={()=>setAnn(c=>({...c,type:t}))}
                            style={{padding:"5px 12px",borderRadius:7,border:`1px solid ${ann.type===t?"rgba(99,102,241,.5)":S.border}`,background:ann.type===t?"rgba(99,102,241,.15)":"transparent",color:ann.type===t?"#818cf8":S.tx3,fontSize:12,cursor:"pointer",textTransform:"capitalize",fontWeight:ann.type===t?600:400}}>
                            {t==="info"?"ℹ️ Info":t==="success"?"✅ Success":t==="warning"?"⚠️ Warning":"❌ Error"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={{fontSize:12,fontWeight:600,color:S.tx2,display:"block",marginBottom:5}}>Title</label>
                      <input value={ann.title} onChange={e=>setAnn(c=>({...c,title:e.target.value}))}
                        style={{width:"100%",background:"rgba(255,255,255,.05)",border:`1px solid ${S.border}`,borderRadius:9,color:S.tx1,fontSize:13,padding:"9px 12px",outline:"none"}} placeholder="e.g. New Feature Available!"/>
                    </div>
                    <div>
                      <label style={{fontSize:12,fontWeight:600,color:S.tx2,display:"block",marginBottom:5}}>Message</label>
                      <textarea value={ann.message} onChange={e=>setAnn(c=>({...c,message:e.target.value}))} rows={3}
                        style={{width:"100%",background:"rgba(255,255,255,.05)",border:`1px solid ${S.border}`,borderRadius:9,color:S.tx1,fontSize:13,padding:"9px 12px",outline:"none",resize:"vertical"}}
                        placeholder="Enter the announcement message…"/>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══ LIMITS ══ */}
          {tab==="limits"&&(
            <div style={{maxWidth:540,display:"flex",flexDirection:"column",gap:13}}>
              <Note type="yellow">⚠️ Set to <strong>-1</strong> for unlimited. Resets daily. Users can have custom limits from Users tab.</Note>
              {([{key:"free",label:"Free Plan",desc:"New/default users",color:"#64748b"},{key:"pro",label:"Pro Plan",desc:"Upgraded users",color:"#6366f1"},{key:"unlimited",label:"Unlimited Plan",desc:"VIP · Staff · -1 = no limit",color:"#22c55e"}] as const).map(p=>(
                <div key={p.key} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:S.bdR,padding:"18px 20px",borderLeft:`3px solid ${p.color}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div><div style={{fontSize:14,fontWeight:700,color:S.tx1,marginBottom:3}}>{p.label}</div><div style={{fontSize:12,color:S.tx3}}>{p.desc}</div>{cfg.limits[p.key]===-1&&<div style={{fontSize:11.5,color:"#4ade80",marginTop:4}}>✓ Unlimited</div>}</div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <input type="number" value={cfg.limits[p.key]} onChange={e=>setCfg(c=>({...c,limits:{...c.limits,[p.key]:parseInt(e.target.value)||0}}))}
                      style={{width:86,background:"rgba(255,255,255,.05)",border:`1px solid ${S.border}`,borderRadius:10,color:S.tx1,fontSize:17,fontWeight:700,padding:"7px 10px",outline:"none",textAlign:"center"}}/>
                    <span style={{fontSize:12,color:S.tx3}}>/day</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ══ SETTINGS ══ */}
          {tab==="settings"&&(
            <div style={{maxWidth:560,display:"flex",flexDirection:"column",gap:13}}>
              {/* Maintenance */}
              <div style={{background:S.card,border:`1px solid ${cfg.maintenance.enabled?"rgba(239,68,68,.3)":S.border}`,borderRadius:S.bdR,padding:20,borderLeft:`3px solid ${cfg.maintenance.enabled?"#ef4444":"rgba(255,255,255,.08)"}`}}>
                <Toggle label="🔧 Maintenance Mode" desc="Blocks all new logins globally" checked={cfg.maintenance.enabled} onChange={v=>setCfg(c=>({...c,maintenance:{...c.maintenance,enabled:v}}))}/>
                {cfg.maintenance.enabled&&(
                  <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
                    <label style={{fontSize:12,fontWeight:600,color:S.tx2}}>Message shown to users:</label>
                    <textarea value={cfg.maintenance.message} onChange={e=>setCfg(c=>({...c,maintenance:{...c.maintenance,message:e.target.value}}))} rows={3}
                      style={{width:"100%",background:"rgba(255,255,255,.05)",border:`1px solid ${S.border}`,borderRadius:9,color:S.tx1,fontSize:13,padding:"9px 12px",outline:"none",resize:"vertical"}}/>
                    <Note type="red">⚠️ Maintenance Mode is ON — no one can log in. Remember to Save Changes!</Note>
                  </div>
                )}
              </div>
              {/* Contact Info — shown to banned users */}
              <div style={{background:S.card,border:`1px solid rgba(99,102,241,.2)`,borderRadius:S.bdR,padding:20,borderLeft:"3px solid #6366f1"}}>
                <div style={{fontSize:13.5,fontWeight:700,color:S.tx1,marginBottom:4}}>📬 Contact Info for Banned Users</div>
                <div style={{fontSize:12,color:S.tx3,marginBottom:14}}>Shown when a user's account is blocked. Lets them contact you directly.</div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:S.tx2,display:"block",marginBottom:5}}>Contact Email</label>
                    <input value={contact.email} onChange={e=>setContact(c=>({...c,email:e.target.value}))}
                      style={{width:"100%",background:"rgba(255,255,255,.05)",border:`1px solid ${S.border}`,borderRadius:9,color:S.tx1,fontSize:13,padding:"9px 12px",outline:"none"}}
                      placeholder="your@email.com"/>
                  </div>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:S.tx2,display:"block",marginBottom:5}}>Message to Banned Users</label>
                    <textarea value={contact.message} onChange={e=>setContact(c=>({...c,message:e.target.value}))} rows={2}
                      style={{width:"100%",background:"rgba(255,255,255,.05)",border:`1px solid ${S.border}`,borderRadius:9,color:S.tx1,fontSize:13,padding:"9px 12px",outline:"none",resize:"vertical"}}
                      placeholder="e.g. Your account was banned for violating our terms. Email us to appeal."/>
                  </div>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:S.tx2,display:"block",marginBottom:5}}>Support URL <span style={{fontWeight:400,color:S.tx3}}>(optional)</span></label>
                    <input value={contact.supportUrl} onChange={e=>setContact(c=>({...c,supportUrl:e.target.value}))}
                      style={{width:"100%",background:"rgba(255,255,255,.05)",border:`1px solid ${S.border}`,borderRadius:9,color:S.tx1,fontSize:13,padding:"9px 12px",outline:"none"}}
                      placeholder="https://yoursite.com/support"/>
                  </div>
                </div>
              </div>
              {/* Admin protection notice */}
              <div style={{background:"rgba(245,158,11,.07)",border:"1px solid rgba(245,158,11,.2)",borderRadius:S.bdR,padding:"14px 16px",display:"flex",alignItems:"flex-start",gap:10}}>
                <span style={{fontSize:18,flexShrink:0}}>🛡️</span>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:"#fbbf24",marginBottom:4}}>Protected Admin Account</div>
                  <div style={{fontSize:12.5,color:S.tx2,lineHeight:1.6}}><strong style={{color:"#fbbf24"}}>{ADMIN_EMAIL}</strong> cannot be banned, suspended, or deleted — even by accident. This protection is hardcoded on the server.</div>
                </div>
              </div>
              {/* Danger zone */}
              <div style={{background:S.card,border:"1px solid rgba(239,68,68,.2)",borderRadius:S.bdR,padding:20}}>
                <div style={{fontSize:13,fontWeight:700,color:"#f87171",marginBottom:6}}>⚠️ Danger Zone</div>
                <div style={{fontSize:12.5,color:S.tx3,marginBottom:12}}>These actions affect all users immediately and cannot be undone.</div>
                <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
                  <button onClick={async()=>{if(!confirm("Reset ALL daily prompt counters?"))return;try{await ap({action:"resetDailyAll"});setUsers(u=>u.map(x=>({...x,dailyPrompts:0})));st("✅ Daily counters reset!");}catch(e){st("❌ "+(e instanceof Error?e.message:e));}}}
                    style={{padding:"8px 16px",borderRadius:9,border:"1px solid rgba(239,68,68,.3)",background:"rgba(239,68,68,.08)",color:"#f87171",fontSize:12.5,fontWeight:600,cursor:"pointer"}}>
                    🔄 Reset All Daily Counters
                  </button>
                </div>
              </div>
              {/* App info */}
              <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:S.bdR,padding:"16px 20px"}}>
                <div style={{fontSize:11.5,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:S.tx3,marginBottom:12}}>App Info</div>
                {[["Firebase Project","ai-prmpt-master"],["Admin Email",ADMIN_EMAIL],["Total Users",totalU],["Total Prompts",totalP],["Maintenance",cfg.maintenance.enabled?"🔴 ON":"🟢 OFF"]].map(([k,v])=>(
                  <div key={String(k)} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${S.border}`}}>
                    <span style={{fontSize:13,color:S.tx3}}>{k}</span>
                    <span style={{fontSize:13,color:S.tx1,fontWeight:500}}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ AI ANALYST ══ */}
          {tab==="analyst"&&(
            <div style={{maxWidth:660,display:"flex",flexDirection:"column",gap:14}}>
              <div style={{background:"linear-gradient(135deg,rgba(99,102,241,.12),rgba(139,92,246,.08))",border:"1px solid rgba(99,102,241,.25)",borderRadius:S.bdR,padding:"20px 22px",display:"flex",alignItems:"flex-start",gap:14}}>
                <div style={{width:44,height:44,borderRadius:12,background:"rgba(99,102,241,.2)",border:"1px solid rgba(99,102,241,.35)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Zap size={20} color="#818cf8"/></div>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:S.tx1,marginBottom:5}}>🤖 Gemini AI Analyst</div>
                  <div style={{fontSize:13,color:S.tx2,lineHeight:1.65}}>Uses your Gemini API to analyze real user behavior and generate actionable improvement suggestions. Your data never leaves your servers.</div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                {[[`${totalU}`,"Total Users","#818cf8"],[`${totalP}`,"Total Prompts","#4ade80"],[`${users.filter(u=>u.status==="active").length}`,"Active Users","#fbbf24"]].map(([v,l,c])=>(
                  <div key={l} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:12,padding:"14px 16px",textAlign:"center"}}>
                    <div style={{fontSize:22,fontWeight:800,color:c,letterSpacing:"-.03em"}}>{v}</div>
                    <div style={{fontSize:11.5,color:S.tx3,marginTop:3}}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:S.bdR,padding:20}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div>
                    <div style={{fontSize:13.5,fontWeight:700,color:S.tx1}}>📊 Auto Insights</div>
                    <div style={{fontSize:12,color:S.tx3,marginTop:3}}>{analystTime?`Last generated: ${new Date(analystTime).toLocaleTimeString()}`:"Not generated yet — click to analyze"}</div>
                  </div>
                  <button disabled={analystLoading} onClick={async()=>{setAnalystLoading(true);try{const r=await fetch("/api/ai-analyst",{method:"POST",headers:{"Content-Type":"application/json","x-admin-key":ADMIN_KEY},body:JSON.stringify({})});const d=await r.json();if(d.error)throw new Error(d.error);setAnalystInsights(d.insights);setAnalystCache(d.data||null);setAnalystTime(d.generatedAt||Date.now());}catch(e){st("❌ "+(e instanceof Error?e.message:e));}finally{setAnalystLoading(false);}}}
                    style={{display:"flex",alignItems:"center",gap:6,padding:"8px 16px",borderRadius:9,border:"none",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",fontSize:12.5,fontWeight:700,cursor:"pointer",opacity:analystLoading?.7:1,flexShrink:0}}>
                    {analystLoading?<><span style={{width:12,height:12,borderRadius:"50%",border:"2px solid rgba(255,255,255,.4)",borderTopColor:"#fff",animation:"spin 1s linear infinite",display:"inline-block"}}/> Analyzing…</>:<><Zap size={12}/> Generate Insights</>}
                  </button>
                </div>
                {analystInsights?(
                  <div style={{background:"rgba(99,102,241,.06)",border:"1px solid rgba(99,102,241,.18)",borderRadius:12,padding:"16px 18px"}}>
                    {analystInsights.split("\n").filter(Boolean).map((line,i,arr)=>(
                      <div key={i} style={{fontSize:13.5,color:S.tx1,lineHeight:1.7,padding:"5px 0",borderBottom:i<arr.length-1?`1px solid ${S.border}`:"none"}}>{line}</div>
                    ))}
                  </div>
                ):(
                  <div style={{textAlign:"center",padding:"28px 0",color:S.tx3,fontSize:13}}><div style={{fontSize:32,marginBottom:10}}>🔍</div>Click "Generate Insights" to let Gemini analyze your users</div>
                )}
              </div>
              <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:S.bdR,padding:20}}>
                <div style={{fontSize:13.5,fontWeight:700,color:S.tx1,marginBottom:5}}>💬 Ask AI About Your Users</div>
                <div style={{fontSize:12,color:S.tx3,marginBottom:13}}>Ask any question — Gemini will answer based on your real user data.</div>
                <div style={{display:"flex",gap:9}}>
                  <input value={analystQ} onChange={e=>setAnalystQ(e.target.value)}
                    onKeyDown={async e=>{if(e.key!=="Enter"||!analystQ.trim()||analystLoading)return;setAnalystLoading(true);try{const r=await fetch("/api/ai-analyst",{method:"POST",headers:{"Content-Type":"application/json","x-admin-key":ADMIN_KEY},body:JSON.stringify({question:analystQ,userData:analystCache})});const d=await r.json();if(d.error)throw new Error(d.error);setAnalystInsights(`Q: ${analystQ}\n\n${d.insights}`);setAnalystQ("");}catch(ex){st("❌ "+(ex instanceof Error?ex.message:ex));}finally{setAnalystLoading(false);}}}
                    placeholder='e.g. "Which specialist is most popular?" · Press Enter'
                    style={{flex:1,background:"rgba(255,255,255,.05)",border:`1px solid ${S.border}`,borderRadius:10,color:S.tx1,fontSize:13,padding:"9px 13px",outline:"none"}}/>
                  <button onClick={async()=>{if(!analystQ.trim()||analystLoading)return;setAnalystLoading(true);try{const r=await fetch("/api/ai-analyst",{method:"POST",headers:{"Content-Type":"application/json","x-admin-key":ADMIN_KEY},body:JSON.stringify({question:analystQ,userData:analystCache})});const d=await r.json();if(d.error)throw new Error(d.error);setAnalystInsights(`Q: ${analystQ}\n\n${d.insights}`);setAnalystQ("");}catch(ex){st("❌ "+(ex instanceof Error?ex.message:ex));}finally{setAnalystLoading(false);}}}
                    disabled={!analystQ.trim()||analystLoading}
                    style={{padding:"9px 16px",borderRadius:10,border:"none",background:"rgba(99,102,241,.2)",color:"#818cf8",fontSize:12.5,fontWeight:600,cursor:"pointer",flexShrink:0}}>Ask →</button>
                </div>
                <div style={{marginTop:10,display:"flex",gap:7,flexWrap:"wrap"}}>
                  {["What are users struggling with?","Who are my power users?","Should I add a Pro trial?","What features are unused?"].map(q=>(
                    <button key={q} onClick={()=>setAnalystQ(q)} style={{fontSize:11.5,padding:"3px 10px",borderRadius:20,border:`1px solid ${S.border}`,background:"rgba(255,255,255,.03)",color:S.tx3,cursor:"pointer"}}>{q}</button>
                  ))}
                </div>
              </div>
              <div style={{fontSize:11.5,color:S.tx3,textAlign:"center"}}>🔒 Only anonymized stats sent to Gemini — no emails or user IDs shared.</div>
            </div>
          )}

          {/* ── ERROR MONITOR ── */}
          {tab==="errors" && (
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              {/* Header row */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:S.tx1}}>🔴 User Error Monitor</div>
                  <div style={{fontSize:12,color:S.tx3,marginTop:3}}>Every error any user hits is automatically logged here in real-time.</div>
                </div>
                <button onClick={loadErrors} disabled={errLogsLoading} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:9,border:`1px solid ${S.border}`,background:"rgba(255,255,255,.04)",color:S.tx2,fontSize:12.5,cursor:"pointer"}}>
                  <RefreshCw size={12} style={{animation:errLogsLoading?"spin 1s linear infinite":undefined}}/> {errLogsLoading?"Loading…":"Refresh"}
                </button>
              </div>

              {/* Stats Summary */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12}}>
                {[
                  {label:"Total Errors",val:errorLogs.length,color:"#f87171"},
                  {label:"Unresolved",val:errorLogs.filter(e=>!e.resolved).length,color:"#fbbf24"},
                  {label:"Quota / Limits",val:errorLogs.filter(e=>e.errorType==="quota_exhausted"||e.errorType==="rate_limit").length,color:"#f59e0b"},
                  {label:"API Failures",val:errorLogs.filter(e=>e.errorType==="api_error"||e.errorType==="invalid_key").length,color:"#a78bfa"},
                  {label:"UI / Crashes",val:errorLogs.filter(e=>e.errorType==="frontend_crash"||e.errorType==="unhandled_rejection").length,color:"#38bdf8"},
                  {label:"Last 24h",val:errorLogs.filter(e=>e.timestamp > Date.now() - 86400000).length,color:"#4ade80"},
                ].map(({label,val,color})=>(
                  <div key={label} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:12,padding:"14px 16px"}}>
                    <div style={{fontSize:10.5,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:S.tx3,marginBottom:6}}>{label}</div>
                    <div style={{fontSize:26,fontWeight:800,color}}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Filters */}
              <div style={{display:"flex",gap:12,alignItems:"center",paddingBottom:4,flexWrap:"wrap"}}>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:12,color:S.tx3,flexShrink:0}}>Filter:</span>
                  {(["all", "today", "7d", "unresolved", "quota", "api", "frontend"] as const).map(f=>(
                    <button key={f} onClick={()=>setErrFilter(f)} style={{fontSize:11.5,padding:"4px 10px",borderRadius:6,border:errFilter===f?`1px solid #6366f1`:`1px solid ${S.border}`,background:errFilter===f?"rgba(99,102,241,.15)":"transparent",color:errFilter===f?"#a5b4fc":S.tx3,cursor:"pointer",textTransform:"capitalize"}}>
                      {f}
                    </button>
                  ))}
                </div>
                <div style={{flex:1,minWidth:250,position:"relative"}}>
                  <Search size={12} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:S.tx3}}/>
                  <input value={errSearch} onChange={e=>setErrSearch(e.target.value)} placeholder="Search by User UID or Email…"
                    style={{width:"100%",background:"rgba(255,255,255,.04)",border:`1px solid ${S.border}`,borderRadius:10,color:S.tx1,fontSize:12.5,padding:"8px 12px 8px 30px",outline:"none"}}/>
                </div>
              </div>

              {/* Error Log Table */}
              <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:S.bdR,overflow:"hidden"}}>
                <div style={{padding:"12px 16px",borderBottom:`1px solid ${S.border}`,display:"flex",alignItems:"center",gap:8}}>
                  <AlertCircle size={13} color="#f87171"/>
                  <span style={{fontSize:13,fontWeight:600,color:S.tx1}}>Recent Errors</span>
                  <span style={{fontSize:11,color:S.tx3,marginLeft:"auto"}}>Most recent first · auto-logged from all users</span>
                </div>

                {errLogsLoading ? (
                  <div style={{padding:"32px",textAlign:"center",color:S.tx3,fontSize:13}}>⏳ Loading errors…</div>
                ) : errorLogs.length === 0 ? (
                  <div style={{padding:"40px",textAlign:"center"}}>
                    <div style={{fontSize:36,marginBottom:10}}>✅</div>
                    <div style={{fontSize:14,fontWeight:600,color:S.tx1,marginBottom:6}}>No errors logged</div>
                    <div style={{fontSize:12.5,color:S.tx3}}>Click Refresh to load — errors appear here automatically when users hit issues.</div>
                  </div>
                ) : (
                  <div style={{overflowY:"auto",maxHeight:520}}>
                    {errorLogs.filter(e => {
                      // Apply search filter
                      if (errSearch) {
                        const searchArr = errSearch.toLowerCase();
                        const matches = e.uid?.toLowerCase().includes(searchArr) || e.email?.toLowerCase().includes(searchArr) || e.errorMessage?.toLowerCase().includes(searchArr);
                        if (!matches) return false;
                      }
                      
                      if(errFilter==="unresolved") return !e.resolved;
                      if(errFilter==="quota") return e.errorType.includes("quota")||e.errorType.includes("limit");
                      if(errFilter==="frontend") return e.errorType.includes("frontend")||e.errorType.includes("unhandled")||e.errorType.includes("boundary");
                      if(errFilter==="api") return e.errorType==="api_error" || e.errorType==="invalid_key" || e.errorType==="timeout";
                      if(errFilter==="today") return new Date(e.timestamp).toISOString().slice(0,10) === new Date().toISOString().slice(0,10);
                      if(errFilter==="7d") return e.timestamp > Date.now() - 7*86400000;
                      return true;
                    }).map((e,idx,arr)=>{
                      const typeColor = e.errorType.includes("quota")||e.errorType.includes("limit")?"#f59e0b":e.errorType==="invalid_key"?"#a78bfa":e.errorType.includes("frontend")||e.errorType.includes("rejection")?"#38bdf8":"#f87171";
                      const typeBg   = e.errorType.includes("quota")||e.errorType.includes("limit")?"rgba(245,158,11,.1)":e.errorType==="invalid_key"?"rgba(167,139,250,.1)":e.errorType.includes("frontend")||e.errorType.includes("rejection")?"rgba(56,189,248,.1)":"rgba(239,68,68,.1)";
                      const typeLabel= e.errorType.replace(/_/g, " ");
                      const sevColor = e.severity==="Critical"?"#ef4444":e.severity==="High"?"#f97316":e.severity==="Low"?"#10b981":"#fbbf24";
                      const isExpanded = expandedErr === e.id;
                      return (
                        <div key={e.id} style={{borderBottom:idx<arr.length-1?`1px solid ${S.border}`:"none",background:e.resolved?"rgba(34,197,94,.03)":"transparent",opacity:e.resolved?.6:1}}>
                          <div onClick={() => setExpandedErr(isExpanded ? null : e.id)} style={{cursor:"pointer",padding:"13px 16px",display:"flex",flexDirection:"column",gap:6}}>
                            <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                              {/* Severity Badge */}
                              <span style={{width:8,height:8,borderRadius:"50%",background:sevColor,boxShadow:`0 0 8px ${sevColor}66`}} title={`Severity: ${e.severity||"Unknown"}`}/>
                              {/* Type badge */}
                              <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:6,background:typeBg,color:typeColor,textTransform:"uppercase",letterSpacing:".04em"}}>{typeLabel}</span>
                              {/* Route */}
                              {e.route&&<span style={{fontSize:11,color:S.tx2,background:"rgba(255,255,255,.05)",padding:"1px 6px",borderRadius:4}}>{e.route}</span>}
                              {/* User Info */}
                              <span 
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  setTab("users");
                                  setSrch(e.email !== "unknown" && e.email !== "see uid" ? e.email : e.uid);
                                }}
                                style={{
                                  fontSize: 12, color: "#fff", display: "flex", alignItems: "center", gap: 6,
                                  background: "rgba(255,255,255,.08)", padding: "4px 10px", borderRadius: 8, 
                                  cursor: "pointer", border: "1px solid rgba(255,255,255,.1)", fontWeight: 500
                                }}
                                title="Click to view user profile"
                              >
                                <User size={12} color="#a5b4fc" />
                                {(() => {
                                  const u = users.find(u => u.uid === e.uid);
                                  const hasEmail = e.email && e.email !== "unknown" && e.email !== "see uid";
                                  if (u) return `${u.name || "User"} (${u.email})`;
                                  if (hasEmail) return e.email;
                                  return (e.uid === "anonymous" || !e.uid) ? "Anonymous" : `ID: ${e.uid.slice(0, 8)}`;
                                })()}
                              </span>
                              {/* Resolved */}
                              {e.resolved&&<span style={{fontSize:10.5,color:"#4ade80",background:"rgba(34,197,94,.1)",padding:"1px 7px",borderRadius:10}}>✓ Resolved</span>}
                              {/* Time */}
                              <span style={{fontSize:11,color:S.tx3,marginLeft:"auto"}}>{new Date(e.timestamp).toLocaleString()}</span>
                              {/* Resolve button */}
                              {!e.resolved&&<button
                                onClick={async(ev)=>{ev.stopPropagation();try{await ap({action:"resolveError",errorId:e.id});setErrorLogs(p=>p.map(x=>x.id===e.id?{...x,resolved:true}:x));st("✅ Marked resolved");}catch{st("❌ Failed");}}}
                                style={{fontSize:10.5,padding:"2px 9px",borderRadius:6,border:"1px solid rgba(34,197,94,.3)",background:"rgba(34,197,94,.08)",color:"#4ade80",cursor:"pointer"}}
                              ><CheckCircle size={9}/> Resolve</button>}
                            </div>
                            <div style={{fontSize:13,color:S.tx1,fontWeight:500,fontFamily:"JetBrains Mono, monospace"}}>{e.errorMessage}</div>
                          </div>
                          
                          {/* Expanded Details */}
                          {isExpanded && (
                            <div style={{padding:"0 16px 16px",marginTop:"-4px",display:"flex",flexDirection:"column",gap:8}}>
                              {e.userAction && <div style={{fontSize:11.5,color:S.tx2}}><strong>Action triggered:</strong> {e.userAction}</div>}
                              {(e.specialist || e.modelUsed) && (
                                <div style={{fontSize:11.5,color:S.tx2,display:"flex",gap:16}}>
                                  {e.specialist && <span><strong>Specialist:</strong> {e.specialist}</span>}
                                  {e.modelUsed && <span><strong>Model:</strong> {e.modelUsed}</span>}
                                </div>
                              )}
                              {e.stack && (
                                <div>
                                  <div style={{fontSize:11,fontWeight:700,color:S.tx3,marginBottom:4}}>STACK TRACE</div>
                                  <div style={{background:"rgba(0,0,0,.4)",padding:10,borderRadius:8,fontSize:11,color:"#ef4444",fontFamily:"JetBrains Mono, monospace",whiteSpace:"pre-wrap",overflowX:"auto"}}>{e.stack}</div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div style={{fontSize:11.5,color:S.tx3,textAlign:"center"}}>💡 Errors auto-log from every API call. Refresh to see latest.</div>
            </div>
          )}
        </div>
      </main>

      {/* ── User Intelligence Overlay ── */}
      {inspectedUser && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.85)", backdropFilter:"blur(12px)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ width:"100%", maxWidth:1000, height:"90vh", background:"#0f0f13", border:`1px solid ${S.border}`, borderRadius:24, display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:"0 32px 64px rgba(0,0,0,.5)" }}>
            
            {/* Modal Header */}
            <div style={{ padding:"20px 24px", background:"rgba(255,255,255,.02)", borderBottom:`1px solid ${S.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                <div style={{ width:44, height:44, borderRadius:12, background:"rgba(99,102,241,.1)", border:"1px solid rgba(99,102,241,.3)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Users size={20} color="#818cf8" />
                </div>
                <div>
                  <div style={{ fontSize:18, fontWeight:700, color:"#fff" }}>{inspectedUser.name || "Unknown User"}</div>
                  <div style={{ fontSize:13, color:S.tx3 }}>Intelligence & Behavior Analysis</div>
                </div>
              </div>
              <button onClick={()=>setInspectedUser(null)} style={{ width:32, height:32, borderRadius:8, background:"rgba(255,255,255,.05)", border:"none", color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
            </div>

            {/* Modal Tabs */}
            <div style={{ padding:"0 24px", background:"rgba(255,255,255,.01)", borderBottom:`1px solid ${S.border}`, display:"flex", gap:24 }}>
              <button onClick={()=>setInspectTab("intel")} style={{ padding:"14px 0", fontSize:13, fontWeight:600, color:inspectTab==="intel"?"#818cf8":S.tx3, borderBottom:inspectTab==="intel"?"2px solid #818cf8":"2px solid transparent", background:"none", cursor:"pointer" }}>📊 Profile Intelligence</button>
              <button onClick={()=>setInspectTab("history")} style={{ padding:"14px 0", fontSize:13, fontWeight:600, color:inspectTab==="history"?"#818cf8":S.tx3, borderBottom:inspectTab==="history"?"2px solid #818cf8":"2px solid transparent", background:"none", cursor:"pointer" }}>📜 Full History Browser ({inspectedHistory.length})</button>
            </div>

            {/* Modal Content */}
            <div style={{ flex:1, overflowY:"auto", padding:24 }}>
              {inspectLoading ? (
                <div style={{ height:"100%", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12 }}>
                  <RefreshCw size={24} color="#818cf8" className="animate-spin" />
                  <div style={{ fontSize:13, color:S.tx3 }}>Fetching deep user data...</div>
                </div>
              ) : (
                <>
                  {inspectTab === "intel" ? (
                    <div style={{ display:"grid", gridTemplateColumns:"320px 1fr", gap:24 }}>
                      {/* Left: Stats Card */}
                      <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
                        <div style={{ padding:20, background:"rgba(255,255,255,.03)", border:`1px solid ${S.border}`, borderRadius:16 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:S.tx3, textTransform:"uppercase", letterSpacing:".05em", marginBottom:16 }}>Basic Info</div>
                          <StatRow label="Email" value={inspectedUser.email} />
                          <StatRow label="Plan" value={inspectedUser.plan} />
                          <StatRow label="Total Prompts" value={inspectedUser.totalPrompts || 0} />
                          <StatRow label="Joined" value={new Date(inspectedUser.createdAt || 0).toLocaleDateString()} />
                          <StatRow label="Last Active" value={new Date(inspectedUser.lastActiveAt || 0).toLocaleDateString()} />
                        </div>

                        <div style={{ padding:20, background:"rgba(255,255,255,.03)", border:`1px solid ${S.border}`, borderRadius:16 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:S.tx3, textTransform:"uppercase", letterSpacing:".05em", marginBottom:16 }}>Risk Signals</div>
                          {inspectedHistory.length > 50 ? (
                            <div style={{ color:"#f87171", fontSize:13, display:"flex", gap:8 }}><AlertTriangle size={14}/> High Prompt Volume</div>
                          ) : (
                            <div style={{ color:"#4ade80", fontSize:13, display:"flex", gap:8 }}><CheckCircle size={14}/> Low Risk Profile</div>
                          )}
                        </div>
                      </div>

                      {/* Right: Charts & Analysis */}
                      <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
                          <div style={{ padding:20, background:"rgba(99,102,241,.05)", border:"1px solid rgba(99,102,241,.2)", borderRadius:16 }}>
                            <div style={{ fontSize:12, fontWeight:700, color:"#a5b4fc", marginBottom:12 }}>USAGE BREAKDOWN</div>
                            {(() => {
                              const catCounts: any = { code:0, image:0, business:0, creative:0, general:0 };
                              inspectedHistory.forEach(h => catCounts[h.category as string] = (catCounts[h.category as string] || 0) + 1);
                              const total = Math.max(inspectedHistory.length, 1);
                              return (
                                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                                  {Object.keys(catCounts).map(cat => (
                                    <div key={cat} style={{ display:"flex", alignItems:"center", gap:8 }}>
                                      <div style={{ width:60, fontSize:11, color:S.tx3, textTransform:"capitalize" }}>{cat}</div>
                                      <div style={{ flex:1, height:6, background:"rgba(255,255,255,.05)", borderRadius:3, overflow:"hidden" }}>
                                        <div style={{ width:`${Math.round((catCounts[cat]/total)*100)}%`, height:"100%", background:"#818cf8" }} />
                                      </div>
                                      <div style={{ width:30, fontSize:11, color:S.tx2, textAlign:"right" }}>{Math.round((catCounts[cat]/total)*100)}%</div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                          <div style={{ padding:20, background:"rgba(255,255,255,.03)", border:`1px solid ${S.border}`, borderRadius:16 }}>
                            <div style={{ fontSize:12, fontWeight:700, color:S.tx3, marginBottom:12 }}>BEHAVIOR INTELLIGENCE</div>
                            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                              <div>
                                <div style={{ fontSize:11, color:S.tx3 }}>User Level</div>
                                <div style={{ fontSize:15, fontWeight:700, color:"#fff" }}>{inspectedHistory.length > 50 ? "Advanced " : inspectedHistory.length > 10 ? "Intermediate" : "Beginner"} User</div>
                              </div>
                              <div>
                                <div style={{ fontSize:11, color:S.tx3 }}>Avg. Prompt Complexity</div>
                                <div style={{ fontSize:15, fontWeight:700, color:"#fff" }}>{Math.round(inspectedHistory.reduce((s,h)=>(s+(h.originalIdea?.length||0)),0)/Math.max(inspectedHistory.length,1))} chars</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div style={{ padding:20, background:"rgba(255,255,255,.03)", border:`1px solid ${S.border}`, borderRadius:16 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:S.tx3, marginBottom:16 }}>INTELLIGENCE SUMMARY</div>
                          <p style={{ fontSize:14, color:S.tx2, lineHeight:1.6 }}>
                            Based on {inspectedHistory.length} interactions, this user primarily focuses on <strong>{Object.entries(inspectedHistory.reduce((acc:any,h)=>({ ...acc, [h.category]: (acc[h.category]||0)+1 }),{})).sort((a,b)=>b[1]-a[1])[0]?.[0] || "general"}</strong> topics. 
                            Their activity suggests a <strong>{inspectedHistory.length > 30 ? "high engagement" : "sporadic"}</strong> usage pattern. 
                            No immediate risk factors detected in prompt telemetry.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                      {inspectedHistory.length === 0 ? (
                        <div style={{ padding:40, textAlign:"center", color:S.tx3 }}>No history items to display.</div>
                      ) : (
                        inspectedHistory.map((h, i) => (
                          <div key={h.id || i} style={{ padding:16, background:"rgba(255,255,255,.02)", border:`1px solid ${S.border}`, borderRadius:12 }}>
                            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                                <span style={{ fontSize:11, fontWeight:700, background:"rgba(99,102,241,.1)", color:"#818cf8", padding:"2px 8px", borderRadius:6, textTransform:"uppercase" }}>{h.category}</span>
                                <span style={{ fontSize:12, color:S.tx3 }}>{new Date(h.timestamp).toLocaleString()}</span>
                              </div>
                              <code style={{ fontSize:11, color:S.tx3 }}>{h.id?.slice(0,8)}</code>
                            </div>
                            <div style={{ fontSize:14, color:"#fff", fontWeight:600, marginBottom:8 }}>Q: {h.originalIdea}</div>
                            <div style={{ fontSize:13, color:S.tx2, background:"rgba(0,0,0,.2)", padding:12, borderRadius:8, fontFamily:"monospace", border:`1px solid ${S.border}` }}>
                              {h.engineeredPrompt?.slice(0, 400)}{h.engineeredPrompt?.length > 400 && "..."}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {toast&&<div style={{position:"fixed",bottom:24,right:24,zIndex:9999,padding:"10px 18px",borderRadius:10,background:"rgba(18,18,24,.97)",border:`1px solid ${S.border}`,fontSize:13,color:S.tx1,fontWeight:500,boxShadow:"0 8px 32px rgba(0,0,0,.6)",backdropFilter:"blur(12px)"}}>{toast}</div>}
    </div>
  );
}

function StatRow({ label, value }: { label:string; value:any }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,.03)" }}>
      <span style={{ color:S.tx3 }}>{label}</span>
      <span style={{ color:"#fff", fontWeight:600 }}>{value}</span>
    </div>
  );
}
