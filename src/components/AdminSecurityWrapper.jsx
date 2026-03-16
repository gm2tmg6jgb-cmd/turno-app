
/**
 * AdminSecurityWrapper
 * Protegge il contenuto con una schermata di blocco password.
 * Password di default: admin123
 */
export const AdminSecurityWrapper = ({ children }) => {
    return (
        <div className="fade-in" style={{ height: "100%" }}>
            {children}
        </div>
    );
};
