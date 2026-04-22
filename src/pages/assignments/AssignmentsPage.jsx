import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { operatorApi } from '../../api/operatorApi';
import { machineApi } from '../../api/machineApi';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import ConfirmModal from '../../components/common/ConfirmModal';
import { getErrorMessage, formatDateTime, bufferToImageUrl } from '../../utils/helpers';
import { Users, Plus, X, Link2, Unlink, RefreshCw, Monitor, Image as ImageIcon, AlertTriangle, Upload } from 'lucide-react';
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

  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingMachine, setRejectingMachine] = useState(null);
  const [reportingRejection, setReportingRejection] = useState(false);
  const [rejectionForm, setRejectionForm] = useState({
    rejected_count: 1,
    rejection_reason: '',
    work_order_id: '',
    part_image: null,
  });
  const [rejImagePreview, setRejImagePreview] = useState(null);

  // Rejections per machine
  const [machineRejections, setMachineRejections] = useState({});
  const [viewRejectionsForMachine, setViewRejectionsForMachine] = useState(null);

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

  // ===== REJECTION HANDLING =====
  const openRejectModal = (machine) => {
    setRejectingMachine(machine);
    setRejectionForm({ rejected_count: 1, rejection_reason: '', work_order_id: '', part_image: null });
    setRejImagePreview(null);
    setShowRejectModal(true);
  };

  const handleRejImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setRejectionForm((prev) => ({ ...prev, part_image: file }));
      const reader = new FileReader();
      reader.onload = (ev) => setRejImagePreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleReportRejection = async (e) => {
    e.preventDefault();
    if (!rejectionForm.rejection_reason) {
      toast.error('Please provide a rejection reason');
      return;
    }

    setReportingRejection(true);
    try {
      const fd = new FormData();
      fd.append('machine_id', rejectingMachine.machine_id);
      fd.append('rejected_count', rejectionForm.rejected_count);
      fd.append('rejection_reason', rejectionForm.rejection_reason);
      if (rejectionForm.work_order_id) fd.append('work_order_id', rejectionForm.work_order_id);
      if (rejectionForm.part_image) fd.append('part_image', rejectionForm.part_image);

      await operatorApi.reportRejection(fd);
      toast.success(`Rejection reported for ${rejectingMachine.machine_name}`);
      setShowRejectModal(false);
      setRejectingMachine(null);
      setRejectionForm({ rejected_count: 1, rejection_reason: '', work_order_id: '', part_image: null });
      setRejImagePreview(null);
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setReportingRejection(false);
    }
  };

  // View rejections for a machine
  const handleViewRejections = async (machine) => {
    try {
      const res = await operatorApi.getRejectionsByMachine(machine.machine_id);
      const data = res.data.data || res.data || [];
      setMachineRejections((prev) => ({ ...prev, [machine.machine_id]: Array.isArray(data) ? data : [] }));
      setViewRejectionsForMachine(machine);
    } catch (err) {
      toast.error(getErrorMessage(err));
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

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => navigate(`/machines/${m.machine_id}`)}
                    >
                      View
                    </button>
                    <button
                      className="btn btn-warning btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => openRejectModal(m)}
                    >
                      <AlertTriangle size={14} /> Raise Rejection
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

                  {/* View Rejections Link */}
                  <button
                    className="btn btn-ghost btn-sm w-full"
                    style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)' }}
                    onClick={() => handleViewRejections(m)}
                  >
                    <AlertTriangle size={12} /> View Rejections
                  </button>
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

      {/* ===== REPORT REJECTION MODAL ===== */}
      {showRejectModal && rejectingMachine && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: 'var(--color-danger)' }}>
                <AlertTriangle size={20} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
                Raise Rejection
              </h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowRejectModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{
              padding: 'var(--space-3)',
              background: 'var(--color-bg-tertiary)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-5)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
            }}>
              <Monitor size={18} style={{ color: 'var(--color-accent-primary)' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{rejectingMachine.machine_name}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{rejectingMachine.machine_id}</div>
              </div>
            </div>

            <form onSubmit={handleReportRejection}>
              <div className="form-group">
                <label htmlFor="rej-count">Rejected Quantity *</label>
                <input
                  id="rej-count"
                  type="number"
                  min="1"
                  value={rejectionForm.rejected_count}
                  onChange={(e) => setRejectionForm((p) => ({ ...p, rejected_count: parseInt(e.target.value) || 1 }))}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="rej-reason">Rejection Reason *</label>
                <textarea
                  id="rej-reason"
                  rows={3}
                  placeholder="Describe why parts were rejected..."
                  value={rejectionForm.rejection_reason}
                  onChange={(e) => setRejectionForm((p) => ({ ...p, rejection_reason: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="rej-wo">Work Order (Optional)</label>
                <input
                  id="rej-wo"
                  type="text"
                  placeholder="e.g., WO-XXXXXXXX"
                  value={rejectionForm.work_order_id}
                  onChange={(e) => setRejectionForm((p) => ({ ...p, work_order_id: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>Part Image (Optional)</label>
                <div className="file-input-wrapper">
                  <div className="file-input-label">
                    <Upload size={18} />
                    <span>{rejectionForm.part_image ? rejectionForm.part_image.name : 'Choose image file'}</span>
                  </div>
                  <input type="file" accept="image/*" onChange={handleRejImageChange} />
                </div>
                {rejImagePreview && (
                  <div style={{ marginTop: 'var(--space-3)', position: 'relative', display: 'inline-block' }}>
                    <img
                      src={rejImagePreview}
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
                      onClick={() => { setRejectionForm((p) => ({ ...p, part_image: null })); setRejImagePreview(null); }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger" disabled={reportingRejection}>
                  {reportingRejection ? 'Reporting...' : 'Submit Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== VIEW REJECTIONS MODAL ===== */}
      {viewRejectionsForMachine && (
        <div className="modal-overlay" onClick={() => setViewRejectionsForMachine(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3 className="modal-title">
                Rejections — {viewRejectionsForMachine.machine_name}
              </h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setViewRejectionsForMachine(null)}>
                <X size={18} />
              </button>
            </div>

            {(() => {
              const rejs = machineRejections[viewRejectionsForMachine.machine_id] || [];
              if (rejs.length === 0) {
                return (
                  <div style={{
                    textAlign: 'center', padding: 'var(--space-8)',
                    color: 'var(--color-text-muted)',
                  }}>
                    <AlertTriangle size={40} style={{ opacity: 0.3, marginBottom: 'var(--space-3)' }} />
                    <p>No rejections found for this machine.</p>
                  </div>
                );
              }

              const totalRej = rejs.reduce((sum, r) => sum + (r.rejected_count || 0), 0);

              return (
                <>
                  <div style={{
                    padding: 'var(--space-3)',
                    background: 'var(--color-danger-bg)',
                    border: '1px solid var(--color-danger-border)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--space-4)',
                    textAlign: 'center',
                  }}>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-danger)', fontWeight: 700 }}>
                      Total Rejected: {totalRej} pcs across {rejs.length} reports
                    </span>
                  </div>

                  <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {rejs.map((rej, idx) => {
                      const rejImgSrc = bufferToImageUrl(rej.part_image);
                      return (
                        <div key={rej.id || idx} style={{
                          padding: 'var(--space-4)',
                          background: 'var(--color-bg-tertiary)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border)',
                        }}>
                          <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-2)' }}>
                            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)' }}>
                              {rej.rejection_reason}
                            </span>
                            <span className="badge badge-danger">{rej.rejected_count} pcs</span>
                          </div>
                          {rej.work_order_id && (
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-accent-primary)', marginBottom: 'var(--space-2)' }}>
                              Work Order: {rej.work_order_id}
                            </div>
                          )}
                          {rejImgSrc && (
                            <img
                              src={rejImgSrc}
                              alt="Rejected part"
                              style={{
                                width: '100%',
                                maxHeight: '120px',
                                objectFit: 'cover',
                                borderRadius: 'var(--radius-sm)',
                                marginBottom: 'var(--space-2)',
                              }}
                            />
                          )}
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                            {rej.operator_name && <span>By: {rej.operator_name} · </span>}
                            {formatDateTime(rej.created_at)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
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
