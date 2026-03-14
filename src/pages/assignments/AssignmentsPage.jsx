import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { operatorApi } from '../../api/operatorApi';
import { machineApi } from '../../api/machineApi';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import ConfirmModal from '../../components/common/ConfirmModal';
import { getErrorMessage, formatDateTime, bufferToImageUrl } from '../../utils/helpers';
import { Users, Plus, X, Link2, Unlink, RefreshCw, Monitor, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AssignmentsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [myMachines, setMyMachines] = useState([]);
  const [allAssignments, setAllAssignments] = useState([]);
  const [machines, setMachines] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showUnassignModal, setShowUnassignModal] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    machine_id: '',
    mentor_name: '',
  });

  const fetchData = async () => {
    try {
      const [myRes, allRes, machRes] = await Promise.allSettled([
        operatorApi.getMyMachines(),
        operatorApi.getAllAssignments(),
        machineApi.getAll(),
      ]);
      if (myRes.status === 'fulfilled') {
        const data = myRes.value.data.data || myRes.value.data || [];
        setMyMachines(Array.isArray(data) ? data : []);
      }
      if (allRes.status === 'fulfilled') {
        const data = allRes.value.data.data || allRes.value.data || [];
        setAllAssignments(Array.isArray(data) ? data : []);
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

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!formData.machine_id) {
      toast.error('Please select a machine');
      return;
    }

    setSubmitting(true);
    try {
      await operatorApi.assignToMachine(formData);
      toast.success('Successfully assigned to machine!');
      setShowAssignModal(false);
      setFormData({ machine_id: '', mentor_name: '' });
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassign = async () => {
    setSubmitting(true);
    try {
      await operatorApi.unassignFromMachine(selectedMachineId);
      toast.success('Unassigned from machine');
      setShowUnassignModal(false);
      setSelectedMachineId('');
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading assignments..." />;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Machine Assignments</h1>
          <p className="page-subtitle">Manage your machine assignments</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn btn-secondary" onClick={fetchData}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setShowAssignModal(true)}>
            <Link2 size={16} /> Assign to Machine
          </button>
        </div>
      </div>

      {/* My Machines */}
      <div className="card mb-6">
        <h2 className="card-title" style={{ marginBottom: 'var(--space-5)' }}>My Assigned Machines</h2>
        {myMachines.length === 0 ? (
          <EmptyState
            icon={Monitor}
            title="No machines assigned"
            message="Click 'Assign to Machine' to get started."
          />
        ) : (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {myMachines.map((m, idx) => {
              // Merge extra details (machine_image, current_run) from the all-machines list
              const detail = machines.find((d) => d.machine_id === m.machine_id);
              const merged = detail ? { ...detail, ...m } : m;

              const rawImage = merged.machine_image ?? detail?.machine_image;
              const imgSrc = bufferToImageUrl(rawImage);

              const run = merged.current_run ?? detail?.current_run;
              const productionCount = run?.total_count ?? merged.production_count ?? 0;
              const rejectionCount =
                run?.rejected_count ??
                Number(merged.total_rejected ?? merged.rejection_count ?? 0);

              return (
                <div key={m.machine_id || idx} className="card" style={{
                  background: 'var(--color-bg-tertiary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-3)',
                }}>
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--color-accent-primary-glow)',
                        color: 'var(--color-accent-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Monitor size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{m.machine_name}</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{m.machine_id}</div>
                      </div>
                    </div>
                    <StatusBadge status={m.status} />
                  </div>

                  {/* Machine Image */}
                  <div style={{
                    width: '100%',
                    height: '140px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-bg-secondary)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--color-border)',
                  }}>
                    {imgSrc ? (
                      <img
                        src={imgSrc}
                        alt={m.machine_name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div style={{
                      display: imgSrc ? 'none' : 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      color: 'var(--color-text-muted)',
                    }}>
                      <ImageIcon size={28} opacity={0.45} />
                      <span style={{ fontSize: 'var(--font-size-xs)' }}>No Image</span>
                    </div>
                  </div>

                  {/* Production & Rejections */}
                  <div style={{
                    display: 'flex',
                    gap: 'var(--space-4)',
                    padding: 'var(--space-2) 0',
                    borderTop: '1px solid var(--color-border)',
                    borderBottom: '1px solid var(--color-border)',
                  }}>
                    <div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Production</div>
                      <div style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', color: 'var(--color-text-primary)' }}>{productionCount}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Rejections</div>
                      <div style={{
                        fontWeight: 700,
                        fontSize: 'var(--font-size-lg)',
                        color: rejectionCount > 0 ? 'var(--color-danger)' : 'var(--color-text-primary)',
                      }}>{rejectionCount}</div>
                    </div>
                  </div>

                  {m.mentor_name && (
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                      Mentor: <span style={{ color: 'var(--color-text-secondary)' }}>{m.mentor_name}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => navigate(`/machines/${m.machine_id}`)}
                    >
                      View
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        setSelectedMachineId(m.machine_id);
                        setShowUnassignModal(true);
                      }}
                    >
                      <Unlink size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* All Assignments */}
      <div className="card">
        <h2 className="card-title" style={{ marginBottom: 'var(--space-5)' }}>All Assignments</h2>
        {allAssignments.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>No assignments found.</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Operator</th>
                  <th>Machine</th>
                  <th>Machine ID</th>
                  <th>Mentor</th>
                  <th>Assigned At</th>
                </tr>
              </thead>
              <tbody>
                {allAssignments.map((a, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {a.operator_name || a.username || `Operator ${a.operator_id}`}
                    </td>
                    <td>{a.machine_name}</td>
                    <td style={{ color: 'var(--color-accent-primary)' }}>{a.machine_id}</td>
                    <td>{a.mentor_name || '—'}</td>
                    <td style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      {formatDateTime(a.assigned_at || a.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Assign to Machine</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAssignModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAssign}>
              <div className="form-group">
                <label htmlFor="assign-machine">Machine *</label>
                <select
                  id="assign-machine"
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
                <label htmlFor="assign-mentor">Mentor Name (Optional)</label>
                <input
                  id="assign-mentor"
                  type="text"
                  placeholder="e.g., Suresh Kumar"
                  value={formData.mentor_name}
                  onChange={(e) => setFormData((p) => ({ ...p, mentor_name: e.target.value }))}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unassign Confirmation */}
      <ConfirmModal
        isOpen={showUnassignModal}
        onClose={() => setShowUnassignModal(false)}
        onConfirm={handleUnassign}
        title="Unassign from Machine"
        message="Are you sure you want to unassign yourself from this machine?"
        confirmText="Unassign"
        variant="danger"
        loading={submitting}
      />
    </div>
  );
}
