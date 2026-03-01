import { useState } from "react";
import { Icons } from "./ui/Icons";

/**
 * AdminSecurityWrapper
 * Protegge il contenuto con una schermata di blocco password.
 * Password di default: admin123
 */
export const AdminSecurityWrapper = ({ children, title = "Area Protetta" }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState("");
    const [error, setError] = useState(false);

    const handleLogin = (e) => {
        e.preventDefault();
        if (password.trim() === "admin123") {
            setIsAuthenticated(true);
            setError(false);
        } else {
            setError(true);
            setPassword("");
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="fade-in" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", padding: 20 }}>
                <div className="card" style={{ maxWidth: 400, width: "100%", textAlign: "center", padding: 32 }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
                    <h2 style={{ fontSize: 20, marginBottom: 8, color: "var(--text-primary)" }}>{title}</h2>
                    <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24 }}>
                        Questa sezione è riservata agli amministratori. Inserisci la password per continuare.
                    </p>

                    <form onSubmit={handleLogin}>
                        <div className="form-group" style={{ textAlign: "left" }}>
                            <input
                                type="password"
                                className={`input ${error ? 'input-error' : ''}`}
                                placeholder="Password..."
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(false); }}
                                style={{ width: "100%", borderColor: error ? "var(--danger)" : "var(--border)" }}
                                autoFocus
                            />
                            {error && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Password errata</div>}
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: 8 }}>
                            {Icons.key} Sblocca Area
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="fade-in" style={{ height: "100%" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsAuthenticated(false)}
                    style={{ fontSize: 11, padding: "4px 10px" }}
                >
                    🔒 Blocca
                </button>
            </div>
            {children}
        </div>
    );
};
