import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { operatorApi } from '../../api/operatorApi';
import { machineApi } from '../../api/machineApi';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { getErrorMessage, bufferToImageUrl } from '../../utils/helpers';
import { Monitor, Play, Pause, Square, RefreshCw, Zap, Search, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import './MachineChecklistPage.css';

const STATUS_OPTIONS = [
  { value: 'RUNNING', label: 'Running', icon: Play, color: 'var(--color-success)' },
  { value: 'MAINTENANCE', label: 'Maintenance', icon: Pause, color: 'var(--color-warning)' },
  { value: 'NOT_STARTED', label: 'Not Started', icon: Square, color: 'var(--color-text-muted)' },
];

export default function MachineChecklistPage() {
  const navigate = useNavigate();
  const { subscribe } = useSocket();
  const [loading, setLoading] = useState(true);
  const [machines, setMachines] = useState([]);
  const [allMachineDetails, setAllMachineDetails] = useState([]);
  const [updating, setUpdating] = useState({});
  const [ingesting, setIngesting] = useState({});
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const fetchChecklist = async () => {
    try {
      // Fetch both checklist and all machine details (to get ingest_path)
      const [checklistRes, allRes] = await Promise.allSettled([
        operatorApi.getChecklist(),
        machineApi.getAll(),
      ]);

      const checklistData = checklistRes.status === 'fulfilled'
        ? (checklistRes.value.data.data || checklistRes.value.data || [])
        : [];
      const allData = allRes.status === 'fulfilled'
        ? (allRes.value.data.data || allRes.value.data || [])
        : [];

      const allArr = Array.isArray(allData) ? allData : [];
      setAllMachineDetails(allArr);

      // Merge allMachines data (machine_image, ingest_path, current_run) into each checklist item
      const merged = (Array.isArray(checklistData) ? checklistData : []).map((m) => {
        const detail = allArr.find((d) => d.machine_id === m.machine_id);
        return detail ? { ...detail, ...m } : m;
      });
      setMachines(merged);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChecklist();
  }, []);

  useEffect(() => {
    const unsubs = [
      subscribe('machine:status_changed', fetchChecklist),
      subscribe('machine:update', fetchChecklist),
    ];
    return () => unsubs.forEach((u) => u?.());
  }, [subscribe]);

  const handleStatusChange = async (machineId, newStatus) => {
    setUpdating((prev) => ({ ...prev, [machineId]: true }));
    try {
      await operatorApi.updateMachineStatus(machineId, newStatus);
      toast.success(`Machine status updated to ${newStatus.replace(/_/g, ' ')}`);
      fetchChecklist();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUpdating((prev) => ({ ...prev, [machineId]: false }));
    }
  };

  // Use ingest_path (NOT machine_id) to hit POST /api/ingest/<ingest_path>
  // Only allowed when machine is RUNNING
  const handleIngest = async (machine) => {
    // Block if machine is not running
    if (machine.status !== 'RUNNING') {
      toast.error('Machine must be RUNNING to add production count.');
      return;
    }

    // Find the ingest_path from allMachineDetails or from machine object
    const fullMachine = allMachineDetails.find((m) => m.machine_id === machine.machine_id);
    const ingestPath = fullMachine?.ingest_path || machine.ingest_path;

    if (!ingestPath) {
      toast.error('Ingest path not found. Please check machine configuration.');
      return;
    }

    // Remove leading slash to get the path ID
    const pathId = ingestPath.replace(/^\//, '');

    setIngesting((prev) => ({ ...prev, [machine.machine_id]: true }));
    try {
      await machineApi.ingestData(pathId);
      toast.success(`Production +1 for ${machine.machine_name}`);
      fetchChecklist();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIngesting((prev) => ({ ...prev, [machine.machine_id]: false }));
    }
  };

  const filteredMachines = machines.filter((m) => {
    const matchesFilter = filter === 'ALL' || m.status === filter;
    const matchesSearch = !search ||
      m.machine_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.machine_id?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (loading) return <LoadingSpinner text="Loading machine checklist..." />;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Machine Checklist</h1>
          <p className="page-subtitle">View and update machine statuses, track production</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchChecklist}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: '400px', marginBottom: 'var(--space-4)' }}>
        <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
        <input
          type="text"
          placeholder="Search machines..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: '40px' }}
        />
      </div>

      {/* Filter Tabs */}
      <div className="tabs">
        {['ALL', 'RUNNING', 'MAINTENANCE', 'NOT_STARTED'].map((s) => (
          <button
            key={s}
            className={`tab ${filter === s ? 'tab-active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s.replace(/_/g, ' ')}
            <span className="checklist-tab-count">
              {s === 'ALL' ? machines.length : machines.filter((m) => m.status === s).length}
            </span>
          </button>
        ))}
      </div>

      {filteredMachines.length === 0 ? (
        <EmptyState
          icon={Monitor}
          title="No machines found"
          message={filter === 'ALL' ? 'No machines are available in the system.' : `No machines with status "${filter.replace(/_/g, ' ')}".`}
        />
      ) : (
        <div className="checklist-grid">
          {filteredMachines.map((machine) => {
            // Resolve display values — ChecklistPage merges allMachineDetails into machines,
            // so machine already has machine_image, ingest_path and current_run.
            const fullMachine = allMachineDetails.find((m) => m.machine_id === machine.machine_id);
            const ingestPath = machine.ingest_path || fullMachine?.ingest_path || 'N/A';

            // Image: field is machine_image (byte array from API)
            const rawImage = machine.machine_image ?? fullMachine?.machine_image;

            // Production & rejection counts
            const run = machine.current_run ?? fullMachine?.current_run;
            const productionCount =
              run?.total_count ??
              machine.production_count ??
              fullMachine?.production_count ??
              0;
            const rejectionCount =
              run?.rejected_count ??
              Number(machine.total_rejected ?? fullMachine?.total_rejected ?? machine.rejection_count ?? 0);

            return (
              <div key={machine.machine_id} className="checklist-card card">
                <div className="checklist-card-header">
                  <div className="checklist-machine-info">
                    <div className="checklist-machine-icon">
                      <Monitor size={20} />
                    </div>
                    <div>
                      <h3 className="checklist-machine-name">{machine.machine_name}</h3>
                      <span className="checklist-machine-id">{machine.machine_id}</span>
                      <div style={{ fontSize: '10px', color: 'var(--color-accent-primary)', marginTop: '2px' }}>
                        Path: {ingestPath}
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={machine.status} />
                </div>

                {/* Machine Image */}
                <div style={{
                  width: '100%',
                  height: '140px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-bg-tertiary)',
                  marginBottom: 'var(--space-4)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--color-border)',
                }}>
                  {rawImage ? (
                    <img
                      src={bufferToImageUrl(rawImage)}
                      alt={machine.machine_name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div style={{
                    display: rawImage ? 'none' : 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    color: 'var(--color-text-muted)'
                  }}>
                    <ImageIcon size={32} opacity={0.5} />
                    <span style={{ fontSize: 'var(--font-size-xs)' }}>No Image</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="checklist-stats">
                  <div className="checklist-stat">
                    <span className="checklist-stat-label">Production</span>
                    <span className="checklist-stat-value">{productionCount}</span>
                  </div>
                  <div className="checklist-stat">
                    <span className="checklist-stat-label">Rejections</span>
                    <span className="checklist-stat-value" style={{ color: rejectionCount > 0 ? 'var(--color-danger)' : undefined }}>
                      {rejectionCount}
                    </span>
                  </div>
                  <div className="checklist-stat" style={{ marginLeft: 'auto' }}>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleIngest(machine)}
                      disabled={ingesting[machine.machine_id] || machine.status !== 'RUNNING'}
                      title={machine.status !== 'RUNNING' ? 'Machine must be RUNNING to add production' : 'Add production count +1 (uses ingest path)'}
                      style={{ gap: '4px' }}
                    >
                      <Zap size={14} />
                      {ingesting[machine.machine_id] ? '...' : '+1'}
                    </button>
                  </div>
                </div>

                {/* Status Actions */}
                <div className="checklist-actions">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`checklist-action-btn ${machine.status === opt.value ? 'checklist-action-active' : ''}`}
                      onClick={() => handleStatusChange(machine.machine_id, opt.value)}
                      disabled={machine.status === opt.value || updating[machine.machine_id]}
                      style={{ '--action-color': opt.color }}
                    >
                      <opt.icon size={14} />
                      {opt.label}
                    </button>
                  ))}
                </div>

                <button
                  className="btn btn-ghost btn-sm w-full mt-2"
                  onClick={() => navigate(`/machines/${machine.machine_id}`)}
                >
                  View Details →
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
