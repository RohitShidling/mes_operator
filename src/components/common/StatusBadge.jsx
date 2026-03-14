import { getStatusBadgeClass } from '../../utils/helpers';

export default function StatusBadge({ status, showDot = true }) {
  if (!status) return null;

  const badgeClass = getStatusBadgeClass(status);
  const displayText = status.replace(/_/g, ' ');

  return (
    <span className={`badge ${badgeClass}`}>
      {showDot && <span className="badge-dot" />}
      {displayText}
    </span>
  );
}
