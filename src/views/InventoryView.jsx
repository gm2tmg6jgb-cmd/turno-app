import React, { useState } from 'react';

const InventoryView = ({ showToast }) => {
    const [activeTab, setActiveTab] = useState('DCT 300');

    const tabs = ['DCT 300', '8Fe', 'DCT Eco'];

    return (
        <div className="inventory-view" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Project Tabs */}
            <div className="card" style={{ padding: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                    {tabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                flex: 1,
                                padding: '10px 16px',
                                border: 'none',
                                borderRadius: 'var(--radius)',
                                background: activeTab === tab ? 'var(--primary)' : 'transparent',
                                color: activeTab === tab ? '#fff' : 'var(--text-secondary)',
                                fontWeight: 700,
                                fontSize: 13,
                                cursor: 'pointer',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="card" style={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', border: '1px dotted var(--border)' }}>
                <div style={{ textAlign: 'center', padding: 40 }}>
                    <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Inventario {activeTab}</h2>
                    <p style={{ color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto' }}>
                        In attesa delle specifiche della tabella per il progetto {activeTab}. Qui verranno visualizzati i componenti, le quantità e lo stato dello stock.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default InventoryView;
