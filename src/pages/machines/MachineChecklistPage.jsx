import { useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { operatorApi } from '../../api/operatorApi';
import { machineApi } from '../../api/machineApi';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { getErrorMessage, bufferToImageUrl } from '../../utils/helpers';
import { Monitor, RefreshCw, Search, Image as ImageIcon, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import './MachineChecklistPage.css';

export default function MachineChecklistPage() {
  const { subscribe } = useSocket();
  const [loading, setLoading] = useState(true);
  const [machines, setMachines] = useState([]);
  const [allMachineDetails, setAllMachineDetails] = useState([]);
  const [productionCounts, setProductionCounts] = useState({});
  const [deleting, setDeleting] = useState({});
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

      // Fetch production counts for all machines
      await fetchProductionCounts(merged);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const fetchProductionCounts = async (machineList) => {
    const counts = {};
    const results = await Promise.allSettled(
      machineList.map((m) => machineApi.getProductionCount(m.machine_id))
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.data?.data) {
        counts[machineList[index].machine_id] = result.value.data.data;
      }
    });

    setProductionCounts(counts);
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

  const handleDeleteMachine = async (machine) => {
    const confirmed = window.confirm(`Remove machine "${machine.machine_name}" (${machine.machine_id}) from your machines?`);
    if (!confirmed) return;

    setDeleting((prev) => ({ ...prev, [machine.machine_id]: true }));
    try {
      await operatorApi.deleteMyMachine(machine.machine_id);
      toast.success('Machine removed for operator');
      setMachines((prev) => prev.filter((m) => m.machine_id !== machine.machine_id));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting((prev) => ({ ...prev, [machine.machine_id]: false }));
    }
  };

  const filteredMachines = machines.filter((m) => {
    const matchesFilter = filter === 'ALL' || m.status === filter;
    const matchesSearch = !search ||
      m.machine_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.machine_id?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (loading) return <LoadingSpinner text="Loading machines..." />;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Machines</h1>
          <p className="page-subtitle">View assigned machines and remove machine assignment</p>
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

            // Production & rejection counts from API
            const productionData = productionCounts[machine.machine_id];
            const productionCount = productionData?.total_production_count
              ? Number(productionData.total_production_count)
              : 0;
            const rejectionCount = productionData?.total_rejected_count
              ? Number(productionData.total_rejected_count)
              : 0;

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

                <button
                  className="btn btn-danger btn-sm w-full mt-2"
                  onClick={() => handleDeleteMachine(machine)}
                  disabled={deleting[machine.machine_id]}
                >
                  <Trash2 size={14} />
                  {deleting[machine.machine_id] ? 'Removing...' : 'Delete'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
