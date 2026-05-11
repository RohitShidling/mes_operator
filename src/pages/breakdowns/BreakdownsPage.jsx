import { useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { operatorApi } from '../../api/operatorApi';
import { machineApi } from '../../api/machineApi';
import { notificationApi } from '../../api/notificationApi';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import StatusBadge from '../../components/common/StatusBadge';
import { getErrorMessage, formatDateTime } from '../../utils/helpers';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

const SEVERITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const BD_STATUSES = ['REPORTED', 'IN_PROGRESS', 'RESOLVED'];

const getSeverityClass = (severity) => {
  const s = String(severity || '').toUpperCase();
  if (s === 'LOW') return 'severity-low';
  if (s === 'MEDIUM') return 'severity-medium';
  return 'severity-high';
};

const toDateTimeLocalValue = (date = new Date()) => {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
};

const toApiDateTime = (date) => {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const reasonLabel = (value) => value?.replaceAll('_', ' ') || '';

/* ── Inline SVG icons for breakdown reasons ── */
const IconToolChange = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="14" y1="50" x2="42" y2="22" stroke="#333" strokeWidth="5" strokeLinecap="round"/>
    <circle cx="46" cy="18" r="8" stroke="#333" strokeWidth="4" fill="none"/>
    <line x1="10" y1="54" x2="14" y2="50" stroke="#333" strokeWidth="5" strokeLinecap="round"/>
    <path d="M30 12 L20 22 L32 34 L42 24" stroke="#555" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="8" y="46" width="6" height="12" rx="2" transform="rotate(-45 8 46)" fill="#333"/>
  </svg>
);

const IconMachineBreakdown = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="20" stroke="#333" strokeWidth="4"/>
    <path d="M32 12 C20 20 20 44 32 52 C44 44 44 20 32 12Z" stroke="#555" strokeWidth="3" fill="none"/>
    <line x1="12" y1="32" x2="52" y2="32" stroke="#333" strokeWidth="3"/>
    <path d="M32 44 L28 54 L32 52 L36 54 Z" fill="#e74c3c"/>
    <circle cx="32" cy="38" r="3" fill="#e74c3c"/>
  </svg>
);

const IconMonthlyPM = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="28" cy="20" r="10" stroke="#333" strokeWidth="3.5" fill="none"/>
    <path d="M10 54 C10 42 46 42 46 54" stroke="#333" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
    <rect x="38" y="24" width="18" height="24" rx="2" stroke="#555" strokeWidth="3" fill="none"/>
    <line x1="42" y1="31" x2="52" y2="31" stroke="#555" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="42" y1="36" x2="52" y2="36" stroke="#555" strokeWidth="2.5" strokeLinecap="round"/>
    <polyline points="42,41 44,43 48,39" stroke="#27ae60" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconQCIssues = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="14" y="10" width="28" height="36" rx="3" stroke="#333" strokeWidth="3.5" fill="none"/>
    <line x1="20" y1="20" x2="36" y2="20" stroke="#555" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="20" y1="27" x2="36" y2="27" stroke="#555" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="20" y1="34" x2="30" y2="34" stroke="#555" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="46" cy="46" r="12" fill="#e74c3c"/>
    <line x1="46" y1="39" x2="46" y2="47" stroke="white" strokeWidth="3" strokeLinecap="round"/>
    <circle cx="46" cy="51" r="1.5" fill="white"/>
  </svg>
);

const IconWaitingRM = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="28" r="14" stroke="#333" strokeWidth="3.5" fill="none"/>
    <polyline points="32,20 32,28 38,32" stroke="#333" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="10" y="44" width="8" height="4" rx="1" fill="#555"/>
    <rect x="20" y="40" width="8" height="8" rx="1" fill="#555"/>
    <rect x="30" y="36" width="8" height="12" rx="1" fill="#555"/>
    <rect x="40" y="42" width="8" height="6" rx="1" fill="#555"/>
  </svg>
);

const IconPowerCut = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="20" stroke="#333" strokeWidth="3.5" fill="none"/>
    <line x1="20" y1="20" x2="44" y2="44" stroke="#e74c3c" strokeWidth="4" strokeLinecap="round"/>
    <line x1="44" y1="20" x2="20" y2="44" stroke="#e74c3c" strokeWidth="4" strokeLinecap="round"/>
  </svg>
);

