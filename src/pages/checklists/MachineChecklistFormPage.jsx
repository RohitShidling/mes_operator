import { useEffect, useMemo, useState } from 'react';
import { checklistApi } from '../../api/checklistApi';
import { machineApi } from '../../api/machineApi';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { ClipboardCheck, ImageOff } from 'lucide-react';
import { FaCheckCircle } from 'react-icons/fa';
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

const resolveItemChecked = (item = {}) => {
  if (typeof item.checked === 'boolean') return item.checked;
  return normalizeStatusToChecked(item.status);
};

// Map checkpoint names to images in /img/ folder
// Note: Hydraulic and Tool Mapping share the same icon
const CHECKPOINT_IMAGES = {
  // Cleanliness
  'clearness': '/img/clearness.png',
  'clean': '/img/clearness.png',
  'cleanliness': '/img/clearness.png',
  // Cooling (separate from hydraulic)
  'cooling': '/img/cooling.png',
  'coolant': '/img/cooling.png',
  // Hydraulic - same as tool mapping
  'hydraulic': '/img/tool_maping.png',
  'hydraulics': '/img/tool_maping.png',
  // Lubrication
  'lubrication': '/img/lubrication.png',
  'lubricant': '/img/lubrication.png',
  'oil': '/img/lubrication.png',
  // Safety
  'safety': '/img/safety.png',
  'safe': '/img/safety.png',
  // Tool Mapping - same as hydraulic
  'tool_maping': '/img/tool_maping.png',
  'tool mapping': '/img/tool_maping.png',
  'tool': '/img/tool_maping.png',
  // Operation
  'operation': '/img/op_2.jpg',
  'op_2': '/img/op_2.jpg',
  'op_8': '/img/op_8.png',
  // Water Leakage - same as hydraulic/tool mapping
  'water_leakage': '/img/tool_maping.png',
  'water leakage': '/img/tool_maping.png',
  'leakage': '/img/tool_maping.png',
  'leak': '/img/tool_maping.png',
};

const getCheckpointImage = (checkpoint = '') => {
  const key = checkpoint.toLowerCase().trim();
  // Try exact match first
  if (CHECKPOINT_IMAGES[key]) return CHECKPOINT_IMAGES[key];
  // Try partial match
  for (const [keyword, imagePath] of Object.entries(CHECKPOINT_IMAGES)) {
    if (key.includes(keyword)) return imagePath;
  }
  return null;
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
          local_status: resolveItemChecked(item),
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
        local_status: resolveItemChecked(item),
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
          checked: Boolean(row.local_status),
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
                {rows.map((row, index) => (
                  <tr key={row.id || `${row.checkpoint}-${index}`}>
                      <td style={{ fontWeight: 600 }}>{row.checkpoint || '—'}</td>
                      <td>{row.description || '—'}</td>
                      <td>{[row.specification, row.method].filter(Boolean).join(' / ') || '—'}</td>
                      <td>
                        {(() => {
                          const imagePath = getCheckpointImage(row.checkpoint);
                          return imagePath ? (
                            <div style={{
                              width: '80px',
                              height: '60px',
                              borderRadius: 'var(--radius-md)',
                              overflow: 'hidden',
                              border: '1px solid var(--color-border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'var(--color-bg-tertiary)',
                            }}>
                              <img
                                src={imagePath}
                                alt={row.checkpoint}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'contain',
                                  padding: '2px',
                                }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--color-text-muted)"><line x1="2" y1="2" x2="22" y2="22"></line><path d="M10.41 10.41a2 2 0 1 1-2.83-2.83"></path><line x1="13.5" y1="6.5" x2="17.5" y2="10.5"></line><path d="M6 21l3-3"></path><path d="M21 6l-3 3"></path><circle cx="12" cy="12" r="10"></circle></svg></div>';
                                }}
                              />
                            </div>
                          ) : (
                            <div style={{
                              width: '80px',
                              height: '60px',
                              borderRadius: 'var(--radius-md)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'var(--color-bg-tertiary)',
                              color: 'var(--color-text-muted)',
                            }}>
                              <ImageOff size={20} />
                            </div>
                          );
                        })()}
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
                ))}
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

