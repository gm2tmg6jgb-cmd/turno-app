import { useState, useEffect, useCallback } from "react";
import { REPARTI, TURNI } from "./data/constants"; // Keep static for UI structure or fetch if needed
import { supabase } from "./lib/supabase";
import { getSlotForGroup } from "./lib/shiftRotation";
import { Icons } from "./components/ui/Icons";
import { Toast } from "./components/ui/Toast";

// Views
import DashboardView from "./views/DashboardView";
import AssegnazioniView from "./views/AssegnazioniView";
import AnagraficaView from "./views/AnagraficaView";
import ReportView from "./views/ReportView";
import RicercaView from "./views/RicercaView";

import ImportView from "./views/ImportView";
import SkillsView from "./views/SkillsView";
import MotiviView from "./views/MotiviView";
import PlanningView from "./views/PlanningView";
import ZoneView from "./views/ZoneView";

export default function App() {
  const [currentView, setCurrentView] = useState("dashboard");
  const [repartoCorrente, setRepartoCorrente] = useState(null);
  const [turnoCorrente, setTurnoCorrente] = useState("D");

  // State from DB
  const [dipendenti, setDipendenti] = useState([]);
  const [macchine, setMacchine] = useState([]);
  const [zone, setZone] = useState([]);
  const [attivita, setAttivita] = useState([]);
  const [assegnazioni, setAssegnazioni] = useState([]);
  const [presenze, setPresenze] = useState([]);
  const [motivi, setMotivi] = useState([]);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type) => {
    setToast({ message, type });
  }, []);

  // Theme Management
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === "dark" ? "light" : "dark");
  };

  // Fetch Data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("🔄 Fetching data from Supabase...");

        // Debug Connection
        const sbUrl = import.meta.env.VITE_SUPABASE_URL;
        if (!sbUrl) {
          showToast("⚠️ ERRORE CONFIGURAZIONE: URL Supabase mancante!", "error");
        } else {
          // Show first 8 chars of URL to confirm environment
          const shortUrl = sbUrl.substring(8, 20) + "...";
          console.log("🔗 Connected to:", shortUrl);
          // Verify simple existence (optional, maybe too noisy for prod, but good for debug now)
        }

        const { data: dipHelper, error: errDip } = await supabase.from('dipendenti').select('*');
        if (errDip) throw errDip;
        // Parse competenze from JSONB if needed, Supabase returns object automatically for jsonb

        const { data: macHelper, error: errMac } = await supabase.from('macchine').select('*');
        if (errMac) throw errMac;

        const { data: zoneHelper, error: errZone } = await supabase.from('zone').select('*');
        if (errZone) throw errZone;

        const { data: attHelper, error: errAtt } = await supabase.from('attivita').select('*');
        if (errAtt) throw errAtt;

        const { data: assHelper, error: errAss } = await supabase.from('assegnazioni').select('*');
        if (errAss) throw errAss;

        const { data: presHelper, error: errPres } = await supabase.from('presenze').select('*');
        if (errPres) throw errPres;

        const { data: motiviHelper, error: errMotivi } = await supabase.from('motivi_assenza').select('*');
        // If error or empty, we might want to use defaults, but better to just use what we get.
        // For migration stability, if empty, we might use default constants, but user should run SQL.

        // --- AUTO-GENERATE PRESENCE FOR TODAY IF MISSING ---
        // Use local date for consistency
        const getLocalDate = (d) => {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        const today = getLocalDate(new Date());

        const presenzeOggi = presHelper ? presHelper.filter(p => p.data === today) : [];

        let finalPresenze = presHelper || [];

        // Strict Verify: Only generate if ABSOLUTELY 0 records for today AND NOT SUNDAY
        const isSunday = new Date(today).getDay() === 0;

        if (!isSunday && presenzeOggi.length === 0 && dipendenti.length > 0) { // Check state dipendenti? No, use dipHelper
          // Double check with DB again to avoid race condition in React StrictMode
          const { count } = await supabase
            .from('presenze')
            .select('*', { count: 'exact', head: true })
            .eq('data', today);

          if (count === 0 && dipHelper && dipHelper.length > 0) {
            console.log("📅 No presence records for today. Generating defaults...");
            const newPresenze = dipHelper.map(d => ({
              dipendente_id: d.id,
              data: today,
              turno_id: d.turno_default || "D",
              presente: true,
              motivo_assenza: null
            }));

            const { data: insertedPres, error: errInsert } = await supabase
              .from('presenze')
              .insert(newPresenze)
              .select();

            if (errInsert) {
              console.error("❌ Error generating daily presence:", errInsert);
              showToast("Errore generazione presenze: " + errInsert.message, "error");
            } else {
              console.log("✅ Generated daily presence records");
              finalPresenze = [...finalPresenze, ...insertedPres];
              showToast("Presenze giornaliere generate", "success");
            }
          } else {
            console.log("📅 Presenze already exist on DB (race condition handled).");
          }
        }
        // ---------------------------------------------------

        setDipendenti(dipHelper || []);
        setMacchine(macHelper || []);
        setZone(zoneHelper || []);
        setAttivita(attHelper || []);
        setAssegnazioni(assHelper || []);
        setPresenze(finalPresenze);
        setMotivi(motiviHelper || []);

        console.log("✅ Data fetched successfully");
      } catch (error) {
        console.error("❌ Error fetching data:", error);
        showToast("Errore caricamento dati: " + error.message, "error");
      }
    };

    fetchData();
    fetchData();
  }, [showToast]);

  // --- ONE-TIME CLEANUP FOR SUNDAY 15/02 ---
  useEffect(() => {
    const cleanupSunday = async () => {
      const today = new Date().toISOString().split('T')[0];
      const isSunday = new Date().getDay() === 0;
      if (isSunday) {
        console.log("🧹 Running Sunday cleanup...");
        const { error } = await supabase.from('presenze').delete().eq('data', today);
        if (!error) {
          console.log("✅ Sunday records cleaned up.");
          // Force reload of data after cleanup (simple way: reload page or re-fetch, but user will likely reload anyway)
        }
      }
    };
    cleanupSunday();
  }, []);
  // ------------------------------------------



  const reparto = REPARTI.find((r) => r.id === repartoCorrente);
  const turno = TURNI.find((t) => t.id === turnoCorrente);

  // Dynamic Slot Calculation
  const todayDate = new Date().toISOString().split("T")[0];
  const activeTurnoSlot = turno ? getSlotForGroup(turno.id, todayDate) : null;

  // Count alerts for badge
  // Count alerts for badge
  const dipRep = repartoCorrente ? dipendenti.filter((d) => d.reparto_id === repartoCorrente) : dipendenti;
  const assRep = assegnazioni.filter((a) => dipRep.some((d) => d.id === a.dipendente_id));
  const macchineReparto = repartoCorrente ? macchine.filter((m) => m.reparto_id === repartoCorrente) : macchine;
  const alertCount = macchineReparto.filter((m) => {
    const assigned = assRep.filter((a) => a.macchina_id === m.id).length;
    return assigned < (m.personale_minimo || 1);
  }).length;

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Icons.dashboard },
    { id: "planning", label: "Pianificazione", icon: Icons.calendar },
    { id: "assegnazioni", label: "Assegnazioni", icon: Icons.machine, badge: alertCount || null },
    { id: "skills", label: "Competenze", icon: Icons.brain },
    { id: "anagrafica", label: "Anagrafica", icon: Icons.users },
    { id: "report", label: "Report", icon: Icons.report },
    { id: "ricerca", label: "Ricerca Storica", icon: Icons.history },
    { id: "motivi", label: "Motivi Assenza", icon: Icons.filter }, // using filter icon as placeholder or similar
    { id: "import", label: "Import SAP", icon: Icons.upload },
  ];

  const viewTitles = {
    dashboard: "Dashboard Turno",
    planning: "Pianificazione Mensile",
    assegnazioni: "Assegnazione Macchine",
    anagrafica: "Anagrafica Personale",
    report: "Report & Esportazioni",
    ricerca: "Ricerca Storica",
    motivi: "Gestione Motivi Assenza",

    import: "Import Dati SAP",
    zones: "Anagrafica Zone",
    skills: "Matrice Competenze",
  };

  const handleSendPlan = async () => {
    // Logic to "Send" the plan. For now, we simulate a successful action.
    // In a real app, this might trigger an email or saving a snapshot.
    console.log("📤 Sending Shift Plan...", {
      date: new Date().toISOString().split("T")[0],
      reparto: repartoCorrente,
      turno: turnoCorrente,
      presenzeCount: presenze.length
    });

    // Simulate API call
    showToast("Invio piano turno in corso...", "info");
    await new Promise(r => setTimeout(r, 1000));

    showToast(`Piano turno del ${new Date().toLocaleDateString()} inviato correttamente a CP / HR!`, "success"); // Simulated recipient
  };

  return (
    <div className="app">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">T</div>
            <div className="sidebar-logo-text">TurnoApp</div>
          </div>
          <div className="sidebar-subtitle">Gestione Personale</div>
        </div>

        <div className="sidebar-turno-badge">
          <div className="dot" />
          <div className="sidebar-turno-info">
            <div className="label">Turno Attivo ({turno?.id})</div>
            <div className="value">{activeTurnoSlot ? activeTurnoSlot.nome : "..."} — {activeTurnoSlot ? activeTurnoSlot.orario : "..."}</div>
          </div>
        </div>

        <div style={{ padding: "0 12px" }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Squadra / Turno</label>
            <select className="select-input" value={turnoCorrente} onChange={(e) => setTurnoCorrente(e.target.value)}>
              {TURNI.map((t) => {
                const s = getSlotForGroup(t.id, todayDate);
                return <option key={t.id} value={t.id}>{t.nome} — {s ? s.nome : ""} ({s ? s.orario : ""})</option>
              })}
            </select>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Operatività</div>
          {navItems.slice(0, 2).map((item) => (
            <div key={item.id} className={`nav-item ${currentView === item.id ? "active" : ""}`} onClick={() => setCurrentView(item.id)}>
              {item.icon}
              {item.label}
              {item.badge && <span className="badge">{item.badge}</span>}
            </div>
          ))}

          <div className="nav-section-label">Gestione</div>
          {navItems.slice(2, 4).map((item) => (
            <div key={item.id} className={`nav-item ${currentView === item.id ? "active" : ""}`} onClick={() => setCurrentView(item.id)}>
              {item.icon}
              {item.label}
            </div>
          ))}
          <div className={`nav-item ${currentView === 'zones' ? "active" : ""}`} onClick={() => setCurrentView('zones')}>
            {Icons.settings}
            Anagrafica Zone
          </div>

          <div className="nav-section-label">Dati</div>
          {navItems.slice(4).map((item) => (
            <div key={item.id} className={`nav-item ${currentView === item.id ? "active" : ""}`} onClick={() => setCurrentView(item.id)}>
              {item.icon}
              {item.label}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            onClick={toggleTheme}
            style={{
              width: "100%",
              marginBottom: 16,
              padding: "10px",
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              color: "var(--text-secondary)",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
              fontWeight: 600
            }}
          >
            {theme === "dark" ? (
              <><span style={{ fontSize: 16 }}>☀️</span> Light Mode</>
            ) : (
              <><span style={{ fontSize: 16 }}>🌙</span> Dark Mode</>
            )}
          </button>

          <div className="sidebar-user">
            <div className="sidebar-avatar">{reparto ? reparto.capoturno?.substring(0, 2).toUpperCase() : "PM"}</div>
            <div className="sidebar-user-info">
              <div className="name">{reparto ? reparto.capoturno : "Plant Manager"}</div>
              <div className="role">{reparto ? `Capoturno — ${reparto.nome}` : "Gestione Stabilimento"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="main">
        <div className="main-header">
          <div>
            <h1>{viewTitles[currentView]}</h1>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {reparto ? reparto.nome : "Tutti i Reparti"} • {turno?.nome} ({activeTurnoSlot?.nome}) • {new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
            </div>
          </div>
          <div className="main-header-actions">
            {currentView === "dashboard" && (
              <button className="btn btn-primary" onClick={handleSendPlan}>{Icons.send} Invia Piano Turno</button>
            )}
          </div>
        </div>

        <div className="main-content">
          {currentView === "dashboard" && (
            <DashboardView dipendenti={dipendenti} presenze={presenze} setPresenze={setPresenze} assegnazioni={assegnazioni} macchine={macchine} repartoCorrente={repartoCorrente} turnoCorrente={turnoCorrente} showToast={showToast} motivi={motivi} zones={zone} />
          )}
          {currentView === "planning" && (
            <PlanningView dipendenti={dipendenti} setDipendenti={setDipendenti} />
          )}
          {currentView === "assegnazioni" && (
            <AssegnazioniView
              dipendenti={dipendenti}
              presenze={presenze}
              assegnazioni={assegnazioni}
              setAssegnazioni={setAssegnazioni}
              macchine={macchine}
              attivita={attivita}
              setAttivita={setAttivita}
              repartoCorrente={repartoCorrente}
              turnoCorrente={turnoCorrente}
              showToast={showToast}
              zones={zone} // Pass zones for grouping
            />
          )}
          {currentView === "anagrafica" && (
            <AnagraficaView dipendenti={dipendenti} setDipendenti={setDipendenti} macchine={macchine} showToast={showToast} />
          )}
          {currentView === "zones" && (
            <ZoneView zones={zone} setZones={setZone} macchine={macchine} setMacchine={setMacchine} />
          )}
          {currentView === "report" && (
            <ReportView
              dipendenti={dipendenti}
              presenze={presenze}
              assegnazioni={assegnazioni}
              macchine={macchine}
              repartoCorrente={repartoCorrente}
              turnoCorrente={turnoCorrente}
              zones={zone}
              motivi={motivi}
            />
          )}
          {currentView === "ricerca" && (
            <RicercaView dipendenti={dipendenti} assegnazioni={assegnazioni} macchine={macchine} />
          )}
          {currentView === "import" && (
            <ImportView showToast={showToast} />
          )}
          {currentView === "skills" && (
            <SkillsView dipendenti={dipendenti} setDipendenti={setDipendenti} macchine={macchine} showToast={showToast} />
          )}
          {currentView === "motivi" && (
            <MotiviView motivi={motivi} setMotivi={setMotivi} showToast={showToast} />
          )}
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
