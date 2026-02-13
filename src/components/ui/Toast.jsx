import { useEffect } from "react";

export function Toast({ message, type = "success", onClose }) {
    useEffect(() => {
        const t = setTimeout(onClose, 3000);
        return () => clearTimeout(t);
    }, [onClose]);

    return (
        <div className={`toast ${type}`}>
            {type === "success" && <span style={{ color: "var(--success)" }}>✓</span>}
            {type === "error" && <span style={{ color: "var(--danger)" }}>✗</span>}
            {type === "warning" && <span style={{ color: "var(--warning)" }}>⚠</span>}
            {message}
        </div>
    );
}
