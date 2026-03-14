import { PackageOpen } from 'lucide-react';

export default function EmptyState({ icon: Icon = PackageOpen, title, message, action }) {
  return (
    <div className="empty-state">
      <Icon className="empty-state-icon" />
      <h3 className="empty-state-title">{title || 'No data found'}</h3>
      <p className="empty-state-text">{message || 'There is nothing to display here yet.'}</p>
      {action && <div style={{ marginTop: 'var(--space-5)' }}>{action}</div>}
    </div>
  );
}
