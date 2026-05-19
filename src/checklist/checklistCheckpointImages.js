/**
 * Checklist reference images — frontend only (never use API `image` blobs).
 * Files live in operator `public/img/` (see filenames there).
 */

function publicImgUrl(filename) {
  const base = import.meta.env.BASE_URL || '/';
  const trimmed = String(filename || '').replace(/^\//, '');
  if (!trimmed) return '';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  const encoded = trimmed.split('/').map((part) => encodeURIComponent(part)).join('/');
  return `${prefix}img/${encoded}`;
}

function normalizeCheckpointKey(checkpoint = '') {
  return checkpoint
    .trim()
    .toLowerCase()
    .replace(/\u00a0/g, ' ')
    .replace(/\ufeff/g, '')
    .replace(/\u2013|\u2011|\u2014/g, '-')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** ACPL press daily check sheet — maps 1:1 to files in public/img */
const pressCleanliness = publicImgUrl('press.png');
const pressSafety = publicImgUrl('safety.png');
const pressLubrication = publicImgUrl('lubrication.png');
const pressHydraulics = publicImgUrl('warning.png');
const pressCoolingWater = publicImgUrl('water pressure.png');
const pressLeakages = publicImgUrl('water lekage.png');
const pressToolMapping = publicImgUrl('tools.png');
const pressOperation = publicImgUrl('emergency.jpg');

const EXACT_CHECKPOINT_IMAGE = {
  cleanliness: pressCleanliness,
  safety: pressSafety,
  lubrication: pressLubrication,
  hydraulics: pressHydraulics,
  'cooling water': pressCoolingWater,
  leakages: pressLeakages,
  'tool mapping': pressToolMapping,
  operation: pressOperation,
  // Generic / alternate templates (legacy DB names)
  'work area and machine clean': pressCleanliness,
  'safety guards and interlocks': pressSafety,
  'coolant / lubrication level': pressLubrication,
  'first-off dimension check': pressOperation,
  'tooling and fixtures secure': pressToolMapping,
  'end of shift handover': pressOperation,
};

/** Longer phrases first */
const KEYWORD_CHECKPOINT_IMAGES = [
  ['cooling water', pressCoolingWater],
  ['water pressure', pressCoolingWater],
  ['water lekage', pressLeakages],
  ['water leakage', pressLeakages],
  ['tool mapping', pressToolMapping],
  ['tool_maping', pressToolMapping],
  ['cleanliness', pressCleanliness],
  ['cleanness', pressCleanliness],
  ['work area', pressCleanliness],
  ['machine clean', pressCleanliness],
  ['hydraulics', pressHydraulics],
  ['hydraulic', pressHydraulics],
  ['lubrication', pressLubrication],
  ['coolant', pressLubrication],
  ['interlocks', pressSafety],
  ['emergency', pressSafety],
  ['guards', pressSafety],
  ['leakages', pressLeakages],
  ['leakage', pressLeakages],
  ['leak', pressLeakages],
  ['operation', pressOperation],
  ['first-off', pressOperation],
  ['first off', pressOperation],
  ['dimension', pressOperation],
  ['handover', pressOperation],
  ['tooling', pressToolMapping],
  ['fixtures', pressToolMapping],
  ['tools', pressToolMapping],
  ['press', pressCleanliness],
  ['safety', pressSafety],
  ['warning', pressHydraulics],
];

export function getCheckpointImageUrl(checkpoint = '') {
  const norm = normalizeCheckpointKey(checkpoint);
  if (!norm) return null;
  if (EXACT_CHECKPOINT_IMAGE[norm]) return EXACT_CHECKPOINT_IMAGE[norm];
  for (const [keyword, url] of KEYWORD_CHECKPOINT_IMAGES) {
    if (norm.includes(keyword)) return url;
  }
  return null;
}

export function getCheckpointImageFallbackUrl() {
  return null;
}
