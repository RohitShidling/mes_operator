import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { machineApi } from '../../api/machineApi';
import { operatorApi } from '../../api/operatorApi';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { getErrorMessage, formatDateTime } from '../../utils/helpers';
import {
  ArrowLeft, Monitor, Activity, TrendingUp, Users, AlertTriangle, RefreshCw,
  Play, Pause, Square, Zap, StopCircle,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = [
  { value: 'RUNNING', label: 'Running', icon: Play, color: 'var(--color-success)' },
  { value: 'MAINTENANCE', label: 'Maintenance', icon: Pause, color: 'var(--color-warning)' },
  { value: 'NOT_STARTED', label: 'Not Started', icon: Square, color: 'var(--color-text-muted)' },
];

export default function MachineDetailPage() {
  const { machineId } = useParams();
  const navigate = useNavigate();
  const { subscribeMachine, unsubscribeMachine, subscribe } = useSocket();
  const [loading, setLoading] = useState(true);
  const [machine, setMachine] = useState(null);
  const [visualization, setVisualization] = useState(null);
  const [operators, setOperators] = useState([]);
  const [breakdowns, setBreakdowns] = useState([]);
  const [filter, setFilter] = useState('hourly');
  const [updating, setUpdating] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [stopping, setStopping] = useState(false);

  const fetchData = async () => {
    try {
      const [detailsRes, vizRes, opsRes, bdRes] = await Promise.allSettled([
        machineApi.getDetails(machineId),
        machineApi.getVisualization(machineId, { filter }),
        operatorApi.getMachineOperators(machineId),
        operatorApi.getBreakdownsByMachine(machineId),
      ]);

      if (detailsRes.status === 'fulfilled') {
        setMachine(detailsRes.value.data.data || detailsRes.value.data);
      }
      if (vizRes.status === 'fulfilled') {
        setVisualization(vizRes.value.data.data || vizRes.value.data);
      }
      if (opsRes.status === 'fulfilled') {
        const ops = opsRes.value.data.data || opsRes.value.data || [];
        setOperators(Array.isArray(ops) ? ops : []);
      }
      if (bdRes.status === 'fulfilled') {
        const bds = bdRes.value.data.data || bdRes.value.data || [];
        setBreakdowns(Array.isArray(bds) ? bds : []);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    subscribeMachine(machineId);
    return () => unsubscribeMachine(machineId);
  }, [machineId, filter]);

  useEffect(() => {
    const unsubs = [
      subscribe('machine:update', fetchData),
      subscribe('machine:status_changed', fetchData),
    ];
    return () => unsubs.forEach((u) => u?.());
  }, [subscribe]);

  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    try {
      await operatorApi.updateMachineStatus(machineId, newStatus);
      toast.success(`Machine status set to ${newStatus.replace(/_/g, ' ')}`);
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUpdating(false);
    }
  };

  // Ingest uses ingest_path (NOT machine_id)
  // e.g. POST /api/ingest/cnc-lathe-1
  // Only allowed when machine is RUNNING
  const handleIngest = async () => {
    if (machine?.status !== 'RUNNING') {
      toast.error('Machine must be RUNNING to add production count.');
      return;
    }

    const ingestPath = machine?.ingest_path;
    if (!ingestPath) {
      toast.error('Ingest path not configured for this machine.');
      return;
    }
    const pathId = ingestPath.replace(/^\//, '');

    setIngesting(true);
    try {
      await machineApi.ingestData(pathId);
      toast.success('Production count +1');
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIngesting(false);
    }
  };

  // Stop machine - first set status to NOT_STARTED, then call stop API
  const handleStopMachine = async () => {
    setStopping(true);
    try {
      // First try to set status to NOT_STARTED via operator API
      await operatorApi.updateMachineStatus(machineId, 'NOT_STARTED');
      toast.success('Machine stopped and set to NOT_STARTED');
      fetchData();
    } catch (err) {
      // If that fails, try the stop endpoint
      try {
        await machineApi.stopMachine(machineId);
        toast.success('Machine stopped');
        fetchData();
      } catch (err2) {
        toast.error(getErrorMessage(err2));
      }
    } finally {
      setStopping(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading machine details..." />;
  if (!machine) return <div className="page-container"><p>Machine not found.</p></div>;

  // Prepare chart data
  const hourlyData = visualization?.hourly || visualization?.hourly_data || [];
  const dailyData = visualization?.daily || visualization?.daily_data || [];
  const chartData = filter === 'hourly' ? hourlyData : dailyData;
  const formattedChart = Array.isArray(chartData) ? chartData.map((d) => ({
    label: d.hour !== undefined ? `${d.hour}:00` : d.date || d.day || '',
    count: d.production_count || d.count || 0,
  })) : [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <button className="btn btn-ghost btn-icon" onClick={() => navigate(-1)}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="page-title">{machine.machine_name || machineId}</h1>
            <p className="page-subtitle">
              {machine.machine_id}
              {machine.ingest_path && (
                <span style={{ marginLeft: '8px', color: 'var(--color-accent-primary)' }}>
                  · Ingest: {machine.ingest_path}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={machine.status} />
          <button className="btn btn-secondary btn-sm" onClick={fetchData}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card mb-6">
        <div className="card-header">
          <h2 className="card-title">Quick Actions</h2>
        </div>
        <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
          {/* Status Change Buttons */}
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`btn btn-sm ${machine.status === opt.value ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleStatusChange(opt.value)}
              disabled={machine.status === opt.value || updating}
            >
              <opt.icon size={14} />
              {opt.label}
            </button>
          ))}

          <div style={{ height: '28px', width: '1px', background: 'var(--color-border)' }} />

          {/* Production count - only works when machine is RUNNING */}
          <button
            className="btn btn-success btn-sm"
            onClick={handleIngest}
            disabled={ingesting || machine.status !== 'RUNNING'}
            title={machine.status !== 'RUNNING' ? 'Machine must be RUNNING to add production' : `Add production count +1 (Ingest: ${machine.ingest_path || 'N/A'})`}
          >
            <Zap size={14} />
            {ingesting ? 'Adding...' : 'Production +1'}
          </button>

          <button
            className="btn btn-danger btn-sm"
            onClick={handleStopMachine}
            disabled={stopping || machine.status === 'NOT_STARTED'}
          >
            <StopCircle size={14} />
            {stopping ? 'Stopping...' : 'Stop Machine'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid mb-6">
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue"><Activity size={22} /></div>
          <div className="stat-info">
            <span className="stat-label">Production Count</span>
            <span className="stat-value">{machine.production_count || 0}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-red"><AlertTriangle size={22} /></div>
          <div className="stat-info">
            <span className="stat-label">Rejections</span>
            <span className="stat-value">{machine.rejection_count || 0}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-green"><Users size={22} /></div>
          <div className="stat-info">
            <span className="stat-label">Operators</span>
            <span className="stat-value">{operators.length}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-yellow"><TrendingUp size={22} /></div>
          <div className="stat-info">
            <span className="stat-label">Breakdowns</span>
            <span className="stat-value">{breakdowns.length}</span>
          </div>
        </div>
      </div>

      {/* Visualization Chart */}
      <div className="card mb-6">
        <div className="card-header">
          <h2 className="card-title">Production Visualization</h2>
          <div className="tabs" style={{ marginBottom: 0 }}>
            <button className={`tab ${filter === 'hourly' ? 'tab-active' : ''}`} onClick={() => setFilter('hourly')}>Hourly</button>
            <button className={`tab ${filter === 'daily' ? 'tab-active' : ''}`} onClick={() => setFilter('daily')}>Daily</button>
          </div>
        </div>
        {formattedChart.length > 0 ? (
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <AreaChart data={formattedChart}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '10px',
                    color: 'var(--color-text-primary)',
                    fontSize: '13px',
                  }}
                />
                <Area type="monotone" dataKey="count" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCount)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-8)' }}>
            No visualization data available
          </p>
        )}
      </div>

      {/* Operators & Breakdowns */}
      <div className="grid grid-2">
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Assigned Operators</h3>
          {operators.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>No operators assigned</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {operators.map((op, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                  padding: 'var(--space-3)', background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'var(--color-accent-gradient)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontSize: 'var(--font-size-xs)', fontWeight: 700,
                  }}>
                    {(op.operator_name || op.username || 'O')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{op.operator_name || op.username}</div>
                    {op.mentor_name && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Mentor: {op.mentor_name}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Breakdown History</h3>
          {breakdowns.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>No breakdowns reported</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {breakdowns.slice(0, 5).map((bd, i) => (
                <div key={bd.id || i} style={{
                  padding: 'var(--space-3)', background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)',
                }}>
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {(bd.problem_description || '').length > 50
                        ? bd.problem_description.substring(0, 50) + '...'
                        : bd.problem_description}
                    </span>
                    <StatusBadge status={bd.status || bd.severity} />
                  </div>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    {formatDateTime(bd.reported_at || bd.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
