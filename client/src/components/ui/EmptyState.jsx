const EmptyState = ({ icon = "📭", title, description, action }) => (
    <div className="empty-state">
        <div className="empty-state-icon">{icon}</div>
        <p className="empty-state-title">{title}</p>
        {description && <p className="empty-state-desc">{description}</p>}
        {action}
    </div>
);

export default EmptyState;
