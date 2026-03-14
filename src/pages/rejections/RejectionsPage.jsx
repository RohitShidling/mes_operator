import { useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { operatorApi } from '../../api/operatorApi';
import { machineApi } from '../../api/machineApi';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { getErrorMessage, formatDateTime } from '../../utils/helpers';
import { AlertOctagon, Plus, X, Upload, Image as ImageIcon, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RejectionsPage() {
  const { subscribe } = useSocket();
  const [loading, setLoading] = useState(true);
  const [rejections, setRejections] = useState([]);
  const [machines, setMachines] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    machine_id: '',
    work_order_id: '',
    rejection_reason: '',
    rejected_count: '',
    part_image: null,
  });
  const [imagePreview, setImagePreview] = useState(null);

  const fetchData = async () => {
    try {
      const [rejRes, machRes] = await Promise.allSettled([
        operatorApi.getAllRejections(),
        machineApi.getAll(),
      ]);
      if (rejRes.status === 'fulfilled') {
        const data = rejRes.value.data.data || rejRes.value.data || [];
        setRejections(Array.isArray(data) ? data : []);
      }
      if (machRes.status === 'fulfilled') {
        const data = machRes.value.data.data || machRes.value.data || [];
        setMachines(Array.isArray(data) ? data : []);
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
    const unsub = subscribe('rejection:reported', fetchData);
    return () => unsub?.();
  }, [subscribe]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({ ...prev, part_image: file }));
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.machine_id || !formData.rejection_reason || !formData.rejected_count) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('machine_id', formData.machine_id);
      if (formData.work_order_id) fd.append('work_order_id', formData.work_order_id);
      fd.append('rejection_reason', formData.rejection_reason);
      fd.append('rejected_count', formData.rejected_count);
      if (formData.part_image) fd.append('part_image', formData.part_image);

      await operatorApi.reportRejection(fd);
      toast.success('Rejection reported successfully');
      setShowModal(false);
      setFormData({ machine_id: '', work_order_id: '', rejection_reason: '', rejected_count: '', part_image: null });
      setImagePreview(null);
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading rejections..." />;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Part Rejections</h1>
          <p className="page-subtitle">Report and track rejected parts</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn btn-secondary" onClick={fetchData}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Report Rejection
          </button>
        </div>
      </div>

      {rejections.length === 0 ? (
        <EmptyState
          icon={AlertOctagon}
          title="No rejections reported"
          message="Click 'Report Rejection' to log a part rejection."
          action={
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={16} /> Report First Rejection
            </button>
          }
        />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Machine</th>
                <th>Work Order</th>
                <th>Reason</th>
                <th>Count</th>
                <th>Reported At</th>
              </tr>
            </thead>
            <tbody>
              {rejections.map((rej, idx) => (
                <tr key={rej.id || idx}>
                  <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {rej.machine_name || rej.machine_id}
                  </td>
                  <td>{rej.work_order_id || '—'}</td>
                  <td style={{ maxWidth: '300px' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      {rej.rejection_reason}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-danger">{rej.rejected_count} pcs</span>
                  </td>
                  <td style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                    {formatDateTime(rej.created_at || rej.reported_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Report Rejection Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Report Part Rejection</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="rej-machine">Machine *</label>
                <select
                  id="rej-machine"
                  value={formData.machine_id}
                  onChange={(e) => setFormData((p) => ({ ...p, machine_id: e.target.value }))}
                  required
                >
                  <option value="">Select Machine</option>
                  {machines.map((m) => (
                    <option key={m.machine_id} value={m.machine_id}>
                      {m.machine_name} ({m.machine_id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="rej-wo">Work Order (Optional)</label>
                <input
                  id="rej-wo"
                  type="text"
                  placeholder="e.g., WO-XXXXXXXX"
                  value={formData.work_order_id}
                  onChange={(e) => setFormData((p) => ({ ...p, work_order_id: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="rej-reason">Rejection Reason *</label>
                <textarea
                  id="rej-reason"
                  rows={3}
                  placeholder="Describe the reason for rejection..."
                  value={formData.rejection_reason}
                  onChange={(e) => setFormData((p) => ({ ...p, rejection_reason: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="rej-count">Rejected Count *</label>
                <input
                  id="rej-count"
                  type="number"
                  min="1"
                  placeholder="Number of rejected parts"
                  value={formData.rejected_count}
                  onChange={(e) => setFormData((p) => ({ ...p, rejected_count: e.target.value }))}
                  required
                />
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
                {imagePreview && (
                  <div style={{ marginTop: 'var(--space-3)', position: 'relative', display: 'inline-block' }}>
                    <img
                      src={imagePreview}
                      alt="Preview"
                      style={{
                        maxWidth: '200px',
                        maxHeight: '150px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.5)' }}
                      onClick={() => { setFormData((p) => ({ ...p, part_image: null })); setImagePreview(null); }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Report Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
