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
import PlanningView from "./views/PlanningView";
import ZoneView from "./views/ZoneView";

export default function App() {
  const [currentView, setCurrentView] = useState("dashboard");
  const [repartoCorrente, setRepartoCorrente] = useState("T11");
  const [turnoCorrente, setTurnoCorrente] = useState("D");

  // State from DB
  const [dipendenti, setDipendenti] = useState([]);
  const [macchine, setMacchine] = useState([]);
  const [zone, setZone] = useState([]);
  const [attivita, setAttivita] = useState([]);
  const [assegnazioni, setAssegnazioni] = useState([]);
  const [presenze, setPresenze] = useState([]);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type) => {
    setToast({ message, type });
  }, []);

  // Fetch Data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("🔄 Fetching data from Supabase...");

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

        // --- AUTO-GENERATE PRESENCE FOR TODAY IF MISSING ---
        const today = new Date().toISOString().split("T")[0];
        const presenzeOggi = presHelper ? presHelper.filter(p => p.data === today) : [];

        let finalPresenze = presHelper || [];

        if (presenzeOggi.length === 0 && dipHelper && dipHelper.length > 0) {
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
        }
        // ---------------------------------------------------

        setDipendenti(dipHelper || []);
        setMacchine(macHelper || []);
        setZone(zoneHelper || []);
        setAttivita(attHelper || []);
        setAssegnazioni(assHelper || []);
        setPresenze(finalPresenze);

        console.log("✅ Data fetched successfully");
      } catch (error) {
        console.error("❌ Error fetching data:", error);
        showToast("Errore caricamento dati: " + error.message, "error");
      }
    };

    fetchData();
  }, [showToast]);



  const reparto = REPARTI.find((r) => r.id === repartoCorrente);
  const turno = TURNI.find((t) => t.id === turnoCorrente);

  // Dynamic Slot Calculation
  // Force Rebuild
  const todayDate = new Date().toISOString().split("T")[0];
  const currentSlot = turno ? getSlotForGroup(turno.id, todayDate) : null;

  // Count alerts for badge
  // Count alerts for badge
  const dipRep = dipendenti.filter((d) => d.reparto_id === repartoCorrente);
  const assRep = assegnazioni.filter((a) => dipRep.some((d) => d.id === a.dipendente_id));
  const macchineReparto = macchine.filter((m) => m.reparto_id === repartoCorrente);
  const alertCount = macchineReparto.filter((m) => {
    const assigned = assRep.filter((a) => a.macchina_id === m.id).length;
    return assigned < (m.personale_minimo || 1);
  }).length;

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Icons.dashboard },
    { id: "planning", label: "Pianificazione", icon: "📅" },
    { id: "assegnazioni", label: "Assegnazioni", icon: Icons.machine, badge: alertCount || null },
    { id: "skills", label: "Competenze", icon: "🧠" },
    { id: "anagrafica", label: "Anagrafica", icon: Icons.users },
    { id: "report", label: "Report", icon: Icons.report },
    { id: "ricerca", label: "Ricerca Storica", icon: Icons.history },
    { id: "import", label: "Import SAP", icon: Icons.upload },
  ];

  const viewTitles = {
    dashboard: "Dashboard Turno",
    planning: "Pianificazione Mensile",
    assegnazioni: "Assegnazione Macchine",
    anagrafica: "Anagrafica Personale",
    report: "Report & Esportazioni",
    ricerca: "Ricerca Storica",

    import: "Import Dati SAP",
    zones: "Anagrafica Zone",
    skills: "Matrice Competenze",
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
            <div className="value">{currentSlot ? currentSlot.nome : "..."} — {currentSlot ? currentSlot.orario : "..."}</div>
          </div>
        </div>

        <div style={{ padding: "0 12px" }}>
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label className="form-label">Reparto</label>
            <select className="select-input" value={repartoCorrente} onChange={(e) => setRepartoCorrente(e.target.value)}>
              {REPARTI.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </div>
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
          <div className="sidebar-user">
            <div className="sidebar-avatar">{reparto?.capoturno?.substring(0, 2).toUpperCase() || "CT"}</div>
            <div className="sidebar-user-info">
              <div className="name">{reparto?.capoturno || "Capoturno"}</div>
              <div className="role">Capoturno — {reparto?.nome}</div>
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
              {reparto?.nome} • {turno?.nome} ({currentSlot?.nome}) • {new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
            </div>
          </div>
          <div className="main-header-actions">
            {currentView === "dashboard" && (
              <button className="btn btn-primary">{Icons.send} Invia Piano Turno</button>
            )}
          </div>
        </div>

        <div className="main-content">
          {currentView === "dashboard" && (
            <DashboardView dipendenti={dipendenti} presenze={presenze} setPresenze={setPresenze} assegnazioni={assegnazioni} macchine={macchine} repartoCorrente={repartoCorrente} turnoCorrente={turnoCorrente} showToast={showToast} />
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
            />
          )}
          {currentView === "anagrafica" && (
            <AnagraficaView dipendenti={dipendenti} setDipendenti={setDipendenti} macchine={macchine} showToast={showToast} />
          )}
          {currentView === "zones" && (
            <ZoneView zones={zone} setZones={setZone} macchine={macchine} setMacchine={setMacchine} />
          )}
          {currentView === "report" && (
            <ReportView dipendenti={dipendenti} presenze={presenze} assegnazioni={assegnazioni} macchine={macchine} repartoCorrente={repartoCorrente} turnoCorrente={turnoCorrente} />
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
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
