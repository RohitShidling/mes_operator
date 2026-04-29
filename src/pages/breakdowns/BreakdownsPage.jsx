import { useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { operatorApi } from '../../api/operatorApi';
import { machineApi } from '../../api/machineApi';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { getErrorMessage, formatDateTime, getSeverityClass } from '../../utils/helpers';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import {
  FaToolbox,
  FaCog,
  FaCalendarCheck,
  FaClipboardCheck,
  FaHourglassHalf,
  FaBolt,
  FaUserSlash,
  FaEllipsisH,
} from 'react-icons/fa';
import toast from 'react-hot-toast';

const SEVERITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const BD_STATUSES = ['REPORTED', 'ACKNOWLEDGED', 'IN_REPAIR', 'RESOLVED'];
const FALLBACK_BREAKDOWN_REASONS = [
  'TOOL_CHANGER',
  'MACHINE_BREAKDOWN',
  'MONTHLY_PM',
  'QC_ISSUES',
  'WAITING_FOR_RM',
  'POWER_CUT',
  'SHIFT_CHANGE',
  'NO_OPERATOR',
  'OTHERS',
];

const toDateTimeLocalValue = (date = new Date()) => {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
};

const toApiDateTime = (date) => {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const reasonLabel = (value) => value?.replaceAll('_', ' ') || '';

const REASON_ICON_MAP = {
  TOOL_CHANGER: FaToolbox,
  MACHINE_BREAKDOWN: FaCog,
  MONTHLY_PM: FaCalendarCheck,
  QC_ISSUES: FaClipboardCheck,
  WAITING_FOR_RM: FaHourglassHalf,
  POWER_CUT: FaBolt,
  SHIFT_CHANGE: FaUserSlash,
  NO_OPERATOR: FaUserSlash,
  OTHERS: FaEllipsisH,
};

export default function BreakdownsPage() {
  const { subscribe } = useSocket();
  const [loading, setLoading] = useState(true);
  const [breakdowns, setBreakdowns] = useState([]);
  const [machines, setMachines] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [updating, setUpdating] = useState({});
  const [tab, setTab] = useState('active');
  const [breakdownReasons, setBreakdownReasons] = useState(FALLBACK_BREAKDOWN_REASONS);
  const [formData, setFormData] = useState({
    machine_id: '',
    breakdown_reason: 'TOOL_CHANGER',
    start_time: toDateTimeLocalValue(),
    end_time: toDateTimeLocalValue(),
    comment: '',
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

  useEffect(() => {
    const fetchReasons = async () => {
      try {
        const response = await operatorApi.getBreakdownReasons();
        const data = response?.data?.data || response?.data || [];
        if (Array.isArray(data) && data.length > 0) {
          setBreakdownReasons(data);
        }
      } catch (error) {
        // Keep fixed fallback reasons if API is unavailable.
        setBreakdownReasons(FALLBACK_BREAKDOWN_REASONS);
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
      await operatorApi.reportBreakdownByMachine(formData.machine_id, payload);
      toast.success('Breakdown reported! Machine set to MAINTENANCE.');
      setFormData({
        machine_id: '',
        breakdown_reason: breakdownReasons[0] || 'TOOL_CHANGER',
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
                const Icon = REASON_ICON_MAP[reason] || FaCog;
                const isSelected = formData.breakdown_reason === reason;
                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, breakdown_reason: reason }))}
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
                      minHeight: '96px',
                      cursor: 'pointer',
                    }}
                  >
                    <Icon size={26} />
                    <span style={{ fontSize: 'var(--font-size-xs)', textAlign: 'center', fontWeight: 600 }}>
                      {reasonLabel(reason)}
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
