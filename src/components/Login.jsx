import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [mode, setMode] = useState("login"); // "login" | "reset"
    const [resetSent, setResetSent] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError("Email o password non corretti.");
        setLoading(false);
    };

    const handleReset = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin
        });
        if (error) {
            setError("Errore nell'invio dell'email. Verifica l'indirizzo.");
        } else {
            setResetSent(true);
        }
        setLoading(false);
    };

    return (
        <div style={{
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--bg-primary)"
        }}>
            <div style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 16,
                padding: 40,
                width: 380,
                boxShadow: "0 20px 40px rgba(0,0,0,0.3)"
            }}>
                {/* Logo / Titolo */}
                <div style={{ textAlign: "center", marginBottom: 32 }}>
                    <div style={{
                        width: 56,
                        height: 56,
                        borderRadius: 14,
                        background: "var(--accent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 28,
                        margin: "0 auto 16px"
                    }}>⚙️</div>
                    <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>
                        Turno App
                    </h1>
                    <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                        {mode === "login" ? "Accedi per continuare" : "Recupera la tua password"}
                    </p>
                </div>

                {/* FORM LOGIN */}
                {mode === "login" && (
                    <form onSubmit={handleLogin}>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                                Email
                            </label>
                            <input
                                type="email"
                                className="input"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="nome@azienda.it"
                                required
                                autoFocus
                                style={{ width: "100%", fontSize: 14 }}
                            />
                        </div>

                        <div style={{ marginBottom: 8 }}>
                            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                                Password
                            </label>
                            <input
                                type="password"
                                className="input"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                style={{ width: "100%", fontSize: 14 }}
                            />
                        </div>

                        {/* Link password dimenticata */}
                        <div style={{ textAlign: "right", marginBottom: 20 }}>
                            <button
                                type="button"
                                onClick={() => { setMode("reset"); setError(""); }}
                                style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
                            >
                                Password dimenticata?
                            </button>
                        </div>

                        {error && (
                            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#ef4444", fontWeight: 600 }}>
                                ⚠️ {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                            style={{ width: "100%", padding: "12px", fontSize: 15, fontWeight: 700 }}
                        >
                            {loading ? "Accesso in corso..." : "Accedi"}
                        </button>
                    </form>
                )}

                {/* FORM RECUPERO PASSWORD */}
                {mode === "reset" && (
                    <div>
                        {resetSent ? (
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 40, marginBottom: 16 }}>📧</div>
                                <p style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
                                    Email inviata!
                                </p>
                                <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
                                    Controlla la tua casella <strong>{email}</strong> e clicca il link per reimpostare la password.
                                </p>
                                <button
                                    onClick={() => { setMode("login"); setResetSent(false); setError(""); }}
                                    className="btn btn-secondary"
                                    style={{ width: "100%" }}
                                >
                                    ← Torna al Login
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleReset}>
                                <div style={{ marginBottom: 20 }}>
                                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        className="input"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="nome@azienda.it"
                                        required
                                        autoFocus
                                        style={{ width: "100%", fontSize: 14 }}
                                    />
                                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                                        Ti mandiamo un link per reimpostare la password.
                                    </p>
                                </div>

                                {error && (
                                    <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#ef4444", fontWeight: 600 }}>
                                        ⚠️ {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={loading}
                                    style={{ width: "100%", padding: "12px", fontSize: 15, fontWeight: 700, marginBottom: 10 }}
                                >
                                    {loading ? "Invio in corso..." : "Invia Email di Reset"}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => { setMode("login"); setError(""); }}
                                    className="btn btn-secondary"
                                    style={{ width: "100%" }}
                                >
                                    ← Torna al Login
                                </button>
                            </form>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