const IconShiftChange = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="20" r="9" stroke="#333" strokeWidth="3.5" fill="none"/>
    <path d="M14 52 C14 38 50 38 50 52" stroke="#333" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
    <circle cx="32" cy="32" r="24" stroke="#e74c3c" strokeWidth="4" fill="none"/>
    <line x1="12" y1="12" x2="52" y2="52" stroke="#e74c3c" strokeWidth="4" strokeLinecap="round"/>
  </svg>
);

const IconNoOperator = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="20" r="9" stroke="#333" strokeWidth="3.5" fill="none"/>
    <path d="M14 52 C14 38 50 38 50 52" stroke="#333" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
    <circle cx="32" cy="32" r="24" stroke="#e74c3c" strokeWidth="4" fill="none"/>
    <line x1="12" y1="12" x2="52" y2="52" stroke="#e74c3c" strokeWidth="4" strokeLinecap="round"/>
  </svg>
);

const IconOther = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="22" stroke="#333" strokeWidth="3.5" fill="none"/>
    <line x1="20" y1="24" x2="44" y2="24" stroke="#333" strokeWidth="3" strokeLinecap="round"/>
    <line x1="20" y1="32" x2="44" y2="32" stroke="#333" strokeWidth="3" strokeLinecap="round"/>
    <line x1="20" y1="40" x2="36" y2="40" stroke="#333" strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

const BREAKDOWN_REASONS = [
  { id: 'TOOL_CHANGER', label: 'Tool changer', Icon: IconToolChange },
  { id: 'MACHINE_BREAKDOWN', label: 'Machine Breakdown', Icon: IconMachineBreakdown },
  { id: 'MONTHLY_PM', label: 'Monthly PM', Icon: IconMonthlyPM },
  { id: 'QC_ISSUES', label: 'QC Issues- correction', Icon: IconQCIssues },
  { id: 'WAITING_FOR_RM', label: 'Waiting for RM', Icon: IconWaitingRM },
  { id: 'POWER_CUT', label: 'Power Cut', Icon: IconPowerCut },
  { id: 'SHIFT_CHANGE', label: 'Shift change - No operator', Icon: IconShiftChange },
  { id: 'NO_OPERATOR', label: 'No Operator', Icon: IconNoOperator },
  { id: 'OTHERS', label: 'Other', Icon: IconOther },
];

