/**
 * Format a date string to a readable format
 */
export function formatDate(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format date with time
 */
export function formatDateTime(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function timeAgo(dateString) {
  if (!dateString) return '—';
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now - date) / 1000);

  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'week', seconds: 604800 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
  ];

  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) {
      return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
    }
  }
  return 'Just now';
}

/**
 * Get status badge class based on status string
 */
export function getStatusBadgeClass(status) {
  if (!status) return 'badge-neutral';

  const s = status.toUpperCase();
  if (['RUNNING', 'COMPLETED', 'RESOLVED', 'ACTIVE'].includes(s)) return 'badge-success';
  if (['MAINTENANCE', 'IN_PROGRESS', 'IN_REPAIR', 'ACKNOWLEDGED'].includes(s)) return 'badge-warning';
  if (['STOPPED', 'REPORTED', 'CRITICAL', 'HIGH'].includes(s)) return 'badge-danger';
  if (['NOT_STARTED', 'PENDING', 'SKIPPED'].includes(s)) return 'badge-neutral';
  if (['LOW', 'MEDIUM'].includes(s)) return 'badge-info';
  return 'badge-neutral';
}

/**
 * Get severity color class
 */
export function getSeverityClass(severity) {
  if (!severity) return '';
  const s = severity.toUpperCase();
  if (s === 'LOW') return 'severity-low';
  if (s === 'MEDIUM') return 'severity-medium';
  if (s === 'HIGH') return 'severity-high';
  if (s === 'CRITICAL') return 'severity-critical';
  return '';
}

/**
 * Capitalize first letter of each word
 */
export function capitalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Truncate text to a max length
 */
export function truncateText(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text || '';
  return text.slice(0, maxLength) + '...';
}

/**
 * Generate initials from name
 */
export function getInitials(name) {
  if (!name) return 'OP';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Calculate percentage
 */
export function calcPercentage(current, total) {
  if (!total || total === 0) return 0;
  return Math.min(Math.round((current / total) * 100), 100);
}

/**
 * Extract error message from API error
 */
export function getErrorMessage(error) {
  if (typeof error === 'string') return error;
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.response?.data?.error) return error.response.data.error;
  if (error?.message) return error.message;
  return 'An unexpected error occurred';
}

/**
 * Convert MySQL Buffer/Array to base64 image URL
 */
export function bufferToImageUrl(imageBuffer) {
  if (!imageBuffer) return null;
  
  // If it's already a base64 string or URL, return it
  if (typeof imageBuffer === 'string' && (imageBuffer.startsWith('data:') || imageBuffer.startsWith('http'))) {
    return imageBuffer;
  }

  try {
    const data = imageBuffer.data ? imageBuffer.data : imageBuffer;
    if (!Array.isArray(data) && !(data instanceof Uint8Array)) return null;

    const base64 = btoa(
      new Uint8Array(data).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ''
      )
    );
    return `data:image/jpeg;base64,${base64}`;
  } catch (err) {
    console.error('Error converting image buffer:', err);
    return null;
  }
}
