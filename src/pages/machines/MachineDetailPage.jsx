import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { machineApi } from '../../api/machineApi';
import { operatorApi } from '../../api/operatorApi';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { workOrderApi } from '../../api/workOrderApi';
import ConfirmModal from '../../components/common/ConfirmModal';
import { getErrorMessage, formatDateTime, bufferToImageUrl } from '../../utils/helpers';
import {
  ArrowLeft, Monitor, Activity, TrendingUp, Users, AlertTriangle, RefreshCw,
  Play, Pause, Square, Zap, StopCircle, Image as ImageIcon, Unlink, X
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
  const [allMachineData, setAllMachineData] = useState(null);
  const [visualization, setVisualization] = useState(null);
  const [operators, setOperators] = useState([]);
  const [breakdowns, setBreakdowns] = useState([]);
  const [rejections, setRejections] = useState([]);
  const [filter, setFilter] = useState('hourly');
  const [updating, setUpdating] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [showUnassignModal, setShowUnassignModal] = useState(false);
  const [unassigning, setUnassigning] = useState(false);
  const [allMachinesList, setAllMachinesList] = useState([]);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [reportingRejection, setReportingRejection] = useState(false);
  const [rejectionForm, setRejectionForm] = useState({
    machine_id: '',
    work_order_id: '',
    rejection_reason: '',
    rework_reason: '',
    part_description: '',
    supervisor_name: '',
    rejected_count: 1,
    part_image: null,
  });

  const fetchData = async () => {
    try {
      const [detailsRes, allMachinesRes, vizRes, opsRes, bdRes, rejRes] = await Promise.allSettled([
        machineApi.getDetails(machineId),
        machineApi.getAll(),
        machineApi.getVisualization(machineId, { filter }),
        operatorApi.getMachineOperators(machineId),
        operatorApi.getBreakdownsByMachine(machineId),
        operatorApi.getRejectionsByMachine(machineId),
      ]);

      if (detailsRes.status === 'fulfilled') {
        setMachine(detailsRes.value.data.data || detailsRes.value.data);
      }

      // Get the full machine data from /machines (has current_run, machine_image)
      if (allMachinesRes.status === 'fulfilled') {
        const allData = allMachinesRes.value.data.data || allMachinesRes.value.data || [];
        const allArr = Array.isArray(allData) ? allData : [];
        const found = allArr.find((m) => m.machine_id === machineId);
        setAllMachineData(found || null);
        setAllMachinesList(allArr);
      }

      if (vizRes.status === 'fulfilled') {
        const vizData = vizRes.value.data.data || vizRes.value.data;
        console.log('[MachineDetail] Visualization raw response:', vizData);
        setVisualization(vizData);
      }
      if (opsRes.status === 'fulfilled') {
        const ops = opsRes.value.data.data || opsRes.value.data || [];
        setOperators(Array.isArray(ops) ? ops : []);
      }
      if (bdRes.status === 'fulfilled') {
        const bds = bdRes.value.data.data || bdRes.value.data || [];
        setBreakdowns(Array.isArray(bds) ? bds : []);
      }
      if (rejRes.status === 'fulfilled') {
        const rejData = rejRes.value.data.data || rejRes.value.data || [];
        setRejections(Array.isArray(rejData) ? rejData : []);
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

  const handleIngest = async () => {
    if (machine?.status !== 'RUNNING') {
      toast.error('Machine must be RUNNING to add production count.');
      return;
    }

    const ingestPath = machine?.ingest_path || allMachineData?.ingest_path;
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

  const handleStopMachine = async () => {
    setStopping(true);
    try {
      await operatorApi.updateMachineStatus(machineId, 'NOT_STARTED');
      toast.success('Machine stopped and set to NOT_STARTED');
      fetchData();
    } catch (err) {
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

  const handleUnassignMachine = async () => {
    const currentRun = allMachineData?.current_run || machine?.current_run;
    const workOrderId = currentRun?.work_order_id || machine?.work_order_id;
    
    if (!workOrderId) return;
    
    setUnassigning(true);
    try {
      await workOrderApi.unassignMachine(workOrderId, machineId);
      toast.success(`Machine unassigned from Work Order ${workOrderId}`);
      setShowUnassignModal(false);
      fetchData();
    } catch (err) {
      const errRes = err.response?.data;
      if (errRes && errRes.statusCode === 404) {
         toast.error(errRes.message || 'Machine is not assigned to this work order');
      } else {
         toast.error(getErrorMessage(err));
      }
    } finally {
      setUnassigning(false);
    }
  };

  const handleReportRejection = async (e) => {
    e.preventDefault();
    if (!rejectionForm.machine_id || !rejectionForm.rejection_reason) {
      toast.error('Please fill in all required fields');
      return;
    }

    setReportingRejection(true);
    try {
      const formData = new FormData();
      formData.append('machine_id', rejectionForm.machine_id);
      formData.append('rejection_reason', rejectionForm.rejection_reason);
      formData.append('rejected_count', rejectionForm.rejected_count);
      
      if (rejectionForm.work_order_id) formData.append('work_order_id', rejectionForm.work_order_id);
      if (rejectionForm.rework_reason) formData.append('rework_reason', rejectionForm.rework_reason);
      if (rejectionForm.part_description) formData.append('part_description', rejectionForm.part_description);
      if (rejectionForm.supervisor_name) formData.append('supervisor_name', rejectionForm.supervisor_name);
      if (rejectionForm.part_image) formData.append('part_image', rejectionForm.part_image);

      await operatorApi.reportRejection(formData);
      toast.success('Rejection reported successfully');
      setShowRejectModal(false);
      setRejectionForm({
        machine_id: machineId,
        work_order_id: allMachineData?.current_run?.work_order_id || machine?.work_order_id || '',
        rejection_reason: '',
        rework_reason: '',
        part_description: '',
        supervisor_name: '',
        rejected_count: 1,
        part_image: null,
      });
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setReportingRejection(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading machine details..." />;
  if (!machine) return <div className="page-container"><p>Machine not found.</p></div>;

  // ===== RESOLVE PRODUCTION & REJECTION COUNTS =====
  // current_run comes from GET /machines (allMachineData)
  const currentRun = allMachineData?.current_run || machine?.current_run;
  const productionCount =
    currentRun?.total_count ??
    machine?.production_count ??
    allMachineData?.production_count ??
    0;

  // Rejection count: sum from rejections API or from current_run
  const rejectionCountFromRejections = Array.isArray(rejections)
    ? rejections.reduce((sum, r) => sum + (r.rejected_count || 0), 0)
    : 0;
  const rejectionCount =
    rejectionCountFromRejections ||
    currentRun?.rejected_count ||
    Number(machine?.total_rejected ?? machine?.rejection_count ?? allMachineData?.total_rejected ?? 0);

  // ===== MACHINE IMAGE =====
  const rawImage = allMachineData?.machine_image ?? machine?.machine_image;
  const machineImgSrc = bufferToImageUrl(rawImage);

  // ===== CHART DATA =====
  const hourlyData = visualization?.hourly || visualization?.hourly_data || visualization?.production_data?.hourly || [];
  const dailyData = visualization?.daily || visualization?.daily_data || visualization?.production_data?.daily || [];

  // If the visualization itself is an array, use it directly
  let chartData = filter === 'hourly' ? hourlyData : dailyData;
  if (!Array.isArray(chartData) && Array.isArray(visualization)) {
    chartData = visualization;
  }

  const formattedChart = Array.isArray(chartData) ? chartData.map((d) => ({
    label: d.hour !== undefined ? `${d.hour}:00` : d.date || d.day || d.label || d.time || '',
    count: d.production_count || d.count || d.total_count || d.value || 0,
  })) : [];

  const ingestPath = machine?.ingest_path || allMachineData?.ingest_path;

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
              {ingestPath && (
                <span style={{ marginLeft: '8px', color: 'var(--color-accent-primary)' }}>
                  · Ingest: {ingestPath}
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

      {/* Machine Image */}
      <div className="card mb-6">
        <div style={{
          width: '100%',
          height: '220px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-bg-tertiary)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid var(--color-border)',
        }}>
          {machineImgSrc ? (
            <img
              src={machineImgSrc}
              alt={machine.machine_name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div style={{
            display: machineImgSrc ? 'none' : 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--space-2)',
            color: 'var(--color-text-muted)',
          }}>
            <ImageIcon size={40} opacity={0.5} />
            <span style={{ fontSize: 'var(--font-size-sm)' }}>No Machine Image</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card mb-6">
        <div className="card-header">
          <h2 className="card-title">Quick Actions</h2>
        </div>
        <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
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

          <button
            className="btn btn-success btn-sm"
            onClick={handleIngest}
            disabled={ingesting || machine.status !== 'RUNNING'}
            title={machine.status !== 'RUNNING' ? 'Machine must be RUNNING to add production' : `Add production count +1 (Ingest: ${ingestPath || 'N/A'})`}
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

          {(allMachineData?.current_run?.work_order_id || machine?.current_run?.work_order_id || machine?.work_order_id) && (
             <>
                <div style={{ height: '28px', width: '1px', background: 'var(--color-border)' }} />
                <button
                  className="btn btn-warning btn-sm"
                  onClick={() => setShowUnassignModal(true)}
                >
                  <Unlink size={14} />
                  Unassign from Work Order
                </button>
             </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid mb-6">
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue"><Activity size={22} /></div>
          <div className="stat-info">
            <span className="stat-label">Production Count</span>
            <span className="stat-value">{productionCount}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-red"><AlertTriangle size={22} /></div>
          <div className="stat-info">
            <span className="stat-label">Rejections</span>
            <span className="stat-value">{rejectionCount}</span>
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
          <div style={{
            color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-8)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)',
          }}>
            <Activity size={40} style={{ opacity: 0.3 }} />
            <p>No visualization data available for this filter.</p>
            <p style={{ fontSize: 'var(--font-size-xs)' }}>
              Start production to see data here.
            </p>
          </div>
        )}
      </div>

      {/* Rejection History */}
      <div className="card mb-6">
        <div className="card-header">
          <div className="flex items-center gap-3">
            <h2 className="card-title">Rejection History</h2>
            {rejectionCount > 0 && <span className="badge badge-danger">{rejectionCount} total rejected</span>}
          </div>
          <button 
            className="btn btn-danger btn-sm" 
            onClick={() => {
              setRejectionForm(p => ({
                ...p, 
                machine_id: machineId,
                work_order_id: currentRun?.work_order_id || machine?.work_order_id || ''
              }));
              setShowRejectModal(true);
            }}
          >
            <AlertTriangle size={14} /> Report Rejection
          </button>
        </div>
        
        {rejections.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Reason</th>
                  <th>Count</th>
                  <th>Work Order</th>
                  <th>Reported By</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {rejections.map((rej, idx) => (
                  <tr key={rej.id || idx}>
                    <td style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
                      {rej.rejection_reason || '—'}
                    </td>
                    <td><span className="badge badge-danger">{rej.rejected_count} pcs</span></td>
                    <td style={{ color: 'var(--color-accent-primary)' }}>{rej.work_order_id || '—'}</td>
                    <td>{rej.operator_name || '—'}</td>
                    <td style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      {formatDateTime(rej.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>No rejections reported yet</p>
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

      <ConfirmModal
        isOpen={showUnassignModal}
        onClose={() => setShowUnassignModal(false)}
        onConfirm={handleUnassignMachine}
        title="Unassign Machine"
        message={`Are you sure you want to unassign this machine from Work Order ${allMachineData?.current_run?.work_order_id || machine?.current_run?.work_order_id || machine?.work_order_id}?`}
        confirmText="Unassign"
        variant="warning"
        loading={unassigning}
      />

      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: 'var(--color-danger)' }}>Report Rejection</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowRejectModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleReportRejection} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              
              <div className="form-group">
                <label htmlFor="rej-machine">Machine *</label>
                <select
                  id="rej-machine"
                  value={rejectionForm.machine_id}
                  onChange={(e) => setRejectionForm((p) => ({ ...p, machine_id: e.target.value }))}
                  required
                >
                  <option value="">-- Select Machine --</option>
                  {allMachinesList.map((m) => (
                    <option key={m.machine_id} value={m.machine_id}>
                      {m.machine_name} ({m.machine_id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="rej-wo">Work Order ID</label>
                <input
                  id="rej-wo"
                  type="text"
                  placeholder="Optional..."
                  value={rejectionForm.work_order_id}
                  onChange={(e) => setRejectionForm((p) => ({ ...p, work_order_id: e.target.value }))}
                />
              </div>

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
                  rows={2}
                  placeholder="Why was it rejected?"
                  value={rejectionForm.rejection_reason}
                  onChange={(e) => setRejectionForm((p) => ({ ...p, rejection_reason: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="rej-rework">Rework Reason</label>
                <textarea
                  id="rej-rework"
                  rows={2}
                  placeholder="Optional rework details..."
                  value={rejectionForm.rework_reason}
                  onChange={(e) => setRejectionForm((p) => ({ ...p, rework_reason: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="rej-part">Part Description</label>
                <input
                  id="rej-part"
                  type="text"
                  placeholder="Optional part description..."
                  value={rejectionForm.part_description}
                  onChange={(e) => setRejectionForm((p) => ({ ...p, part_description: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="rej-sup">Supervisor Name</label>
                <input
                  id="rej-sup"
                  type="text"
                  placeholder="Optional..."
                  value={rejectionForm.supervisor_name}
                  onChange={(e) => setRejectionForm((p) => ({ ...p, supervisor_name: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="rej-image">Evidence Image</label>
                <input
                  id="rej-image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setRejectionForm((p) => ({ ...p, part_image: e.target.files[0] }))}
                  style={{ padding: '8px', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)' }}
                />
              </div>

              <div className="modal-footer" style={{ marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger" disabled={reportingRejection}>
                  {reportingRejection ? 'Submitting...' : 'Submit Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
