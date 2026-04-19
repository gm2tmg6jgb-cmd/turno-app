import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { REPARTI, TURNI } from "./data/constants"; // Keep static for UI structure or fetch if needed
import { supabase } from "./lib/supabase";
import { getSlotForGroup, getActiveGroup } from "./lib/shiftRotation";
import { Icons } from "./components/ui/Icons";
import { Toast } from "./components/ui/Toast";
import ErrorBoundary from "./components/ErrorBoundary";
import { getLocalDate } from "./lib/dateUtils";

// Views — lazy loaded per ridurre bundle iniziale
const DashboardView = lazy(() => import("./views/DashboardView"));
const AssegnazioniView = lazy(() => import("./views/AssegnazioniView"));
const AnagraficaMacchineView = lazy(() => import("./views/AnagraficaMacchineView"));
const PlanningView = lazy(() => import("./views/PlanningView"));
const SapHubView = lazy(() => import("./views/SapHubView"));
const LpaPlanView = lazy(() => import("./views/LpaPlanView"));
const InventoryView = lazy(() => import("./views/InventoryView"));
const WeisserPrioritiesView = lazy(() => import("./views/WeisserPrioritiesView"));
const PrioritiesSummaryView = lazy(() => import("./views/PrioritiesSummaryView"));
const ProductionReportView = lazy(() => import("./views/ProductionReportView"));
const ProductionFlowReportView = lazy(() => import("./views/ProductionFlowReportView"));
const AnagraficaFermiView = lazy(() => import("./views/AnagraficaFermiView"));
const SkillsView = lazy(() => import("./views/SkillsView"));
const FormazioneView = lazy(() => import("./views/FormazioneView"));
const ZoneView = lazy(() => import("./views/ZoneView"));
const Op10View = lazy(() => import("./views/Op10View"));
const ComponentFlowView = lazy(() => import("./views/ComponentFlowView"));
const PrioritaView = lazy(() => import("./views/PrioritaView"));
const AnagraficaView = lazy(() => import("./views/AnagraficaView"));
const MotiviView = lazy(() => import("./views/MotiviView"));
const ProductionDelaysView = lazy(() => import("./views/ProductionDelaysView"));
const ProductionScheduleView = lazy(() => import("./views/ProductionScheduleView"));
const NuovaPianificazioneView = lazy(() => import("./views/NuovaPianificazioneView"));
import { AdminSecurityWrapper } from "./components/AdminSecurityWrapper";

