import React from 'react';
import { Icons } from '../components/ui/Icons';

export default function FermiView() {
    return (
        <div className="fade-in" style={{ padding: 20, textAlign: "center", marginTop: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{Icons.alert || "⚠️"}</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Gestione Fermi Macchina</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 16 }}>
                Funzionalità in arrivo. Qui potrai gestire i fermi macchina e le manutenzioni.
            </p>
        </div>
    );
}
