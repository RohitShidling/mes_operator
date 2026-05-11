import { useEffect, useState } from 'react';
import { useSocket } from '../../context/SocketContext';
import { operatorApi } from '../../api/operatorApi';
import { machineApi } from '../../api/machineApi';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { getErrorMessage, formatDateTime, bufferToImageUrl } from '../../utils/helpers';
import { Upload, Image as ImageIcon, RefreshCw, X, AlertOctagon, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

const labelize = (value) => String(value || '').replaceAll('_', ' ');

/* ── Inline SVG icons for rejection reasons ── */
const IconBent = () => (
  <svg viewBox="0 0 80 80" fill="none">
    <ellipse cx="40" cy="55" rx="30" ry="10" fill="#c0c0c0" stroke="#999" strokeWidth="2"/>
    <ellipse cx="40" cy="52" rx="30" ry="10" fill="#d8d8d8" stroke="#aaa" strokeWidth="2"/>
    <path d="M10 52 Q25 30 45 48 Q60 62 70 52" stroke="#888" strokeWidth="3" fill="none" strokeLinecap="round"/>
    <ellipse cx="40" cy="42" rx="30" ry="8" fill="#e8e8e8" stroke="#bbb" strokeWidth="1.5"/>
  </svg>
);
const IconDamage = () => (
  <svg viewBox="0 0 80 80" fill="none">
    <rect x="10" y="20" width="60" height="40" rx="4" fill="#a0a8b0" stroke="#888" strokeWidth="2"/>
    <path d="M28 20 L22 45 L35 38 L30 60" stroke="#e74c3c" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M50 25 L55 50" stroke="#e74c3c" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <path d="M40 22 L38 58" stroke="#c0392b" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeDasharray="3 3"/>
  </svg>
);
const IconImpressionMark = () => (
  <svg viewBox="0 0 80 80" fill="none">
    <circle cx="40" cy="40" r="28" fill="#4a4a4a" stroke="#333" strokeWidth="2"/>
    <circle cx="40" cy="40" r="20" fill="#3a3a3a"/>
    <circle cx="40" cy="40" r="12" fill="#555"/>
    <ellipse cx="33" cy="33" rx="4" ry="2" fill="#6a6a6a" transform="rotate(-30 33 33)"/>
    <path d="M30 48 Q40 52 50 48" stroke="#666" strokeWidth="1.5" fill="none"/>
  </svg>
);
const IconWarping = () => (
  <svg viewBox="0 0 80 80" fill="none">
    <circle cx="40" cy="40" r="25" fill="#b0b0b0" stroke="#888" strokeWidth="2"/>
    <circle cx="40" cy="40" r="17" fill="#c8c8c8"/>
    <path d="M18 45 Q30 35 40 42 Q50 49 62 38" stroke="#777" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <ellipse cx="40" cy="40" rx="25" ry="6" fill="none" stroke="#999" strokeWidth="1.5" strokeDasharray="4 3"/>
  </svg>
);
const IconMeasurements = () => (
  <svg viewBox="0 0 80 80" fill="none">
    <ellipse cx="40" cy="48" rx="32" ry="10" fill="#e0e0e0" stroke="#bbb" strokeWidth="2"/>
    <ellipse cx="40" cy="38" rx="32" ry="10" fill="#ebebeb" stroke="#ccc" strokeWidth="1.5"/>
    <line x1="12" y1="38" x2="12" y2="20" stroke="#e74c3c" strokeWidth="2" strokeDasharray="3 3"/>
    <line x1="68" y1="38" x2="68" y2="15" stroke="#e74c3c" strokeWidth="2" strokeDasharray="3 3"/>
    <line x1="8" y1="18" x2="72" y2="13" stroke="#e74c3c" strokeWidth="2"/>
    <text x="38" y="11" fontSize="8" fill="#e74c3c" textAnchor="middle">≠</text>
  </svg>
);
const IconMisalignment = () => (
  <svg viewBox="0 0 80 80" fill="none">
    <circle cx="40" cy="40" r="26" fill="#c8c8c8" stroke="#aaa" strokeWidth="2"/>
    <circle cx="40" cy="40" r="18" fill="#b8b8b8"/>
    <circle cx="40" cy="40" r="8" fill="#a0a0a0"/>
    <line x1="40" y1="14" x2="40" y2="66" stroke="#e74c3c" strokeWidth="1.5" strokeDasharray="4 3"/>
    <line x1="14" y1="40" x2="66" y2="40" stroke="#e74c3c" strokeWidth="1.5" strokeDasharray="4 3"/>
    <circle cx="48" cy="34" r="5" fill="none" stroke="#e74c3c" strokeWidth="2"/>
  </svg>
);
const IconMaterialColor = () => (
  <svg viewBox="0 0 80 80" fill="none">
    <circle cx="40" cy="40" r="26" fill="#8B4513" stroke="#6b3410" strokeWidth="2"/>
    <circle cx="40" cy="40" r="18" fill="#A0522D"/>
    <circle cx="40" cy="40" r="10" fill="#CD853F"/>
    <path d="M26 28 Q40 22 54 28" stroke="#D2691E" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <ellipse cx="33" cy="36" rx="4" ry="2" fill="#654321" opacity="0.6"/>
  </svg>
);
const IconOxidationMark = () => (
  <svg viewBox="0 0 80 80" fill="none">
    <circle cx="40" cy="40" r="26" fill="#B8860B" stroke="#8B6914" strokeWidth="2"/>
    <circle cx="40" cy="40" r="18" fill="#DAA520"/>
    <circle cx="32" cy="35" r="6" fill="#CD7F32" opacity="0.7"/>
    <circle cx="48" cy="44" r="5" fill="#8B4513" opacity="0.6"/>
    <circle cx="38" cy="48" r="4" fill="#A0522D" opacity="0.5"/>
  </svg>
);
const IconBurr = () => (
  <svg viewBox="0 0 80 80" fill="none">
    <line x1="15" y1="55" x2="65" y2="55" stroke="#888" strokeWidth="8" strokeLinecap="round"/>
    <line x1="15" y1="48" x2="65" y2="48" stroke="#aaa" strokeWidth="3" strokeLinecap="round"/>
    <path d="M20 48 L17 38 M28 48 L25 35 M36 48 L34 33 M44 48 L42 35 M52 48 L50 38 M60 48 L58 40"
      stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconScratchMark = () => (
  <svg viewBox="0 0 80 80" fill="none">
    <circle cx="40" cy="40" r="26" fill="#3a3a3a" stroke="#222" strokeWidth="2"/>
    <circle cx="40" cy="40" r="18" fill="#444"/>
    <circle cx="40" cy="40" r="10" fill="#555"/>
    <path d="M25 30 Q35 40 30 55" stroke="#ddd" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <path d="M35 24 Q42 38 38 56" stroke="#ccc" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <path d="M48 28 Q44 42 48 55" stroke="#bbb" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
  </svg>
);
const IconOilContent = () => (
  <svg viewBox="0 0 80 80" fill="none">
    <circle cx="40" cy="40" r="26" fill="#7a5c0a" stroke="#5a4008" strokeWidth="2"/>
    <circle cx="40" cy="40" r="18" fill="#9a7a1a"/>
    <ellipse cx="35" cy="35" rx="8" ry="4" fill="#c8a820" opacity="0.7" transform="rotate(-20 35 35)"/>
    <ellipse cx="48" cy="46" rx="6" ry="3" fill="#d4b030" opacity="0.6" transform="rotate(15 48 46)"/>
    <path d="M28 50 Q40 45 52 50" stroke="#c8a820" strokeWidth="2" fill="none" strokeLinecap="round"/>
  </svg>
);

const REJECT_REASONS = [
  { id: 'BENT', label: 'Bent', Icon: IconBent },
  { id: 'DAMAGE', label: 'Damage', Icon: IconDamage },
  { id: 'IMPRESSION_MARK', label: 'Impression Mark', Icon: IconImpressionMark },
  { id: 'WARPING', label: 'Warping', Icon: IconWarping },
  { id: 'MEASUREMENTS_NOT_MATCHING', label: 'Measurements not matching', Icon: IconMeasurements },
  { id: 'MISALIGNMENT', label: 'Misalignment', Icon: IconMisalignment },
  { id: 'MATERIAL_COLOR', label: 'Material Color', Icon: IconMaterialColor },
  { id: 'OXIDATION_MARK', label: 'Oxidation Mark', Icon: IconOxidationMark },
  { id: 'BURR', label: 'Burr', Icon: IconBurr },
];

const REWORK_REASONS = [
  { id: 'SCRATCH_MARK', label: 'Scratch Marks', Icon: IconScratchMark },
  { id: 'OILY_CONTENT', label: 'Oil Content', Icon: IconOilContent },
];

const normalizeList = (response) => {
  const data = response?.data?.data || response?.data || [];
  return Array.isArray(data) ? data : [];
};

/** Catalogue: only show rejections that are still open (not yet rework-completed). */
const isOpenRejection = (rej) => {
  const s = rej?.rework_status;
  return !s || String(s).toUpperCase() === 'PENDING';
};

export default function RejectionsPage() {
  const { subscribe } = useSocket();
  const [loading, setLoading] = useState(true);
  const [rejections, setRejections] = useState([]);
  const [pendingReworks, setPendingReworks] = useState([]);
  const [machines, setMachines] = useState([]);
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reworking, setReworking] = useState({});
  const [reworkReasons, setReworkReasons] = useState(REWORK_REASONS);
  const [reworkUpdates, setReworkUpdates] = useState({});
  const [formData, setFormData] = useState({
    work_order_id: '',
    part_description: '',
    supervisor_name: '',
    rejection_reason: '',
    rework_reason: '',
    rejected_count: '',
    part_image: null,
  });
  const [imagePreview, setImagePreview] = useState(null);

  const fetchData = async (machineId = selectedMachineId) => {
    try {
      const [machRes, reworkReasonsRes] = await Promise.allSettled([
        machineApi.getAll(),
        operatorApi.getReworkReasons(),
      ]);
      if (machRes.status === 'fulfilled') {
        const data = normalizeList(machRes.value);
        setMachines(data);
        const defaultMachine = machineId || data[0]?.machine_id || '';
        if (!selectedMachineId && defaultMachine) {
          setSelectedMachineId(defaultMachine);
          machineId = defaultMachine;
        }
      }
      if (reworkReasonsRes.status === 'fulfilled') {
        const reasons = normalizeList(reworkReasonsRes.value);
        if (reasons.length) {
          // Map API string reasons to icon objects if needed
          const mappedReasons = reasons.map((r) => {
            if (typeof r === 'string') {
              const found = REWORK_REASONS.find((rr) => rr.id === r);
              return found || { id: r, label: labelize(r), Icon: IconOilContent };
            }
            return r;
          });
          setReworkReasons(mappedReasons);
        }
      }
      if (machineId) {
        const [rejRes, pendingRes] = await Promise.allSettled([
          operatorApi.getRejectionsByMachine(machineId),
          operatorApi.getPendingReworkByMachine(machineId),
        ]);
        if (rejRes.status === 'fulfilled') {
          const all = normalizeList(rejRes.value);
          setRejections(all.filter(isOpenRejection));
        }
        if (pendingRes.status === 'fulfilled') setPendingReworks(normalizeList(pendingRes.value));
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const unsubs = [
      subscribe('rejection:reported', () => fetchData(selectedMachineId)),
      subscribe('rejection:updated', () => fetchData(selectedMachineId)),
    ];
    return () => unsubs.forEach((u) => u?.());
  }, [subscribe, selectedMachineId]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormData((prev) => ({ ...prev, part_image: file }));
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMachineId || !formData.rejection_reason || !formData.rejected_count) {
      toast.error('Please fill all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      if (formData.work_order_id) fd.append('work_order_id', formData.work_order_id);
      fd.append('rejection_reason', formData.rejection_reason);
      if (formData.rework_reason) fd.append('rework_reason', formData.rework_reason);
      if (formData.part_description) fd.append('part_description', formData.part_description);
      if (formData.supervisor_name) fd.append('supervisor_name', formData.supervisor_name);
      fd.append('rejected_count', formData.rejected_count);
      if (formData.part_image) fd.append('part_image', formData.part_image);

      await operatorApi.reportRejectionByMachine(selectedMachineId, fd);
      toast.success('Rejection reported successfully');
      setFormData({
        work_order_id: '',
        part_description: '',
        supervisor_name: '',
        rejection_reason: '',
        rework_reason: '',
        rejected_count: '',
        part_image: null,
      });
      setImagePreview(null);
      fetchData(selectedMachineId);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkReworked = async (item) => {
    const current = reworkUpdates[item.id] || {};
    if (!current.rework_reason) {
      toast.error('Select rework reason');
      return;
    }
    setReworking((prev) => ({ ...prev, [item.id]: true }));
    try {
      await operatorApi.markReworkDone(item.id, {
        rework_reason: current.rework_reason,
        rework_comments: current.rework_comments || '',
      });
      toast.success('Rework complete — rejection cleared from open list');
      setReworkUpdates((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      fetchData(selectedMachineId);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setReworking((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  if (loading) return <LoadingSpinner text="Loading rejections..." />;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Rejection / Rework Piece Catalogue</h1>
          <p className="page-subtitle">Machine-specific part rejection and rework tracking</p>
        </div>
        <button className="btn btn-secondary" onClick={() => fetchData(selectedMachineId)}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="form-group" style={{ maxWidth: '420px', marginBottom: 'var(--space-4)' }}>
          <label htmlFor="rej-machine-select">Select Machine</label>
          <select
            id="rej-machine-select"
            value={selectedMachineId}
            onChange={(e) => {
              const machineId = e.target.value;
              setSelectedMachineId(machineId);
              fetchData(machineId);
            }}
          >
            <option value="">Select machine</option>
            {machines.map((m) => (
              <option key={m.machine_id} value={m.machine_id}>
                {m.machine_name} : {m.machine_id}
              </option>
            ))}
          </select>
        </div>

        <h3 style={{ marginBottom: 'var(--space-1)' }}>Open rejections (catalogue)</h3>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
          Rows disappear here after you mark rework complete in Pending Rework below.
        </p>
        {rejections.length === 0 ? (
          <EmptyState icon={AlertOctagon} title="No open rejections" message="No active rejection records for this machine, or all have been reworked." />
        ) : (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
            {rejections.map((rej, idx) => {
              const imageUrl = bufferToImageUrl(rej.part_image);
              return (
                <div key={rej.id || idx} className="card" style={{ margin: 0 }}>
                  <div style={{ height: '140px', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-tertiary)' }}>
                    {imageUrl ? <img src={imageUrl} alt={rej.part_description || 'Part'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={30} opacity={0.5} />}
                  </div>
                  <div style={{ fontWeight: 700 }}>{rej.part_description || 'Unnamed Part'}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>Reason: {labelize(rej.rejection_reason)}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Count: {rej.rejected_count || 0} pcs</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>{formatDateTime(rej.created_at || rej.reported_at)}</div>
                </div>
              );
            })}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div className="form-group mb-0">
              <label htmlFor="rej-wo">Work Order</label>
              <input id="rej-wo" value={formData.work_order_id} onChange={(e) => setFormData((p) => ({ ...p, work_order_id: e.target.value }))} />
            </div>
            <div className="form-group mb-0">
              <label htmlFor="rej-part-desc">Part Name / Description</label>
              <input id="rej-part-desc" value={formData.part_description} onChange={(e) => setFormData((p) => ({ ...p, part_description: e.target.value }))} />
            </div>
            <div className="form-group mb-0">
              <label htmlFor="rej-supervisor">Supervisor Name</label>
              <input id="rej-supervisor" value={formData.supervisor_name} onChange={(e) => setFormData((p) => ({ ...p, supervisor_name: e.target.value }))} />
            </div>
            <div className="form-group mb-0">
              <label htmlFor="rej-count">Rejected Count *</label>
              <input id="rej-count" type="number" min="1" value={formData.rejected_count} onChange={(e) => setFormData((p) => ({ ...p, rejected_count: e.target.value }))} required />
            </div>
          </div>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 600 }}>Reject Reasons</label>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))' }}>
              {REJECT_REASONS.map((reason) => {
                const Icon = reason.Icon;
                const isActive = formData.rejection_reason === reason.id;
                return (
                  <button
                    key={reason.id}
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, rejection_reason: isActive ? '' : reason.id }))}
                    style={{
                      border: isActive ? '2px solid var(--color-danger)' : '1px solid var(--color-border-primary)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-3)',
                      background: isActive ? 'var(--color-danger-bg)' : 'var(--color-bg-secondary)',
                      minHeight: '120px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 'var(--space-2)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon />
                    </div>
                    <span style={{ fontSize: 'var(--font-size-xs)', textAlign: 'center', fontWeight: isActive ? 600 : 400 }}>{reason.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 600 }}>Rework Reasons (optional)</label>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))' }}>
              {reworkReasons.map((reason) => {
                const Icon = reason.Icon;
                const isActive = formData.rework_reason === reason.id;
                return (
                  <button
                    key={reason.id}
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, rework_reason: isActive ? '' : reason.id }))}
                    style={{
                      border: isActive ? '2px solid var(--color-warning)' : '1px solid var(--color-border-primary)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-3)',
                      background: isActive ? 'var(--color-warning-bg)' : 'var(--color-bg-secondary)',
                      minHeight: '120px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 'var(--space-2)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon />
                    </div>
                    <span style={{ fontSize: 'var(--font-size-xs)', textAlign: 'center', fontWeight: isActive ? 600 : 400 }}>{reason.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-group">
            <label>Part Image (Optional)</label>
            <div className="file-input-wrapper">
              <div className="file-input-label">
                <Upload size={18} />
                <span>{formData.part_image ? formData.part_image.name : 'Choose image file'}</span>
              </div>
              <input type="file" accept="image/*" onChange={handleFileChange} />
            </div>
            {imagePreview && <img src={imagePreview} alt="Preview" style={{ marginTop: 'var(--space-3)', maxWidth: '220px', maxHeight: '160px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }} />}
          </div>

          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={submitting || !selectedMachineId}>
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 'var(--space-3)' }}>Pending Rework</h3>
        {pendingReworks.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="No pending rework" message="All rework parts are completed for selected machine." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Part</th>
                  <th>Reject Reason</th>
                  <th>Rework Reason</th>
                  <th>Comments</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingReworks.map((item) => {
                  const current = reworkUpdates[item.id] || {};
                  return (
                    <tr key={item.id}>
                      <td>{item.part_description || `Part #${item.id}`}</td>
                      <td>{labelize(item.rejection_reason)}</td>
                      <td>
                        <select value={current.rework_reason || ''} onChange={(e) => setReworkUpdates((prev) => ({ ...prev, [item.id]: { ...prev[item.id], rework_reason: e.target.value } }))}>
                          <option value="">Select reason</option>
                          {reworkReasons.map((reason) => <option key={reason.id} value={reason.id}>{reason.label}</option>)}
                        </select>
                      </td>
                      <td>
                        <input value={current.rework_comments || ''} onChange={(e) => setReworkUpdates((prev) => ({ ...prev, [item.id]: { ...prev[item.id], rework_comments: e.target.value } }))} placeholder="Rework comments" />
                      </td>
                      <td>
                        <button className="btn btn-success btn-sm" onClick={() => handleMarkReworked(item)} disabled={Boolean(reworking[item.id])}>
                          {reworking[item.id] ? '...' : 'Mark Reworked'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