export default function App() {
  const [currentView, setCurrentView] = useState("componentFlow");
  const repartoCorrente = ""; // Intenzionalmente vuota: mostra tutti i reparti. Estendibile in futuro con un selettore.
  const [turnoCorrente, setTurnoCorrente] = useState(() => localStorage.getItem("turnoCorrente") || getActiveGroup());
  const [globalDate, setGlobalDate] = useState(() => getLocalDate(new Date()));

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
  const [pianificazione, setPianificazione] = useState([]);
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
          { data: pianHelper, error: errPian },
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
          supabase.from('pianificazione').select('*'),
          supabase.from('motivi_assenza').select('*'),
          supabase.from('motivi_fermo').select('*').order('label'),
          supabase.from('tecnologie_fermo').select('*').order('ordine'),
        ]);

        if (errDip) {
          console.warn("⚠️ Errore caricamento dipendenti (colonne mancanti?):", errDip);
        }
        if (errMac) throw errMac;
        if (errZone) throw errZone;
        if (errAtt) throw errAtt;
        if (errAss) throw errAss;
        if (errPres) throw errPres;
        if (errPian) {
          console.warn("⚠️ Tabella pianificazione non trovata:", errPian);
        }

        // --- AUTO-GENERATE PRESENCE FOR TODAY IF MISSING ---
        const today = getLocalDate(new Date());

        // Process dipendenti to auto-deactivate those with expired contracts
        const processedDipendenti = (dipHelper || []).map(d => {
          if (d.data_fine_rapporto && d.data_fine_rapporto < today) {
            return { ...d, attivo: false };
          }
          return d;
        });

        const isSunday = new Date(today).getDay() === 0;
        const presenzeOggi = presHelper ? presHelper.filter(p => p.data === today) : [];
        let finalPresenze = presHelper || [];

        if (!isSunday && presenzeOggi.length === 0 && processedDipendenti.length > 0) {
          // Double-check DB to avoid race condition in React StrictMode
          const { count } = await supabase
            .from('presenze')
            .select('*', { count: 'exact', head: true })
            .eq('data', today);

          if (count === 0) {
            const newPresenze = processedDipendenti
              .filter(d => d.attivo !== false) // Filter out terminated workers
              .map(d => ({
                dipendente_id: d.id,
                data: today,
                turno_id: d.turno_default || "D",
                presente: true,
                motivo_assenza: null
              }));

            const { data: insertedPres, error: errInsert } = await supabase
              .from('presenze')
              .upsert(newPresenze, { onConflict: "dipendente_id,data", ignoreDuplicates: true })
              .select();

            if (errInsert) {
              console.error("❌ Error generating daily presence:", errInsert);
              showToast("Errore generazione presenze: " + errInsert.message, "error");
            } else {
              finalPresenze = [...finalPresenze, ...(insertedPres || [])];
              if (insertedPres?.length > 0) showToast("Presenze giornaliere generate", "success");
            }
          }
        }
        // ---------------------------------------------------

        setDipendenti(processedDipendenti);
        setMacchine(macHelper || []);
        setZone(zoneHelper || []);
        setAttivita(attHelper || []);
        setAssegnazioni(assHelper || []);
        setPresenze(finalPresenze);
        setPianificazione(pianHelper || []);
        setMotivi(motiviHelper || []);
        setMotiviFermo(motiviFermoHelper || []);
        setTecnologie(tecnologieHelper || []);
      } catch (error) {
        console.error("❌ Error fetching data:", error);
        // If it's the planning table missing, we can still load
        if (error.message?.includes('pianificazione') || error.message?.includes('404')) {
          console.warn("⚠️ Tabella pianificazione non trovata. Funzionalità limitata.");
          showToast("Tabella Pianificazione non trovata sul database remoto.", "warning");
        } else {
          showToast("Errore caricamento dati: " + error.message, "error");
        }
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
    { id: "dashboard", label: "Gestione Dipendenti", icon: Icons.dashboard },
    // DEBUG: navItems should contain productionDelays
    { id: "planning", label: "Pianificazione", icon: Icons.calendar },
    { id: "assegnazioni", label: "Assegnazioni", icon: Icons.machine, badge: alertCount || null },
    { id: "sapHub", label: "Hub SAP", icon: Icons.settings, status: "new" },
    { id: "op10", label: "Asservimento OP10", icon: Icons.check },
    { id: "skills", label: "Competenze", icon: Icons.brain },
    { id: "formazione", label: "Formazione", icon: Icons.academic },
    { id: "lpaPlan", label: "Piano LPA", icon: Icons.calendar },
    { id: "componentFlow", label: "Report di Produzione", icon: Icons.report, status: "new" },
    { id: "priorita", label: "Laboratorio Attualizzato Beta", icon: Icons.filter },
    { id: "weisserPriorities", label: "Priorità Macchine", icon: Icons.filter },
    { id: "prioritiesSummary", label: "Riepilogo Priorità", icon: Icons.dashboard, status: "new" },
    { id: "productionFlowReport", label: "Produzione Macchine", icon: Icons.report, status: "new" },
    { id: "productionReport", label: "Matrice Componente/Macchina", icon: Icons.report },
    { id: "productionDelays", label: "Gestione Ritardi", icon: Icons.alert, status: "new" },
    { id: "productionSchedule", label: "Programma Produzione", icon: Icons.calendar, status: "new" },
    { id: "nuovaPianificazione", label: "Nuova Pianificazione", icon: Icons.calendar, status: "new" },
    { id: "anagraficaMacchine", label: "Anagrafica Macchine", icon: Icons.machine },
    { id: "anagraficaFermi", label: "Anagrafica Fermi", icon: Icons.settings },
    { id: "zones", label: "Anagrafica Zone", icon: Icons.settings },
    { id: "anagrafica", label: "Anagrafica Dipendenti", icon: Icons.users },
    { id: "motivi", label: "Gestione Motivi", icon: Icons.settings },
    { id: "inventory", label: "Inventario", icon: Icons.report },
  ];

  // DEBUG: Log navItems to verify productionDelays is included
  console.log('[App] navItems:', navItems.map(item => item.id));
  console.log('[App] Has productionDelays:', navItems.some(item => item.id === 'productionDelays'));

  const viewTitles = {
    dashboard: "Gestione dipendenti",
    assegnazioni: "Assegnazione Macchine",
    op10: "Asservimento OP10",
    sapHub: "Hub Gestione SAP",
    componentFlow: "Avanzamento Componenti",
    priorita: "Laboratorio Attualizzato Beta",
    weisserPriorities: "Priorità Macchine",
    prioritiesSummary: "Riepilogo Priorità Macchine",
    productionFlowReport: "Flusso Report Produzione",
    productionReport: "Report Produzione",
    productionDelays: "Gestione Ritardi Produzione",
    productionSchedule: "Programma Produzione",
    nuovaPianificazione: "Nuova Pianificazione Produzione",
    fermi: "Report Fermi",
    anagrafica: "Anagrafica Dipendenti",
    anagraficaFermi: "Anagrafica Fermi Macchine",
    anagraficaMacchine: "Anagrafica Macchine",
    motivi: "Gestione Motivi Assenza",
    zones: "Anagrafica Zone",
    planning: "Pianificazione Turni",
    lpaPlan: "Piano LPA 2026",
    skills: "Matrice Competenze",
    formazione: "Gestione Formazione Operatori",
    inventory: "Gestione Inventario Progetti",
  };

  const handleSendPlan = async () => {
    // Logic to "Send" the plan. For now, we simulate a successful action.
    // In a real app, this might trigger an email or saving a snapshot.
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
            <div className="sidebar-logo-icon">B</div>
            <div className="sidebar-logo-text">BAP1 - Production</div>
          </div>

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

            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", gap: 6 }}>
              <div className="label" style={{ flex: 1, fontSize: 11 }}>Data Attiva</div>
              {globalDate !== getLocalDate(new Date()) && (
                <button
                  onClick={() => setGlobalDate(getLocalDate(new Date()))}
                  title="Torna a oggi"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 11, padding: 0, lineHeight: 1 }}
                >
                  ↺ oggi
                </button>
              )}
            </div>
            <input
              type="date"
              value={globalDate}
              onChange={(e) => setGlobalDate(e.target.value)}
              style={{ background: "transparent", border: "none", color: "var(--text-primary)", fontWeight: 700, fontSize: 15, cursor: "pointer", padding: "4px 0", outline: "none", width: "100%", fontFamily: "inherit", marginTop: 4 }}
            />

          </div>
        </div>

        <nav className="sidebar-nav">
          {/* Helper locale per renderizzare ogni voce */}
          {(() => {
            const ni = (id) => navItems.find(i => i.id === id);
            const renderItem = (item) => item ? (
              <div key={item.id} className={`nav-item ${currentView === item.id ? "active" : ""}`} onClick={() => setCurrentView(item.id)}>
                {item.icon}
                <span style={{ display: "flex", alignItems: "center", flex: 1 }}>
                  {item.label}
                  {item.status && <span className={`nav-status-badge ${item.status}`}>{item.status}</span>}
                </span>
                {item.badge && <span className="badge">{item.badge}</span>}
              </div>
            ) : null;
            return (
              <>
                <div className="nav-section-label">Operatività</div>
                {renderItem(ni("dashboard"))}
                {renderItem(ni("assegnazioni"))}
                {renderItem(ni("planning"))}

                <div className="nav-section-label">Sviluppo HR</div>
                {renderItem(ni("skills"))}
                {renderItem(ni("formazione"))}

                <div className="nav-section-label">Report & Dati</div>
                {renderItem(ni("componentFlow"))}
                {renderItem(ni("priorita"))}
                {renderItem(ni("productionFlowReport"))}
                {renderItem(ni("productionReport"))}
                {renderItem(ni("productionSchedule"))}
                {renderItem(ni("nuovaPianificazione"))}
                {renderItem(ni("lpaPlan"))}
                {renderItem(ni("op10"))}
                {renderItem(ni("sapHub"))}

                <div className="nav-section-label">Anagrafiche</div>
                {renderItem(ni("anagraficaMacchine"))}
                {renderItem(ni("zones"))}
                {renderItem(ni("anagraficaFermi"))}
                {renderItem(ni("anagrafica"))}
                {renderItem(ni("motivi"))}

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
        {currentView === "dashboard" && (
          <div className="main-header">
            <div>
              <h1>{viewTitles[currentView]}</h1>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {reparto ? reparto.nome : "Tutti i Reparti"} • {turno?.nome} ({activeTurnoSlot?.nome}) • {new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
              </div>
            </div>
            <div className="main-header-actions">
              <button className="btn btn-primary" onClick={handleSendPlan}>{Icons.send} Invia Piano Turno</button>
            </div>
          </div>
        )}

        <ErrorBoundary>
        <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Caricamento...</div>}>
        <div className="main-content">
          {currentView === "dashboard" && (
            <DashboardView
              dipendenti={dipendenti}
              setDipendenti={setDipendenti}
              presenze={presenze}
              setPresenze={setPresenze}
              pianificazione={pianificazione}
              setPianificazione={setPianificazione}
              assegnazioni={assegnazioni}
              macchine={macchine}
              repartoCorrente={repartoCorrente}
              turnoCorrente={turnoCorrente}
              showToast={showToast}
              motivi={motivi}
              setMotivi={setMotivi}
              zones={zone}
              globalDate={globalDate}
            />
          )}
          {currentView === "planning" && (
            <PlanningView
              dipendenti={dipendenti}
              setDipendenti={setDipendenti}
              presenze={presenze}
              pianificazione={pianificazione}
              setPianificazione={setPianificazione}
              turnoCorrente={turnoCorrente}
              globalDate={globalDate}
              motivi={motivi}
              showToast={showToast}
            />
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
              zones={zone}
              globalDate={globalDate}
            />
          )}

          {currentView === "lpaPlan" && (
            <LpaPlanView macchine={macchine} dipendenti={dipendenti} showToast={showToast} turnoCorrente={turnoCorrente} />
          )}

          {currentView === "sapHub" && (
            <SapHubView
              macchine={macchine}
              showToast={showToast}
              setCurrentView={setCurrentView}
              globalDate={globalDate}
            />
          )}

          {currentView === "componentFlow" && (
            <ComponentFlowView macchine={macchine} showToast={showToast} globalDate={globalDate} />
          )}
          {currentView === "priorita" && (
            <PrioritaView showToast={showToast} globalDate={globalDate} turnoCorrente={turnoCorrente} />
          )}
          {currentView === "weisserPriorities" && (
            <WeisserPrioritiesView turnoCorrente={turnoCorrente} />
          )}
          {currentView === "prioritiesSummary" && (
            <PrioritiesSummaryView turnoCorrente={turnoCorrente} />
          )}
          {currentView === "productionFlowReport" && (
            <ProductionFlowReportView
              macchine={macchine}
              tecnologie={tecnologie}
              motiviFermo={motiviFermo}
              globalDate={globalDate}
              setGlobalDate={setGlobalDate}
              turnoCorrente={turnoCorrente}
              setTurnoCorrente={setTurnoCorrente}
            />
          )}
          {currentView === "productionReport" && (
            <ProductionReportView
              macchine={macchine}
              globalDate={globalDate}
              turnoCorrente={turnoCorrente}
              motiviFermo={motiviFermo}
              tecnologie={tecnologie}
              assegnazioni={assegnazioni}
              dipendenti={dipendenti}
            />
          )}
          {currentView === "productionDelays" && (
            <ProductionDelaysView
              showToast={showToast}
              globalDate={globalDate}
            />
          )}
          {currentView === "productionSchedule" && (
            <ProductionScheduleView showToast={showToast} />
          )}
          {currentView === "nuovaPianificazione" && (
            <NuovaPianificazioneView showToast={showToast} />
          )}
          {currentView === "anagraficaMacchine" && (
            <AdminSecurityWrapper title="Anagrafica Macchine">
              <AnagraficaMacchineView macchine={macchine} setMacchine={setMacchine} tecnologie={tecnologie} zone={zone} showToast={showToast} />
            </AdminSecurityWrapper>
          )}

          {currentView === "anagraficaFermi" && (
            <AnagraficaFermiView
              motiviFermo={motiviFermo}
              setMotiviFermo={setMotiviFermo}
              tecnologie={tecnologie}
              showToast={showToast}
            />
          )}

          {currentView === "zones" && (
            <AdminSecurityWrapper title="Anagrafica Zone">
              <ZoneView zones={zone} setZones={setZone} macchine={macchine} setMacchine={setMacchine} showToast={showToast} />
            </AdminSecurityWrapper>
          )}

          {currentView === "op10" && <Op10View globalDate={globalDate} setGlobalDate={setGlobalDate} turnoCorrente={turnoCorrente} />}
          {currentView === "skills" && (
            <SkillsView dipendenti={dipendenti} setDipendenti={setDipendenti} macchine={macchine} showToast={showToast} turnoCorrente={turnoCorrente} />
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

          {currentView === "anagrafica" && (
            <AdminSecurityWrapper title="Anagrafica Dipendenti">
              <AnagraficaView
                dipendenti={dipendenti}
                setDipendenti={setDipendenti}
                macchine={macchine}
                showToast={showToast}
                turnoCorrente={turnoCorrente}
              />
            </AdminSecurityWrapper>
          )}

          {currentView === "motivi" && (
            <AdminSecurityWrapper title="Gestione Motivi">
              <MotiviView motivi={motivi} setMotivi={setMotivi} showToast={showToast} />
            </AdminSecurityWrapper>
          )}

          {currentView === "inventory" && <InventoryView showToast={showToast} macchine={macchine} />}
        </div>
        </Suspense>
        </ErrorBoundary>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
