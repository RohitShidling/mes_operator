import { useEffect, useMemo, useState } from 'react';
import { checklistApi } from '../../api/checklistApi';
import { machineApi } from '../../api/machineApi';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { ClipboardCheck } from 'lucide-react';
import {
  FaBroom,
  FaUserShield,
  FaOilCan,
  FaWater,
  FaTint,
  FaTools,
  FaCogs,
  FaBell,
  FaCheckCircle,
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils/helpers';

const normalizeChecklistItems = (payload) => {
  const base = payload?.data?.data || payload?.data || [];
  if (Array.isArray(base)) return base;
  if (Array.isArray(base?.items)) return base.items;
  if (Array.isArray(base?.checklist_items)) return base.checklist_items;
  return [];
};

const pickFirstNonEmpty = (values = []) =>
  values.find((value) => typeof value === 'string' && value.trim())?.trim() || '';

const normalizeStatusToChecked = (status) => {
  const value = String(status || '').toUpperCase();
  return ['COMPLETED', 'DONE', 'CHECKED', 'OK', 'PASS'].includes(value);
};

const checkpointIcon = (checkpoint = '') => {
  const key = checkpoint.toLowerCase();
  if (key.includes('clean')) return FaBroom;
  if (key.includes('safe')) return FaUserShield;
  if (key.includes('lubric')) return FaOilCan;
  if (key.includes('hydraulic')) return FaWater;
  if (key.includes('cool')) return FaTint;
  if (key.includes('leak')) return FaTint;
  if (key.includes('map') || key.includes('tool')) return FaTools;
  if (key.includes('operation')) return FaCogs;
  return FaBell;
};

const resolveOperatorName = (user) =>
  user?.operator_name || user?.name || user?.full_name || user?.username || user?.email || '';

export default function MachineChecklistFormPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [machines, setMachines] = useState([]);
  const [selectedMachine, setSelectedMachine] = useState('');
  const [rows, setRows] = useState([]);
  const [operatorName, setOperatorName] = useState(resolveOperatorName(user));
  const [cellInchargeName, setCellInchargeName] = useState('');

  const selectedMachineLabel = useMemo(() => {
    const machine = machines.find((m) => m.machine_id === selectedMachine);
    if (!machine) return '';
    return `${machine.machine_name} : ${machine.machine_id}`;
  }, [machines, selectedMachine]);

  const fetchMachinesAndChecklist = async () => {
    setLoading(true);
    try {
      const [machineRes, genericRes] = await Promise.allSettled([
        machineApi.getAll(),
        checklistApi.getGenericChecklist(),
      ]);

      const machineData = machineRes.status === 'fulfilled'
        ? (machineRes.value.data?.data || machineRes.value.data || [])
        : [];
      const machineList = Array.isArray(machineData) ? machineData : [];
      setMachines(machineList);

      const firstMachine = machineList[0]?.machine_id || '';
      const resolvedMachine = selectedMachine || firstMachine;
      if (resolvedMachine) setSelectedMachine(resolvedMachine);

      if (resolvedMachine) {
        await loadChecklistForMachine(resolvedMachine);
      } else if (genericRes.status === 'fulfilled') {
        const genericItems = normalizeChecklistItems(genericRes.value);
        setRows(genericItems.map((item) => ({
          ...item,
          local_status: normalizeStatusToChecked(item.status),
          local_comments: item.comments || '',
        })));
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const loadChecklistForMachine = async (machineId) => {
    try {
      const response = await checklistApi.getMachineChecklist(machineId);
      const responseData = response?.data?.data || response?.data || {};
      const items = normalizeChecklistItems(response);
      const machineCellInchargeName = pickFirstNonEmpty([
        responseData?.cell_incharge_name,
        ...items.map((item) => item?.cell_incharge_name),
      ]);
      setRows(items.map((item) => ({
        ...item,
        local_status: normalizeStatusToChecked(item.status),
        local_comments: item.comments || '',
      })));
      setCellInchargeName(machineCellInchargeName);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setRows([]);
      setCellInchargeName('');
    }
  };

  useEffect(() => {
    fetchMachinesAndChecklist();
  }, []);

  useEffect(() => {
    setOperatorName(resolveOperatorName(user));
  }, [user]);

  const handleMachineChange = async (machineId) => {
    setSelectedMachine(machineId);
    setCellInchargeName('');
    if (!machineId) {
      setRows([]);
      return;
    }
    setLoading(true);
    await loadChecklistForMachine(machineId);
    setLoading(false);
  };

  const handleRowStatus = (index, checked) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, local_status: checked } : row)));
  };

  const handleRowComment = (index, value) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, local_comments: value } : row)));
  };

  const handleSave = async () => {
    if (!selectedMachine) {
      toast.error('Please select a machine');
      return;
    }
    if (!operatorName.trim()) {
      toast.error('Operator name is required');
      return;
    }
    if (!cellInchargeName.trim()) {
      toast.error('Cell incharge name is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        operator_name: operatorName.trim(),
        cell_incharge_name: cellInchargeName.trim(),
        items: rows.map((row) => ({
          ...(row.id ? { id: row.id } : { checkpoint: row.checkpoint }),
          status: row.local_status ? 'DONE' : 'NOT_DONE',
          comments: row.local_comments || '',
        })),
      };
      await checklistApi.saveMachineProgress(selectedMachine, payload);
      toast.success('Checklist progress saved successfully');
      await loadChecklistForMachine(selectedMachine);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading machine checklist..." />;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Machine Checklist</h1>
          <p className="page-subtitle">Machine-wise daily checklist for operator and cell incharge</p>
        </div>
      </div>

      <div className="card">
        <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div className="form-group mb-0">
            <label htmlFor="operator-name">Operator Name</label>
            <input
              id="operator-name"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              placeholder="Operator name"
            />
          </div>
          <div className="form-group mb-0">
            <label htmlFor="machine-select">Select the Machine</label>
            <select id="machine-select" value={selectedMachine} onChange={(e) => handleMachineChange(e.target.value)}>
              <option value="">Select machine</option>
              {machines.map((machine) => (
                <option key={machine.machine_id} value={machine.machine_id}>
                  {machine.machine_name} : {machine.machine_id}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group mb-0">
            <label htmlFor="cell-incharge">Cell Incharge Name</label>
            <input
              id="cell-incharge"
              value={cellInchargeName}
              onChange={(e) => setCellInchargeName(e.target.value)}
              placeholder="Name"
            />
          </div>
        </div>

        {selectedMachineLabel && (
          <div style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            Machine: <strong>{selectedMachineLabel}</strong>
          </div>
        )}

        {rows.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Checklist not available"
            message="No checklist rows found for the selected machine."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Checkpoints</th>
                  <th>Description</th>
                  <th>Specification/Method</th>
                  <th>Image</th>
                  <th>Timings</th>
                  <th>Status</th>
                  <th>Comment</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const Icon = checkpointIcon(row.checkpoint);
                  return (
                    <tr key={row.id || `${row.checkpoint}-${index}`}>
                      <td style={{ fontWeight: 600 }}>{row.checkpoint || '—'}</td>
                      <td>{row.description || '—'}</td>
                      <td>{[row.specification, row.method].filter(Boolean).join(' / ') || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <Icon size={18} />
                        </div>
                      </td>
                      <td>{row.timing || '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <label style={{ cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={Boolean(row.local_status)}
                            onChange={(e) => handleRowStatus(index, e.target.checked)}
                          />
                        </label>
                      </td>
                      <td>
                        <input
                          value={row.local_comments || ''}
                          onChange={(e) => handleRowComment(index, e.target.value)}
                          placeholder="Enter comments..."
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end" style={{ marginTop: 'var(--space-4)' }}>
          <button className="btn btn-danger" onClick={handleSave} disabled={saving || !rows.length}>
            <FaCheckCircle size={14} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

