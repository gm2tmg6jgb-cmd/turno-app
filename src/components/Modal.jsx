/**
 * Modal — componente riutilizzabile per tutti i popup/dialog dell'app.
 *
 * Uso base:
 *   <Modal title="Titolo" subtitle="Sottotitolo" onClose={...} width={480}>
 *     ...contenuto...
 *     <div className="modal-footer">
 *       <button className="btn btn-secondary" onClick={onClose}>Annulla</button>
 *       <button className="btn btn-primary" onClick={onSave}>Salva</button>
 *     </div>
 *   </Modal>
 */
export default function Modal({ title, subtitle, onClose, children, width, zIndex }) {
    return (
        <div
            className="modal-backdrop"
            style={{ zIndex: zIndex || 2000 }}
            onClick={onClose}
        >
            <div
                className="modal-content"
                style={width ? { width } : {}}
                onClick={e => e.stopPropagation()}
            >
                {(title || onClose) && (
                    <div className="modal-header">
                        <div>
                            {title && <h3 className="modal-title">{title}</h3>}
                            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
                        </div>
                        {onClose && (
                            <button className="modal-close" onClick={onClose} aria-label="Chiudi">✕</button>
                        )}
                    </div>
                )}
                {children}
            </div>
        </div>
    );
}
