import { useEffect, useState } from 'react';
import { useSocket } from '../../context/SocketContext';
import { operatorApi } from '../../api/operatorApi';
import { machineApi } from '../../api/machineApi';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { getErrorMessage, formatDateTime, bufferToImageUrl } from '../../utils/helpers';
import { AlertOctagon, Upload, Image as ImageIcon, RefreshCw, CheckCircle2 } from 'lucide-react';
import { FaCircle, FaCompressArrowsAlt, FaRulerCombined, FaBullseye, FaPalette, FaDotCircle, FaArrowsAlt, FaOilCan } from 'react-icons/fa';
import toast from 'react-hot-toast';

const FALLBACK_REJECTION_REASONS = [
  'BURR',
  'DAMAGE',
  'IMPRESSION_MARK',
  'WARPING',
  'MEASUREMENTS_NOT_MATCHING',
  'MISALIGNMENT',
  'MATERIAL_COLOR',
  'OXIDATION_MARK',
];
const FALLBACK_REWORK_REASONS = ['SCRATCH_MARK', 'OILY_CONTENT'];

const REASON_ICON_MAP = {
  BURR: FaCircle,
  DAMAGE: FaCompressArrowsAlt,
  IMPRESSION_MARK: FaDotCircle,
  WARPING: FaArrowsAlt,
  MEASUREMENTS_NOT_MATCHING: FaRulerCombined,
  MISALIGNMENT: FaBullseye,
  MATERIAL_COLOR: FaPalette,
  OXIDATION_MARK: FaCircle,
  SCRATCH_MARK: FaDotCircle,
  OILY_CONTENT: FaOilCan,
};

const normalizeList = (response) => {
  const data = response?.data?.data || response?.data || [];
  return Array.isArray(data) ? data : [];
};

const labelize = (value) => String(value || '').replaceAll('_', ' ');

export default function RejectionsPage() {
  const { subscribe } = useSocket();
  const [loading, setLoading] = useState(true);
  const [rejections, setRejections] = useState([]);
  const [pendingReworks, setPendingReworks] = useState([]);
  const [machines, setMachines] = useState([]);
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reworking, setReworking] = useState({});
  const [reworkReasons, setReworkReasons] = useState(FALLBACK_REWORK_REASONS);
  const [reworkUpdates, setReworkUpdates] = useState({});
  const [formData, setFormData] = useState({
    work_order_id: '',
    part_description: '',
    supervisor_name: '',
    rejection_reason: FALLBACK_REJECTION_REASONS[0],
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
        if (reasons.length) setReworkReasons(reasons);
      }
      if (machineId) {
        const [rejRes, pendingRes] = await Promise.allSettled([
          operatorApi.getRejectionsByMachine(machineId),
          operatorApi.getPendingReworkByMachine(machineId),
        ]);
        if (rejRes.status === 'fulfilled') setRejections(normalizeList(rejRes.value));
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
        rejection_reason: FALLBACK_REJECTION_REASONS[0],
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
      toast.success('Part marked as reworked');
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

        <h3 style={{ marginBottom: 'var(--space-3)' }}>Machine Rejected Parts</h3>
        {rejections.length === 0 ? (
          <EmptyState icon={AlertOctagon} title="No rejected parts" message="No rejection records found for selected machine." />
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
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
              {FALLBACK_REJECTION_REASONS.map((reason) => {
                const Icon = REASON_ICON_MAP[reason] || FaCircle;
                const isActive = formData.rejection_reason === reason;
                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, rejection_reason: reason }))}
                    style={{
                      border: isActive ? '2px solid var(--color-danger)' : '1px solid var(--color-border-primary)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-3)',
                      background: isActive ? 'var(--color-danger-bg)' : 'var(--color-bg-secondary)',
                      minHeight: '90px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 'var(--space-2)',
                    }}
                  >
                    <Icon size={24} />
                    <span style={{ fontSize: 'var(--font-size-xs)', textAlign: 'center' }}>{labelize(reason)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 600 }}>Rework Reasons (optional)</label>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
              {reworkReasons.map((reason) => {
                const Icon = REASON_ICON_MAP[reason] || FaCircle;
                const isActive = formData.rework_reason === reason;
                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, rework_reason: isActive ? '' : reason }))}
                    style={{
                      border: isActive ? '2px solid var(--color-warning)' : '1px solid var(--color-border-primary)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-3)',
                      background: isActive ? 'var(--color-warning-bg)' : 'var(--color-bg-secondary)',
                      minHeight: '80px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 'var(--space-2)',
                    }}
                  >
                    <Icon size={22} />
                    <span style={{ fontSize: 'var(--font-size-xs)', textAlign: 'center' }}>{labelize(reason)}</span>
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
                          {reworkReasons.map((reason) => <option key={reason} value={reason}>{labelize(reason)}</option>)}
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
