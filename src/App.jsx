import { useState, useEffect, useCallback } from "react";
import { REPARTI, TURNI } from "./data/constants"; // Keep static for UI structure or fetch if needed
import { supabase } from "./lib/supabase";
import { getSlotForGroup, getActiveGroup } from "./lib/shiftRotation";
import { Icons } from "./components/ui/Icons";
import { Toast } from "./components/ui/Toast";

// Views
import DashboardView from "./views/DashboardView";
import AssegnazioniView from "./views/AssegnazioniView";
import AnagraficaView from "./views/AnagraficaView";
import ReportView from "./views/ReportView";
import { getLocalDate } from "./lib/dateUtils";
import FermiView from "./views/FermiView";
import FormazioneView from "./views/FormazioneView";

import ImportView from "./views/ImportView";
import SkillsView from "./views/SkillsView";
import MotiviView from "./views/MotiviView";
import PlanningView from "./views/PlanningView";
import ZoneView from "./views/ZoneView";
import LimitazioniView from "./views/LimitazioniView";
import Op10View from "./views/Op10View";
import AnagraficaFermiView from "./views/AnagraficaFermiView";
import AnagraficaMacchineView from "./views/AnagraficaMacchineView";
import SapDataView from "./views/SapDataView";
import SapSummaryView from "./views/SapSummaryView";
import AnagraficaMaterialiView from "./views/AnagraficaMaterialiView";

