const FormField = ({ label, required, hint, children, className = "" }) => (
    <div className={`form-field ${className}`}>
        {label && (
            <label>
                {label}
                {required && <span className="required">*</span>}
            </label>
        )}
        {children}
        {hint && <div className="hint">{hint}</div>}
    </div>
);

export const FormSection = ({ icon, title, color = "#eff6ff", children }) => (
    <div className="form-section">
        <div className="form-section-header">
            <div className="form-section-icon" style={{ background: color }}>{icon}</div>
            <span className="form-section-title">{title}</span>
        </div>
        {children}
    </div>
);

export default FormField;