export default function BreakdownsPage() {
  const { subscribe, emit } = useSocket();
  const [loading, setLoading] = useState(true);
  const [breakdowns, setBreakdowns] = useState([]);
  const [machines, setMachines] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [updating, setUpdating] = useState({});
  const [tab, setTab] = useState('active');
  const [breakdownReasons, setBreakdownReasons] = useState(BREAKDOWN_REASONS);
  const [formData, setFormData] = useState({
    machine_id: '',
    breakdown_reason: 'TOOL_CHANGER',
    start_time: toDateTimeLocalValue(),
    end_time: toDateTimeLocalValue(),
    comment: '',
    severity: 'MEDIUM',
  });

  const fetchData = async (currentTab = tab) => {
    try {
      const [bdRes, machRes] = await Promise.allSettled([
        currentTab === 'active' ? operatorApi.getActiveBreakdowns() : operatorApi.getAllBreakdowns(),
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
    fetchData(tab);
  }, [tab]);

  useEffect(() => {
    const unsubs = [
      subscribe('breakdown:reported', fetchData),
      subscribe('breakdown:updated', fetchData),
    ];
    return () => unsubs.forEach((u) => u?.());
  }, [subscribe]);

  useEffect(() => {
    const fetchReasons = async () => {
      try {
        const response = await operatorApi.getBreakdownReasons();
        const data = response?.data?.data || response?.data || [];
        if (Array.isArray(data) && data.length > 0) {
          // Map API string reasons to icon objects
          const mappedReasons = data.map((r) => {
            if (typeof r === 'string') {
              const found = BREAKDOWN_REASONS.find((br) => br.id === r);
              return found || { id: r, label: r.replace(/_/g, ' '), Icon: IconOther };
            }
            return r;
          });
          setBreakdownReasons(mappedReasons);
        }
      } catch (error) {
        // Keep fixed fallback reasons if API is unavailable.
        setBreakdownReasons(BREAKDOWN_REASONS);
      }
    };

    fetchReasons();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.machine_id || !formData.breakdown_reason || !formData.start_time || !formData.end_time) {
      toast.error('Please fill all required fields');
      return;
    }
    const startTime = new Date(formData.start_time);
    const endTime = new Date(formData.end_time);
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
      toast.error('Please enter valid start and end time');
      return;
    }
    if (endTime <= startTime) {
      toast.error('End time must be after start time');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        breakdown_reason: formData.breakdown_reason,
        start_time: toApiDateTime(startTime),
        end_time: toApiDateTime(endTime),
        comment: formData.comment?.trim() || '',
        severity: formData.severity,
      };
      const response = await operatorApi.reportBreakdownByMachine(formData.machine_id, payload);
      toast.success('Breakdown reported! Machine set to MAINTENANCE.');

      // Create notification for breakdown
      const machine = machines.find((m) => m.machine_id === formData.machine_id);
      const machineName = machine?.machine_name || formData.machine_id;
      const breakdownReason = reasonLabel(formData.breakdown_reason);

      try {
        await notificationApi.create({
          type: 'BREAKDOWN',
          title: `Machine Breakdown: ${machineName}`,
          message: `Machine ${machineName} (${formData.machine_id}) reported breakdown: ${breakdownReason}. Severity: ${formData.severity}`,
          machine_id: formData.machine_id,
          severity: formData.severity,
          reason: formData.breakdown_reason,
          breakdown_id: response?.data?.id || response?.data?.breakdown_id || null,
        });

        // Emit socket event for real-time notification
        emit('breakdown:reported', {
          machine_id: formData.machine_id,
          machine_name: machineName,
          reason: breakdownReason,
          severity: formData.severity,
          timestamp: new Date().toISOString(),
        });
      } catch (notifErr) {
        // Don't fail if notification creation fails
        console.error('Failed to create notification:', notifErr);
      }

      setFormData({
        machine_id: '',
        breakdown_reason: 'TOOL_CHANGER',
        start_time: toDateTimeLocalValue(),
        end_time: toDateTimeLocalValue(),
        comment: '',
        severity: 'MEDIUM',
      });
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
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>Machine Breakdown Details</h3>
            <button type="submit" className="btn btn-danger" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>

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
                  {m.machine_id} - {m.machine_name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div className="form-group mb-0">
              <label htmlFor="bd-start-time">Start Time *</label>
              <input
                id="bd-start-time"
                type="datetime-local"
                value={formData.start_time}
                onChange={(e) => setFormData((p) => ({ ...p, start_time: e.target.value }))}
                required
              />
            </div>
            <div className="form-group mb-0">
              <label htmlFor="bd-end-time">End Time *</label>
              <input
                id="bd-end-time"
                type="datetime-local"
                value={formData.end_time}
                min={formData.start_time}
                onChange={(e) => setFormData((p) => ({ ...p, end_time: e.target.value }))}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 600 }}>Machine Breakdown Reasons *</label>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
              {breakdownReasons.map((reason) => {
                const isSelected = formData.breakdown_reason === reason.id;
                const Icon = reason.Icon;
                return (
                  <button
                    key={reason.id}
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, breakdown_reason: reason.id }))}
                    style={{
                      border: isSelected ? '2px solid var(--color-danger)' : '1px solid var(--color-border-primary)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-4)',
                      background: isSelected ? 'var(--color-danger-bg)' : 'var(--color-bg-secondary)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 'var(--space-2)',
                      minHeight: '120px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ width: '72px', height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon />
                    </div>
                    <span style={{ fontSize: 'var(--font-size-xs)', textAlign: 'center', fontWeight: 600 }}>
                      {reason.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="bd-comment">Comment (optional)</label>
            <textarea
              id="bd-comment"
              rows={3}
              placeholder="Enter any additional details..."
              value={formData.comment}
              onChange={(e) => setFormData((p) => ({ ...p, comment: e.target.value }))}
            />
          </div>

          <div className="form-group mb-0">
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
        </form>
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
                {bd.comment || bd.problem_description || bd.breakdown_reason?.replaceAll('_', ' ') || 'No details'}
              </p>

              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)', display: 'grid', gap: 'var(--space-1)' }}>
                <span>Reason: {(bd.breakdown_reason || 'N/A').replaceAll('_', ' ')}</span>
                <span>Start: {formatDateTime(bd.start_time || bd.reported_at || bd.created_at)}</span>
                {bd.end_time && <span>End: {formatDateTime(bd.end_time)}</span>}
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

    </div>
  );
}