export default function App() {
  const [currentView, setCurrentView] = useState("dashboard");
  const repartoCorrente = "";
  const [turnoCorrente, setTurnoCorrente] = useState(() => localStorage.getItem("turnoCorrente") || getActiveGroup());

  useEffect(() => {
    localStorage.setItem("turnoCorrente", turnoCorrente);
  }, [turnoCorrente]);

  // State from DB
  const [dipendenti, setDipendenti] = useState([]);
  const [macchine, setMacchine] = useState([]);
  const [zone, setZone] = useState([]);
  const [attivita, setAttivita] = useState([]);
  const [assegnazioni, setAssegnazioni] = useState([]);
  const [presenze, setPresenze] = useState([]);
  const [motivi, setMotivi] = useState([]);
  const [motiviFermo, setMotiviFermo] = useState([]);
  const [tecnologie, setTecnologie] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
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
        // Run all independent queries in parallel
        const [
          { data: dipHelper, error: errDip },
          { data: macHelper, error: errMac },
          { data: zoneHelper, error: errZone },
          { data: attHelper, error: errAtt },
          { data: assHelper, error: errAss },
          { data: presHelper, error: errPres },
          { data: motiviHelper },
          { data: motiviFermoHelper },
          { data: tecnologieHelper },
        ] = await Promise.all([
          supabase.from('dipendenti').select('*'),
          supabase.from('macchine').select('*'),
          supabase.from('zone').select('*'),
          supabase.from('attivita').select('*'),
          supabase.from('assegnazioni').select('*'),
          supabase.from('presenze').select('*'),
          supabase.from('motivi_assenza').select('*'),
          supabase.from('motivi_fermo').select('*').order('label'),
          supabase.from('tecnologie_fermo').select('*').order('ordine'),
        ]);

        if (errDip) throw errDip;
        if (errMac) throw errMac;
        if (errZone) throw errZone;
        if (errAtt) throw errAtt;
        if (errAss) throw errAss;
        if (errPres) throw errPres;

        // --- AUTO-GENERATE PRESENCE FOR TODAY IF MISSING ---
        const today = getLocalDate(new Date());
        const isSunday = new Date(today).getDay() === 0;
        const presenzeOggi = presHelper ? presHelper.filter(p => p.data === today) : [];
        let finalPresenze = presHelper || [];

        if (!isSunday && presenzeOggi.length === 0 && dipHelper && dipHelper.length > 0) {
          // Double-check DB to avoid race condition in React StrictMode
          const { count } = await supabase
            .from('presenze')
            .select('*', { count: 'exact', head: true })
            .eq('data', today);

          if (count === 0) {
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
              finalPresenze = [...finalPresenze, ...insertedPres];
              showToast("Presenze giornaliere generate", "success");
            }
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
        setMotiviFermo(motiviFermoHelper || []);
        setTecnologie(tecnologieHelper || []);
      } catch (error) {
        console.error("❌ Error fetching data:", error);
        showToast("Errore caricamento dati: " + error.message, "error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [showToast]);





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
    { id: "anagrafica", label: "Anagrafica", icon: Icons.users },
    { id: "assegnazioni", label: "Assegnazioni", icon: Icons.machine, badge: alertCount || null },
    { id: "op10", label: "Asservimento OP10", icon: Icons.check },
    { id: "skills", label: "Competenze", icon: Icons.brain },
    { id: "formazione", label: "Formazione", icon: Icons.academic },
    { id: "report", label: "Report Fine Turno", icon: Icons.report },
    { id: "motivi", label: "Motivi Assenza", icon: Icons.filter },
    { id: "import", label: "Import SAP", icon: Icons.upload },
    { id: "sapData", label: "Storico Dati SAP", icon: Icons.report },
    { id: "sapSummary", label: "Analisi Produzione SAP", icon: Icons.dashboard },
    { id: "fermi", label: "Report Fermi", icon: Icons.alert },
    { id: "anagraficaFermi", label: "Anagrafica Fermi", icon: Icons.settings },
    { id: "anagraficaMacchine", label: "Anagrafica Macchine", icon: Icons.machine },
    { id: "anagraficaMateriali", label: "Anagrafica Materiali", icon: Icons.filter },
    { id: "zones", label: "Anagrafica Zone", icon: Icons.settings },
  ];

  const viewTitles = {
    dashboard: "Gestione dipendenti",
    planning: "Pianificazione Mensile",
    assegnazioni: "Assegnazione Macchine",
    anagrafica: "Anagrafica Personale",
    op10: "Asservimento OP10",
    report: "Report Fine Turno",
    motivi: "Gestione Motivi Assenza",
    import: "Import Dati SAP",
    sapData: "Storico Dati SAP",
    sapSummary: "Analisi Produzione SAP",
    fermi: "Report Fermi",
    anagraficaFermi: "Anagrafica Fermi Macchine",
    anagraficaMacchine: "Anagrafica Macchine",
    anagraficaMateriali: "Anagrafica Materiali",
    zones: "Anagrafica Zone",
    skills: "Matrice Competenze",
    formazione: "Gestione Formazione Operatori",
    limitazioni: "Area Privacy Alta - Limitazioni",
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

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 16, background: "var(--bg-primary)", color: "var(--text-secondary)" }}>
        <div style={{ fontSize: 32 }}>⚙️</div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Caricamento dati...</div>
      </div>
    );
  }

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

        <div className="sidebar-turno-badge" style={{ margin: "16px 12px", padding: "20px 18px", gap: 14 }}>
          <div className="dot" style={{ width: 10, height: 10 }} />
          <div className="sidebar-turno-info">
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div className="label" style={{ flex: 1, fontSize: 11 }}>Turno Attivo</div>
              {turnoCorrente !== getActiveGroup() && (
                <button
                  onClick={() => setTurnoCorrente(getActiveGroup())}
                  title="Torna al turno corrente"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 11, padding: 0, lineHeight: 1 }}
                >
                  ↺ auto
                </button>
              )}
            </div>
            <select
              value={turnoCorrente}
              onChange={(e) => setTurnoCorrente(e.target.value)}
              style={{ background: "transparent", border: "none", color: "var(--text-primary)", fontWeight: 700, fontSize: 15, cursor: "pointer", padding: "4px 0", outline: "none", width: "100%" }}
            >
              {TURNI.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}{t.coordinatore ? ` - ${t.coordinatore}` : ''}</option>
              ))}
            </select>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{activeTurnoSlot ? activeTurnoSlot.nome : "..."} — {activeTurnoSlot ? activeTurnoSlot.orario : "..."}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {/* Helper locale per renderizzare ogni voce */}
          {(() => {
            const ni = (id) => navItems.find(i => i.id === id);
            const renderItem = (item) => item ? (
              <div key={item.id} className={`nav-item ${currentView === item.id ? "active" : ""}`} onClick={() => setCurrentView(item.id)}>
                {item.icon}{item.label}
                {item.badge && <span className="badge">{item.badge}</span>}
              </div>
            ) : null;
            return (
              <>
                <div className="nav-section-label">Operatività</div>
                {renderItem(ni("dashboard"))}
                {renderItem(ni("planning"))}
                {renderItem(ni("assegnazioni"))}

                <div className="nav-section-label">Sviluppo HR</div>
                {renderItem(ni("skills"))}
                {renderItem(ni("formazione"))}

                <div className="nav-section-label">Report & Dati</div>
                {renderItem(ni("report"))}
                {renderItem(ni("op10"))}
                {renderItem(ni("fermi"))}
                {renderItem(ni("sapSummary"))}
                {renderItem(ni("import"))}
                {renderItem(ni("sapData"))}

                <div className="nav-section-label">Anagrafiche</div>
                {renderItem(ni("anagrafica"))}
                {renderItem(ni("anagraficaMacchine"))}
                {renderItem(ni("anagraficaMateriali"))}
                {renderItem(ni("zones"))}
                {renderItem(ni("anagraficaFermi"))}
                {renderItem(ni("motivi"))}

                <div className="nav-section-label" style={{ color: "var(--danger)", marginTop: 12 }}>Privacy Alta</div>
                <div className={`nav-item ${currentView === 'limitazioni' ? "active" : ""}`} onClick={() => setCurrentView('limitazioni')} style={{ color: currentView === 'limitazioni' ? "var(--danger)" : "inherit" }}>
                  <span style={{ fontSize: 16, marginRight: 8 }}>🔒</span> Prescrizioni e Note
                </div>
              </>
            );
          })()}
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
            <PlanningView dipendenti={dipendenti} setDipendenti={setDipendenti} presenze={presenze} turnoCorrente={turnoCorrente} />
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
            <AnagraficaView
              dipendenti={dipendenti}
              setDipendenti={setDipendenti}
              macchine={macchine}
              showToast={showToast}
              turnoCorrente={turnoCorrente} // Pass current shift for filtering
            />
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
              motiviFermo={motiviFermo}
            />
          )}

          {currentView === "import" && (
            <ImportView showToast={showToast} macchine={macchine} />
          )}
          {currentView === "sapData" && (
            <SapDataView macchine={macchine} />
          )}
          {currentView === "sapSummary" && (
            <SapSummaryView macchine={macchine} />
          )}
          {currentView === "fermi" && (
            <FermiView macchine={macchine} initialReparto={repartoCorrente} initialTurno={turnoCorrente} motiviFermo={motiviFermo} tecnologie={tecnologie} />
          )}
          {currentView === "anagraficaFermi" && (
            <AnagraficaFermiView motiviFermo={motiviFermo} setMotiviFermo={setMotiviFermo} tecnologie={tecnologie} setTecnologie={setTecnologie} macchine={macchine} setMacchine={setMacchine} showToast={showToast} />
          )}
          {currentView === "anagraficaMacchine" && (
            <AnagraficaMacchineView macchine={macchine} setMacchine={setMacchine} tecnologie={tecnologie} zone={zone} showToast={showToast} />
          )}
          {currentView === "anagraficaMateriali" && (
            <AnagraficaMaterialiView showToast={showToast} />
          )}
          {currentView === "op10" && <Op10View />}
          {currentView === "skills" && (
            <SkillsView dipendenti={dipendenti} setDipendenti={setDipendenti} macchine={macchine} showToast={showToast} turnoCorrente={turnoCorrente} />
          )}
          {currentView === "motivi" && (
            <MotiviView motivi={motivi} setMotivi={setMotivi} showToast={showToast} />
          )}
          {currentView === "formazione" && (
            <FormazioneView
              dipendenti={dipendenti}
              assegnazioni={assegnazioni}
              macchine={macchine}
              presenze={presenze}
              turnoCorrente={turnoCorrente}
            />
          )}
          {currentView === "limitazioni" && (
            <LimitazioniView dipendenti={dipendenti} presenze={presenze} />
          )}
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
