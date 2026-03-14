import { useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { operatorApi } from '../../api/operatorApi';
import { machineApi } from '../../api/machineApi';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { getErrorMessage, formatDateTime, getSeverityClass } from '../../utils/helpers';
import { ShieldAlert, Plus, X, RefreshCw, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const SEVERITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const BD_STATUSES = ['REPORTED', 'ACKNOWLEDGED', 'IN_REPAIR', 'RESOLVED'];

export default function BreakdownsPage() {
  const { subscribe } = useSocket();
  const [loading, setLoading] = useState(true);
  const [breakdowns, setBreakdowns] = useState([]);
  const [machines, setMachines] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updating, setUpdating] = useState({});
  const [tab, setTab] = useState('active');
  const [formData, setFormData] = useState({
    machine_id: '',
    problem_description: '',
    severity: 'MEDIUM',
  });

  const fetchData = async () => {
    try {
      const [bdRes, machRes] = await Promise.allSettled([
        tab === 'active' ? operatorApi.getActiveBreakdowns() : operatorApi.getAllBreakdowns(),
        machineApi.getAll(),
      ]);
      if (bdRes.status === 'fulfilled') {
        const data = bdRes.value.data.data || bdRes.value.data || [];
        setBreakdowns(Array.isArray(data) ? data : []);
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
    setLoading(true);
    fetchData();
  }, [tab]);

  useEffect(() => {
    const unsubs = [
      subscribe('breakdown:reported', fetchData),
      subscribe('breakdown:updated', fetchData),
    ];
    return () => unsubs.forEach((u) => u?.());
  }, [subscribe]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.machine_id || !formData.problem_description) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      await operatorApi.reportBreakdown(formData);
      toast.success('Breakdown reported! Machine set to MAINTENANCE.');
      setShowModal(false);
      setFormData({ machine_id: '', problem_description: '', severity: 'MEDIUM' });
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async (breakdownId, newStatus) => {
    setUpdating((prev) => ({ ...prev, [breakdownId]: true }));
    try {
      await operatorApi.updateBreakdownStatus(breakdownId, newStatus);
      toast.success(`Breakdown status updated to ${newStatus}`);
      if (newStatus === 'RESOLVED') {
        toast.success('Machine status set back to NOT_STARTED');
      }
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUpdating((prev) => ({ ...prev, [breakdownId]: false }));
    }
  };

  if (loading) return <LoadingSpinner text="Loading breakdowns..." />;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Machine Breakdowns</h1>
          <p className="page-subtitle">Report and manage machine breakdown incidents</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn btn-secondary" onClick={fetchData}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn btn-danger" onClick={() => setShowModal(true)}>
            <AlertTriangle size={16} /> Report Breakdown
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'active' ? 'tab-active' : ''}`} onClick={() => setTab('active')}>
          Active Breakdowns
        </button>
        <button className={`tab ${tab === 'all' ? 'tab-active' : ''}`} onClick={() => setTab('all')}>
          All Breakdowns
        </button>
      </div>

      {breakdowns.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title={tab === 'active' ? 'No active breakdowns' : 'No breakdowns recorded'}
          message={tab === 'active' ? 'All machines are operating normally.' : 'No breakdown incidents have been reported yet.'}
        />
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' }}>
          {breakdowns.map((bd, idx) => (
            <div key={bd.id || idx} className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {bd.machine_name || bd.machine_id}
                  </h3>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    {bd.machine_id}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${getSeverityClass(bd.severity) === 'severity-low' ? 'badge-info' :
                    getSeverityClass(bd.severity) === 'severity-medium' ? 'badge-warning' :
                    'badge-danger'}`}>
                    {bd.severity}
                  </span>
                  <StatusBadge status={bd.status} />
                </div>
              </div>

              <p style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                lineHeight: '1.6',
                marginBottom: 'var(--space-4)',
                padding: 'var(--space-3)',
                background: 'var(--color-bg-tertiary)',
                borderRadius: 'var(--radius-md)',
              }}>
                {bd.problem_description}
              </p>

              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
                Reported: {formatDateTime(bd.reported_at || bd.created_at)}
              </div>

              {/* Status Update Actions */}
              {bd.status !== 'RESOLVED' && (
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {BD_STATUSES.filter((s) => s !== bd.status).map((s) => (
                    <button
                      key={s}
                      className={`btn btn-sm ${s === 'RESOLVED' ? 'btn-success' : 'btn-secondary'}`}
                      onClick={() => handleStatusUpdate(bd.id, s)}
                      disabled={updating[bd.id]}
                    >
                      {s.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Report Breakdown Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Report Machine Breakdown</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{
              padding: 'var(--space-3)',
              background: 'var(--color-warning-bg)',
              border: '1px solid var(--color-warning-border)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-5)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-warning)',
            }}>
              ⚠️ Reporting a breakdown will automatically set the machine to MAINTENANCE status.
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="bd-machine">Machine *</label>
                <select
                  id="bd-machine"
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
                <label htmlFor="bd-desc">Problem Description *</label>
                <textarea
                  id="bd-desc"
                  rows={4}
                  placeholder="Describe the breakdown issue in detail..."
                  value={formData.problem_description}
                  onChange={(e) => setFormData((p) => ({ ...p, problem_description: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label>Severity Level</label>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  {SEVERITY_LEVELS.map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      className={`btn btn-sm ${formData.severity === sev
                        ? (sev === 'LOW' ? 'btn-secondary' :
                           sev === 'MEDIUM' ? 'btn-warning' :
                           'btn-danger')
                        : 'btn-ghost'
                      }`}
                      onClick={() => setFormData((p) => ({ ...p, severity: sev }))}
                      style={{ flex: 1 }}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger" disabled={submitting}>
                  {submitting ? 'Reporting...' : 'Report Breakdown'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
