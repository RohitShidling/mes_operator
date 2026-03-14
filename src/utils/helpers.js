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
 * Convert MySQL Buffer/Array/base64 to a usable image URL
 * Handles:
 *   - Already a data URI or http URL (pass-through)
 *   - Node.js Buffer serialised as { type: 'Buffer', data: [...] }
 *   - Plain JS arrays of byte numbers
 *   - Uint8Array / ArrayBuffer instances
 *   - Objects whose own keys are numeric strings (JSON-serialised Buffer)
 */
export function bufferToImageUrl(imageBuffer) {
  if (!imageBuffer) return null;

  // Already a usable URL or data URI
  if (typeof imageBuffer === 'string') {
    if (imageBuffer.startsWith('data:') || imageBuffer.startsWith('http')) {
      return imageBuffer;
    }
    // Bare base64 string without prefix
    try {
      return `data:image/jpeg;base64,${imageBuffer}`;
    } catch {
      return null;
    }
  }

  try {
    let bytes;

    if (imageBuffer instanceof Uint8Array || imageBuffer instanceof ArrayBuffer) {
      // Native typed array
      bytes = new Uint8Array(
        imageBuffer instanceof ArrayBuffer ? imageBuffer : imageBuffer.buffer
      );
    } else if (Array.isArray(imageBuffer)) {
      // Plain JS array of byte numbers
      bytes = new Uint8Array(imageBuffer);
    } else if (imageBuffer && typeof imageBuffer === 'object') {
      // { type: 'Buffer', data: [...] } — Node.js Buffer JSON form
      const inner = imageBuffer.data ?? imageBuffer;
      if (Array.isArray(inner)) {
        bytes = new Uint8Array(inner);
      } else {
        // Object with numeric string keys: { '0': 255, '1': 216, ... }
        const keys = Object.keys(inner).filter((k) => !isNaN(Number(k))).sort((a, b) => Number(a) - Number(b));
        if (keys.length === 0) return null;
        bytes = new Uint8Array(keys.map((k) => inner[k]));
      }
    } else {
      return null;
    }

    // Detect image type from magic bytes for a correct MIME type
    let mimeType = 'image/jpeg';
    if (bytes[0] === 0x89 && bytes[1] === 0x50) mimeType = 'image/png';
    else if (bytes[0] === 0x47 && bytes[1] === 0x49) mimeType = 'image/gif';
    else if (bytes[0] === 0x52 && bytes[1] === 0x49) mimeType = 'image/webp';

    // Convert bytes → base64 in chunks to avoid call-stack overflow on large images
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return `data:${mimeType};base64,${btoa(binary)}`;
  } catch (err) {
    console.error('Error converting image buffer:', err);
    return null;
  }
}
