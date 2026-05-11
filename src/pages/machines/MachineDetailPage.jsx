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
  ArrowLeft, Activity, TrendingUp, AlertTriangle, RefreshCw,
  Play, Pause, Square, Zap, StopCircle, Image as ImageIcon, Unlink
} from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = [
  { value: 'RUNNING', label: 'Running', icon: Play, color: 'var(--color-success)' },
  { value: 'MAINTENANCE', label: 'Maintenance', icon: Pause, color: 'var(--color-warning)' },
  { value: 'NOT_STARTED', label: 'Not Started', icon: Square, color: 'var(--color-text-muted)' },
];

const isOpenRejection = (rej) => {
  const s = rej?.rework_status;
  return !s || String(s).toUpperCase() === 'PENDING';
};

export default function MachineDetailPage() {
  const { machineId } = useParams();
  const navigate = useNavigate();
  const { subscribeMachine, unsubscribeMachine, subscribe } = useSocket();
  const [loading, setLoading] = useState(true);
  const [machine, setMachine] = useState(null);
  const [allMachineData, setAllMachineData] = useState(null);
  const [breakdowns, setBreakdowns] = useState([]);
  const [rejections, setRejections] = useState([]);
  const [updating, setUpdating] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [showUnassignModal, setShowUnassignModal] = useState(false);
  const [unassigning, setUnassigning] = useState(false);

  const fetchData = async () => {
    try {
      const [detailsRes, allMachinesRes, bdRes, rejRes] = await Promise.allSettled([
        machineApi.getDetails(machineId),
        machineApi.getAll(),
        operatorApi.getBreakdownsByMachine(machineId),
        operatorApi.getRejectionsByMachine(machineId),
      ]);

      if (detailsRes.status === 'fulfilled') {
        setMachine(detailsRes.value.data.data || detailsRes.value.data);
      }

      if (allMachinesRes.status === 'fulfilled') {
        const allData = allMachinesRes.value.data.data || allMachinesRes.value.data || [];
        const allArr = Array.isArray(allData) ? allData : [];
        const found = allArr.find((m) => m.machine_id === machineId);
        setAllMachineData(found || null);
      }

      if (bdRes.status === 'fulfilled') {
        const bds = bdRes.value.data.data || bdRes.value.data || [];
        setBreakdowns(Array.isArray(bds) ? bds : []);
      }
      if (rejRes.status === 'fulfilled') {
        const rejData = rejRes.value.data.data || rejRes.value.data || [];
        const arr = Array.isArray(rejData) ? rejData : [];
        setRejections(arr.filter(isOpenRejection));
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
  }, [machineId]);

  useEffect(() => {
    const onRejectionEvent = (payload) => {
      if (!payload?.machine_id || payload.machine_id === machineId) fetchData();
    };
    const unsubs = [
      subscribe('machine:update', fetchData),
      subscribe('machine:status_changed', fetchData),
      subscribe('rejection:reported', onRejectionEvent),
      subscribe('rejection:updated', onRejectionEvent),
    ];
    return () => unsubs.forEach((u) => u?.());
  }, [subscribe, machineId]);

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

  if (loading) return <LoadingSpinner text="Loading machine details..." />;
  if (!machine) return <div className="page-container"><p>Machine not found.</p></div>;

  const currentRun = allMachineData?.current_run || machine?.current_run;
  const productionCount =
    currentRun?.total_count ??
    machine?.production_count ??
    allMachineData?.production_count ??
    0;

  const rejectionCountFromRejections = Array.isArray(rejections)
    ? rejections.reduce((sum, r) => sum + (r.rejected_count || 0), 0)
    : 0;
  const rejectionCount =
    rejectionCountFromRejections ||
    currentRun?.rejected_count ||
    Number(machine?.total_rejected ?? machine?.rejection_count ?? allMachineData?.total_rejected ?? 0);

  const rawImage = allMachineData?.machine_image ?? machine?.machine_image;
  const machineImgSrc = bufferToImageUrl(rawImage);
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
            <span className="stat-label">Open rejections</span>
            <span className="stat-value">{rejectionCount}</span>
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

      <div className="card mb-6">
        <div className="card-header">
          <div className="flex items-center gap-3">
            <h2 className="card-title">Open rejection history</h2>
            {rejectionCount > 0 && <span className="badge badge-danger">{rejectionCount} pcs (open)</span>}
          </div>
        </div>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)' }}>
          Completed reworks are hidden here. Use Rejection &amp; Rework to resolve items.
        </p>

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
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>No open rejections for this machine</p>
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
    </div>
  );
}
