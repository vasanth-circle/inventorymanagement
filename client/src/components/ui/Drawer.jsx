import { useEffect } from "react";

const Drawer = ({ open, onClose, title, subtitle, size = "", children, footer }) => {
    useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => { document.body.style.overflow = ""; };
    }, [open]);

    if (!open) return null;

    return (
        <>
            <div className="drawer-overlay" onClick={onClose} />
            <div className={`drawer ${size === "sm" ? "drawer-sm" : size === "lg" ? "drawer-lg" : ""}`}>
                <div className="drawer-header">
                    <div>
                        <div className="drawer-title">{title}</div>
                        {subtitle && <div className="drawer-subtitle">{subtitle}</div>}
                    </div>
                    <button className="drawer-close" onClick={onClose} type="button">✕</button>
                </div>
                <div className="drawer-body custom-scrollbar">
                    {children}
                </div>
                {footer && (
                    <div className="drawer-footer">{footer}</div>
                )}
            </div>
        </>
    );
};

export default Drawer;
