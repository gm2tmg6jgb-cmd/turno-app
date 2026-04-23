import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            setError("Email o password non corretti.");
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
                        Accedi per continuare
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleLogin}>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{
                            display: "block",
                            fontSize: 11,
                            fontWeight: 700,
                            color: "var(--text-muted)",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            marginBottom: 6
                        }}>
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

                    <div style={{ marginBottom: 24 }}>
                        <label style={{
                            display: "block",
                            fontSize: 11,
                            fontWeight: 700,
                            color: "var(--text-muted)",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            marginBottom: 6
                        }}>
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

                    {error && (
                        <div style={{
                            background: "rgba(239,68,68,0.1)",
                            border: "1px solid rgba(239,68,68,0.3)",
                            borderRadius: 8,
                            padding: "10px 14px",
                            marginBottom: 16,
                            fontSize: 13,
                            color: "#ef4444",
                            fontWeight: 600
                        }}>
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
            </div>
        </div>
    );
}
