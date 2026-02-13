import { Icons } from "./Icons";

export function Modal({ title, children, onClose, footer }) {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-title">{title}</div>
                    <button className="modal-close" onClick={onClose}>{Icons.x}</button>
                </div>
                {children}
                {footer && <div className="modal-footer">{footer}</div>}
            </div>
        </div>
    );
}
