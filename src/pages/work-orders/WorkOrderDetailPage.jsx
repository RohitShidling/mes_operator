import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { workOrderApi } from '../../api/workOrderApi';
import { workflowApi } from '../../api/workflowApi';
import { machineApi } from '../../api/machineApi';
import { operatorApi } from '../../api/operatorApi';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ConfirmModal from '../../components/common/ConfirmModal';
import { getErrorMessage, formatDateTime, calcPercentage, bufferToImageUrl } from '../../utils/helpers';
import {
  ArrowLeft, Target, Hash, CheckCircle, Circle, PlayCircle, SkipForward, RefreshCw,
  Plus, X, Search, Monitor, Trash2, Edit3, Save, AlertTriangle, Zap, Clock, Play, Pause, Image as ImageIcon
} from 'lucide-react';
import toast from 'react-hot-toast';

const STEP_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'];

// Operator-level work order statuses
const WO_STATUSES = [
  { value: 'PENDING', label: 'Pending', icon: Clock, color: 'var(--color-text-muted)' },
  { value: 'IN_PROGRESS', label: 'In Progress', icon: Play, color: 'var(--color-warning)' },
  { value: 'NOT_STARTED', label: 'Not Started', icon: Pause, color: 'var(--color-text-secondary)' },
];

export default function WorkOrderDetailPage() {
  const { workOrderId } = useParams();
  const navigate = useNavigate();
  const { subscribe } = useSocket();
  const [loading, setLoading] = useState(true);
  const [workOrder, setWorkOrder] = useState(null);
  const [machines, setMachines] = useState([]);
  const [workflow, setWorkflow] = useState(null);
  const [rejections, setRejections] = useState([]);
  const [updatingStep, setUpdatingStep] = useState({});
  const [updatingWoStatus, setUpdatingWoStatus] = useState(false);

  // Machine assignment state
  const [allMachines, setAllMachines] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [machineSearch, setMachineSearch] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [showUnassignModal, setShowUnassignModal] = useState(false);
  const [unassignMachineId, setUnassignMachineId] = useState('');
  const [unassigning, setUnassigning] = useState(false);

  // Workflow add state
  const [showAddStepModal, setShowAddStepModal] = useState(false);
  const [addingStep, setAddingStep] = useState(false);
  const [newStep, setNewStep] = useState({ step_order: 1, step_name: '', step_description: '', assigned_machine_id: '' });

  // Edit step state
  const [editingStepId, setEditingStepId] = useState(null);
  const [editStepData, setEditStepData] = useState({});
  const [savingStep, setSavingStep] = useState(false);

  // Delete step state
  const [showDeleteStepModal, setShowDeleteStepModal] = useState(false);
  const [deleteStepId, setDeleteStepId] = useState(null);
  const [deletingStep, setDeletingStep] = useState(false);

  // Report rejection state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [reportingRejection, setReportingRejection] = useState(false);
  const [rejectionForm, setRejectionForm] = useState({ machine_id: '', rejected_count: 1, rejection_reason: '', image: null });

  // Active tab
  const [activeTab, setActiveTab] = useState('machines');

  const fetchData = useCallback(async () => {
    try {
      const [woRes, machRes, wfRes, rejRes, allMachRes] = await Promise.allSettled([
        workOrderApi.getById(workOrderId),
        workOrderApi.getMachines(workOrderId),
        workflowApi.getWorkflow(workOrderId),
        workOrderApi.getRejections(workOrderId),
        machineApi.getAll(),
      ]);

      if (woRes.status === 'fulfilled') setWorkOrder(woRes.value.data.data || woRes.value.data);
      if (machRes.status === 'fulfilled') {
        // Handle all possible response formats:
        // { data: { data: { machines: [...] } } }
        // { data: { machines: [...] } }
        // { data: { data: [...] } }
        // { data: [...] }
        const raw = machRes.value.data;
        let m = [];
        if (raw?.data?.machines && Array.isArray(raw.data.machines)) {
          m = raw.data.machines;
        } else if (raw?.machines && Array.isArray(raw.machines)) {
          m = raw.machines;
        } else if (Array.isArray(raw?.data)) {
          m = raw.data;
        } else if (Array.isArray(raw)) {
          m = raw;
        }
        console.log('[WorkOrderDetail] Machines response:', raw, '=> extracted:', m);
        setMachines(m);
      }
      if (wfRes.status === 'fulfilled') setWorkflow(wfRes.value.data.data || wfRes.value.data);
      if (rejRes.status === 'fulfilled') {
        const raw = rejRes.value.data;
        // API returns { data: { work_order: {..., total_rejected}, rejections_by_machine: [...] } }
        const inner = raw?.data || raw;
        let r = [];
        if (inner?.rejections_by_machine && Array.isArray(inner.rejections_by_machine)) {
          r = inner.rejections_by_machine;
        } else if (inner?.rejections && Array.isArray(inner.rejections)) {
          r = inner.rejections;
        } else if (Array.isArray(inner)) {
          r = inner;
        }
        // Also store work_order data for total_rejected
        if (inner?.work_order) {
          setWorkOrder((prev) => prev ? { ...prev, total_rejected: inner.work_order.total_rejected, total_produced: inner.work_order.total_produced, total_accepted: inner.work_order.total_accepted } : prev);
        }
        setRejections(r);
      }
      if (allMachRes.status === 'fulfilled') {
        const raw = allMachRes.value.data;
        let am = [];
        if (raw?.data?.machines && Array.isArray(raw.data.machines)) {
          am = raw.data.machines;
        } else if (raw?.machines && Array.isArray(raw.machines)) {
          am = raw.machines;
        } else if (Array.isArray(raw?.data)) {
          am = raw.data;
        } else if (Array.isArray(raw)) {
          am = raw;
        }
        setAllMachines(am);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [workOrderId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const unsubs = [
      subscribe('workflow:step_updated', fetchData),
      subscribe('workflow:step_added', fetchData),
      subscribe('workorder:updated', fetchData),
      subscribe('machine:update', fetchData),
      subscribe('machine:status_changed', fetchData),
      subscribe('rejection:reported', fetchData),
    ];
    return () => unsubs.forEach((u) => u?.());
  }, [subscribe, fetchData]);

  // Build a lookup map: machine_id -> ingest_path from allMachines
  const ingestPathMap = useMemo(() => {
    const map = {};
    allMachines.forEach((m) => {
      if (m.machine_id && m.ingest_path) {
        map[m.machine_id] = m.ingest_path;
      }
    });
    return map;
  }, [allMachines]);

  // --- Work Order Status Update ---
  const handleWoStatusUpdate = async (newStatus) => {
    setUpdatingWoStatus(true);
    try {
      await workOrderApi.updateStatus(workOrderId, newStatus);
      toast.success(`Work order status set to ${newStatus.replace(/_/g, ' ')}`);
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUpdatingWoStatus(false);
    }
  };

  // --- Machine Assignment Handlers ---
  const handleAssignMachine = async (machineId) => {
    setAssigning(true);
    try {
      await workOrderApi.assignMachine(workOrderId, machineId);
      toast.success('Machine assigned to work order!');
      setShowAssignModal(false);
      setMachineSearch('');
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassignMachine = async () => {
    setUnassigning(true);
    try {
      await workOrderApi.unassignMachine(workOrderId, unassignMachineId);
      toast.success('Machine removed from work order');
      setShowUnassignModal(false);
      setUnassignMachineId('');
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUnassigning(false);
    }
  };

  // --- Rejection Reporting ---
  const handleReportRejection = async (e) => {
    e.preventDefault();
    if (!rejectionForm.machine_id) {
      toast.error('Please select a machine');
      return;
    }
    if (!rejectionForm.rejection_reason) {
      toast.error('Please provide a reason');
      return;
    }

    setReportingRejection(true);
    try {
      const formData = new FormData();
      formData.append('work_order_id', workOrderId);
      formData.append('machine_id', rejectionForm.machine_id);
      formData.append('rejected_count', rejectionForm.rejected_count);
      formData.append('rejection_reason', rejectionForm.rejection_reason);
      if (rejectionForm.image) {
        formData.append('part_image', rejectionForm.image);
      }

      await operatorApi.reportRejection(formData);
      toast.success('Rejection reported successfully');
      setShowRejectModal(false);
      setRejectionForm({ machine_id: '', rejected_count: 1, rejection_reason: '', image: null });
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setReportingRejection(false);
    }
  };

  // --- Workflow Handlers ---
  const handleStepStatusUpdate = async (stepId, newStatus) => {
    setUpdatingStep((prev) => ({ ...prev, [stepId]: true }));
    try {
      await workflowApi.updateStepStatus(stepId, newStatus);
      toast.success(`Step updated to ${newStatus.replace(/_/g, ' ')}`);
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUpdatingStep((prev) => ({ ...prev, [stepId]: false }));
    }
  };

  const handleAddStep = async (e) => {
    e.preventDefault();
    if (!newStep.step_name) {
      toast.error('Please enter step name');
      return;
    }
    setAddingStep(true);
    try {
      const stepData = { ...newStep };
      if (!stepData.assigned_machine_id) delete stepData.assigned_machine_id;
      await workflowApi.addStep(workOrderId, stepData);
      toast.success('Workflow step added!');
      setShowAddStepModal(false);
      setNewStep({ step_order: steps.length + 2, step_name: '', step_description: '', assigned_machine_id: '' });
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAddingStep(false);
    }
  };

  const handleEditStep = (step) => {
    setEditingStepId(step.id);
    setEditStepData({
      step_name: step.step_name,
      step_description: step.step_description || '',
    });
  };

  const handleSaveStep = async (stepId) => {
    setSavingStep(true);
    try {
      await workflowApi.updateStep(stepId, editStepData);
      toast.success('Step updated!');
      setEditingStepId(null);
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingStep(false);
    }
  };

  const handleDeleteStep = async () => {
    setDeletingStep(true);
    try {
      await workflowApi.deleteStep(deleteStepId);
      toast.success('Step deleted');
      setShowDeleteStepModal(false);
      setDeleteStepId(null);
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingStep(false);
    }
  };

  // --- Production Tracking (uses ingest_path, NOT machine_id) ---
  // Only allowed when machine status is RUNNING
  const handleIngest = async (machine) => {
    // Check if machine is running first
    if (machine.status && machine.status !== 'RUNNING') {
      toast.error('Machine must be RUNNING to add production count.');
      return;
    }

    // Look up ingest_path from allMachines map, then from the machine object itself
    const ingestPath = ingestPathMap[machine.machine_id] || machine.ingest_path;
    if (!ingestPath) {
      toast.error('Ingest path not found for this machine. Please check machine configuration.');
      return;
    }
    // Remove leading slash to get the path ID
    const pathId = ingestPath.replace(/^\//, '');
    try {
      await machineApi.ingestData(pathId);
      toast.success(`Production count +1 for ${machine.machine_name}`);
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (loading) return <LoadingSpinner text="Loading work order details..." />;
  if (!workOrder) return <div className="page-container"><p>Work order not found.</p></div>;

  const progress = calcPercentage(workOrder.total_produced || workOrder.produced_count || 0, workOrder.target);
  const steps = workflow?.steps || workflow?.workflow_steps || [];
  // total_rejected comes from the work_order object in the rejections API response
  const totalRejections = workOrder.total_rejected ?? (Array.isArray(rejections) ? rejections.reduce((sum, r) => sum + (Number(r.total_rejected) || r.rejected_count || 0), 0) : 0);

  // Available machines (not already assigned)
  const assignedMachineIds = machines.map((m) => m.machine_id);
  const availableMachines = allMachines.filter((m) =>
    !assignedMachineIds.includes(m.machine_id) &&
    (!machineSearch || m.machine_name?.toLowerCase().includes(machineSearch.toLowerCase()) || m.machine_id?.toLowerCase().includes(machineSearch.toLowerCase()))
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/work-orders')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="page-title">{workOrder.work_order_name}</h1>
            <p className="page-subtitle">{workOrder.work_order_id || workOrderId}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={workOrder.status} />
          <button className="btn btn-secondary btn-sm" onClick={fetchData}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Work Order Status Control - Operator Level */}
      <div className="card mb-6">
        <div className="card-header">
          <h2 className="card-title">Work Order Status</h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Set by operator
          </span>
        </div>
        <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
          {WO_STATUSES.map((wo) => {
            const isActive = workOrder.status === wo.value;
            return (
              <button
                key={wo.value}
                className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleWoStatusUpdate(wo.value)}
                disabled={isActive || updatingWoStatus}
                style={{ minWidth: '120px' }}
              >
                <wo.icon size={14} />
                {wo.label}
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-3)' }}>
          Current status: <strong style={{ color: 'var(--color-text-primary)' }}>{(workOrder.status || 'NOT SET').replace(/_/g, ' ')}</strong>
          {' · '}Only administrators can cancel or delete work orders.
        </p>
      </div>

      {/* Work Order Summary */}
      <div className="card mb-6">
        {workOrder.description && (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-5)', lineHeight: '1.6' }}>
            {workOrder.description}
          </p>
        )}
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-icon stat-icon-blue"><Target size={20} /></div>
            <div className="stat-info">
              <span className="stat-label">Target</span>
              <span className="stat-value">{workOrder.target}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon stat-icon-green"><Hash size={20} /></div>
            <div className="stat-info">
              <span className="stat-label">Produced</span>
              <span className="stat-value">{workOrder.total_produced || workOrder.produced_count || 0}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon stat-icon-red"><AlertTriangle size={20} /></div>
            <div className="stat-info">
              <span className="stat-label">Total Rejections</span>
              <span className="stat-value">{totalRejections}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon stat-icon-purple"><TrendingUpIcon size={20} /></div>
            <div className="stat-info">
              <span className="stat-label">Progress</span>
              <span className="stat-value">{progress}%</span>
            </div>
          </div>
        </div>
        <div className="progress-bar mt-4" style={{ height: '12px' }}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'machines' ? 'tab-active' : ''}`} onClick={() => setActiveTab('machines')}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Monitor size={14} /> Machines ({machines.length})
          </span>
        </button>
        <button className={`tab ${activeTab === 'workflow' ? 'tab-active' : ''}`} onClick={() => setActiveTab('workflow')}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle size={14} /> Workflow ({steps.length})
          </span>
        </button>
        <button className={`tab ${activeTab === 'rejections' ? 'tab-active' : ''}`} onClick={() => setActiveTab('rejections')}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={14} /> Rejections ({totalRejections})
          </span>
        </button>
      </div>

      {/* ==================== MACHINES TAB ==================== */}
      {activeTab === 'machines' && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Assigned Machines</h2>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAssignModal(true)}>
              <Plus size={14} /> Assign Machine
            </button>
          </div>

          {machines.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
              <Monitor size={48} className="empty-state-icon" />
              <h3 className="empty-state-title">No machines assigned</h3>
              <p className="empty-state-text">Search and assign machines needed for this work order.</p>
              <button className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} onClick={() => setShowAssignModal(true)}>
                <Plus size={16} /> Assign First Machine
              </button>
            </div>
          ) : (
            <div className="checklist-grid" style={{ padding: 'var(--space-4)' }}>
              {machines.map((m, idx) => {
                const fullMachine = allMachines.find((am) => am.machine_id === m.machine_id);
                const run = fullMachine?.current_run || m.current_run;
                const machProdCount = run?.total_count ?? m.production_count ?? fullMachine?.production_count ?? 0;
                const machRejCount = run?.rejected_count ?? Number(m.total_rejected ?? fullMachine?.total_rejected ?? m.rejection_count ?? 0);
                
                return (
                  <div key={m.machine_id || idx} className="checklist-card card" style={{ padding: 'var(--space-4)' }}>
                    <div className="checklist-card-header" style={{ marginBottom: 'var(--space-3)' }}>
                      <div className="checklist-machine-info">
                        <div className="checklist-machine-icon" style={{
                          background: 'var(--color-accent-primary-glow)',
                          color: 'var(--color-accent-primary)'
                        }}>
                          <Monitor size={20} />
                        </div>
                        <div>
                          <h3 className="checklist-machine-name" style={{ fontSize: 'var(--font-size-md)' }}>{m.machine_name}</h3>
                          <span className="checklist-machine-id">{m.machine_id}</span>
                        </div>
                      </div>
                      <StatusBadge status={m.status} />
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
                      {(fullMachine?.machine_image || m.machine_image) ? (
                        <img
                          src={bufferToImageUrl(fullMachine?.machine_image || m.machine_image)}
                          alt={m.machine_name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div style={{
                        display: (fullMachine?.machine_image || m.machine_image) ? 'none' : 'flex',
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
                    <div className="checklist-stats" style={{ background: 'var(--color-bg-tertiary)' }}>
                      <div className="checklist-stat">
                        <span className="checklist-stat-label">Production</span>
                        <span className="checklist-stat-value" style={{ fontSize: 'var(--font-size-lg)' }}>{machProdCount}</span>
                      </div>
                      <div className="checklist-stat">
                        <span className="checklist-stat-label">Rejections</span>
                        <span className="checklist-stat-value" style={{ 
                          fontSize: 'var(--font-size-lg)',
                          color: machRejCount > 0 ? 'var(--color-danger)' : undefined 
                        }}>
                          {machRejCount}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
                      <button
                        className="btn btn-success btn-sm"
                        style={{ flex: 1 }}
                        onClick={() => handleIngest(m)}
                        disabled={m.status !== 'RUNNING'}
                        title={m.status !== 'RUNNING' ? 'Machine must be RUNNING' : 'Add production count +1 (uses ingest path)'}
                      >
                        <Zap size={14} /> +1
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => navigate(`/machines/${m.machine_id}`)}
                      >
                        View
                      </button>
                      <button
                        className="btn btn-danger btn-sm btn-icon"
                        onClick={() => {
                          setUnassignMachineId(m.machine_id);
                          setShowUnassignModal(true);
                        }}
                        title="Remove machine"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================== WORKFLOW TAB ==================== */}
      {activeTab === 'workflow' && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Workflow Steps</h2>
            <button className="btn btn-primary btn-sm" onClick={() => {
              setNewStep({ step_order: steps.length + 1, step_name: '', step_description: '', assigned_machine_id: '' });
              setShowAddStepModal(true);
            }}>
              <Plus size={14} /> Add Step
            </button>
          </div>

          {!Array.isArray(steps) || steps.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
              <CheckCircle size={48} className="empty-state-icon" />
              <h3 className="empty-state-title">No workflow steps defined</h3>
              <p className="empty-state-text">Add workflow steps to track the manufacturing process.</p>
              <button className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} onClick={() => setShowAddStepModal(true)}>
                <Plus size={16} /> Add First Step
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {steps.sort((a, b) => a.step_order - b.step_order).map((step) => {
                const isCompleted = step.status === 'COMPLETED';
                const isInProgress = step.status === 'IN_PROGRESS';
                const isEditing = editingStepId === step.id;

                return (
                  <div
                    key={step.id || step.step_order}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)',
                      padding: 'var(--space-4)',
                      background: isCompleted ? 'var(--color-success-bg)' : isInProgress ? 'var(--color-accent-primary-glow)' : 'var(--color-bg-tertiary)',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${isCompleted ? 'var(--color-success-border)' : isInProgress ? 'rgba(59,130,246,0.3)' : 'var(--color-border)'}`,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: isCompleted ? 'var(--color-success)' : isInProgress ? 'var(--color-accent-primary)' : 'var(--color-bg-card)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: (isCompleted || isInProgress) ? 'white' : 'var(--color-text-muted)',
                      flexShrink: 0, fontSize: 'var(--font-size-xs)', fontWeight: 700,
                    }}>
                      {step.step_order}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                          <input
                            type="text"
                            value={editStepData.step_name}
                            onChange={(e) => setEditStepData((p) => ({ ...p, step_name: e.target.value }))}
                            placeholder="Step name"
                            style={{ fontSize: 'var(--font-size-sm)' }}
                          />
                          <textarea
                            value={editStepData.step_description}
                            onChange={(e) => setEditStepData((p) => ({ ...p, step_description: e.target.value }))}
                            placeholder="Step description"
                            rows={2}
                            style={{ fontSize: 'var(--font-size-xs)' }}
                          />
                          <div className="flex items-center gap-2">
                            <button className="btn btn-primary btn-sm" onClick={() => handleSaveStep(step.id)} disabled={savingStep}>
                              <Save size={12} /> {savingStep ? 'Saving...' : 'Save'}
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setEditingStepId(null)}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)' }}>
                              {step.step_name}
                            </span>
                            <div className="flex items-center gap-2">
                              <StatusBadge status={step.status} />
                              <button className="btn btn-ghost btn-sm" style={{ padding: '4px' }} onClick={() => handleEditStep(step)} title="Edit step">
                                <Edit3 size={13} />
                              </button>
                              <button
                                className="btn btn-ghost btn-sm" style={{ padding: '4px', color: 'var(--color-danger)' }}
                                onClick={() => { setDeleteStepId(step.id); setShowDeleteStepModal(true); }}
                                title="Delete step"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                          {step.step_description && (
                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
                              {step.step_description}
                            </p>
                          )}
                          {step.assigned_machine_id && (
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-accent-primary)' }}>
                              Machine: {step.assigned_machine_id}
                            </span>
                          )}

                          {/* Status update buttons */}
                          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
                            {STEP_STATUSES.filter((s) => s !== step.status).map((s) => (
                              <button
                                key={s}
                                className={`btn btn-sm ${s === 'COMPLETED' ? 'btn-success' : s === 'IN_PROGRESS' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => handleStepStatusUpdate(step.id, s)}
                                disabled={updatingStep[step.id]}
                                style={{ fontSize: '11px' }}
                              >
                                {s === 'COMPLETED' && <CheckCircle size={12} />}
                                {s === 'IN_PROGRESS' && <PlayCircle size={12} />}
                                {s.replace(/_/g, ' ')}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================== REJECTIONS TAB ==================== */}
      {activeTab === 'rejections' && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Work Order Rejections</h2>
            <div className="flex items-center gap-3">
              <span className="badge badge-danger" style={{ fontSize: 'var(--font-size-sm)' }}>
                Total: {totalRejections} pcs
              </span>
              <button className="btn btn-danger btn-sm" onClick={() => setShowRejectModal(true)}>
                <AlertTriangle size={14} /> Report Rejection
              </button>
            </div>
          </div>

          {rejections.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
              <AlertTriangle size={48} className="empty-state-icon" />
              <h3 className="empty-state-title">No rejections recorded</h3>
              <p className="empty-state-text">Rejections for this work order will appear here.</p>
              <button className="btn btn-danger" style={{ marginTop: 'var(--space-4)' }} onClick={() => setShowRejectModal(true)}>
                <AlertTriangle size={16} /> Report Issue
              </button>
            </div>
          ) : (
            <>
              {/* Summary by machine - from rejections_by_machine API data */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
                {rejections.map((r, idx) => {
                  const count = Number(r.total_rejected) || r.rejected_count || 0;
                  return (
                    <div key={r.machine_id || idx} style={{
                      padding: 'var(--space-3)', background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                    }}>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>{r.machine_name || r.machine_id}</div>
                      <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: count > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                        {count} <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400 }}>rejected</span>
                      </div>
                      {r.rejection_entries && (
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                          {r.rejection_entries} rejection entries
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Machine</th>
                      <th>Image</th>
                      <th>Reason</th>
                      <th>Count</th>
                      <th>Reported At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rejections.map((rej, idx) => (
                      <tr key={rej.id || idx}>
                        <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {rej.machine_name || rej.machine_id}
                        </td>
                        <td>
                          {rej.part_image || rej.image_data || rej.image ? (
                            <img 
                              src={bufferToImageUrl(rej.part_image || rej.image_data || rej.image)} 
                              alt="Rejection" 
                              style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }}
                              onClick={(e) => {
                                // Simple click to view larger
                                if (e.target.style.width === '40px') {
                                  e.target.style.position = 'fixed';
                                  e.target.style.top = '50%';
                                  e.target.style.left = '50%';
                                  e.target.style.transform = 'translate(-50%, -50%)';
                                  e.target.style.width = '80vw';
                                  e.target.style.maxWidth = '800px';
                                  e.target.style.height = 'auto';
                                  e.target.style.maxHeight = '80vh';
                                  e.target.style.zIndex = '9999';
                                  e.target.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
                                } else {
                                  e.target.style.position = 'static';
                                  e.target.style.transform = 'none';
                                  e.target.style.width = '40px';
                                  e.target.style.height = '40px';
                                  e.target.style.zIndex = 'auto';
                                  e.target.style.boxShadow = 'none';
                                }
                              }}
                              title="Click to zoom"
                            />
                          ) : (
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>No image</span>
                          )}
                        </td>
                        <td style={{ maxWidth: '300px', color: 'var(--color-text-secondary)' }}>
                          {rej.rejection_reason}
                        </td>
                        <td><span className="badge badge-danger">{rej.rejected_count} pcs</span></td>
                        <td style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                          {formatDateTime(rej.created_at || rej.reported_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ==================== ASSIGN MACHINE MODAL ==================== */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Assign Machine to Work Order</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAssignModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ position: 'relative', marginBottom: 'var(--space-4)' }}>
              <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                type="text"
                placeholder="Search machines by name or ID..."
                value={machineSearch}
                onChange={(e) => setMachineSearch(e.target.value)}
                style={{ paddingLeft: '40px' }}
                autoFocus
              />
            </div>

            <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {availableMachines.length === 0 ? (
                <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
                  <Monitor size={32} className="empty-state-icon" />
                  <p className="empty-state-text">
                    {machineSearch ? 'No matching machines found' : 'All machines are already assigned'}
                  </p>
                </div>
              ) : (
                availableMachines.map((m) => (
                  <div
                    key={m.machine_id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: 'var(--space-3) var(--space-4)',
                      background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)', cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent-primary)'; e.currentTarget.style.background = 'var(--color-accent-primary-glow)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.background = ''; }}
                  >
                    <div className="flex items-center gap-3">
                      <div style={{
                        width: 36, height: 36, borderRadius: 'var(--radius-md)',
                        background: 'var(--color-accent-primary-glow)', color: 'var(--color-accent-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Monitor size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                          {m.machine_name}
                        </div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                          {m.machine_id} · Ingest: {m.ingest_path || 'N/A'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={m.status} />
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={(e) => { e.stopPropagation(); handleAssignMachine(m.machine_id); }}
                        disabled={assigning}
                      >
                        <Plus size={14} /> Assign
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== ADD WORKFLOW STEP MODAL ==================== */}
      {showAddStepModal && (
        <div className="modal-overlay" onClick={() => setShowAddStepModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Workflow Step</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAddStepModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddStep}>
              <div className="form-group">
                <label htmlFor="step-order">Step Order</label>
                <input
                  id="step-order"
                  type="number"
                  min="1"
                  value={newStep.step_order}
                  onChange={(e) => setNewStep((p) => ({ ...p, step_order: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div className="form-group">
                <label htmlFor="step-name">Step Name *</label>
                <input
                  id="step-name"
                  type="text"
                  placeholder="e.g., Raw Material Procurement"
                  value={newStep.step_name}
                  onChange={(e) => setNewStep((p) => ({ ...p, step_name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="step-desc">Description</label>
                <textarea
                  id="step-desc"
                  rows={3}
                  placeholder="Describe what this step involves..."
                  value={newStep.step_description}
                  onChange={(e) => setNewStep((p) => ({ ...p, step_description: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label htmlFor="step-machine">Assigned Machine (Optional)</label>
                <select
                  id="step-machine"
                  value={newStep.assigned_machine_id}
                  onChange={(e) => setNewStep((p) => ({ ...p, assigned_machine_id: e.target.value }))}
                >
                  <option value="">No machine assigned</option>
                  {machines.map((m) => (
                    <option key={m.machine_id} value={m.machine_id}>
                      {m.machine_name} ({m.machine_id})
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddStepModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={addingStep}>
                  <Plus size={16} /> {addingStep ? 'Adding...' : 'Add Step'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unassign Machine Confirmation */}
      <ConfirmModal
        isOpen={showUnassignModal}
        onClose={() => setShowUnassignModal(false)}
        onConfirm={handleUnassignMachine}
        title="Remove Machine"
        message="Are you sure you want to remove this machine from the work order?"
        confirmText="Remove"
        variant="danger"
        loading={unassigning}
      />

      {/* ==================== REPORT REJECTION MODAL ==================== */}
      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: 'var(--color-danger)' }}>Report Rejection</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowRejectModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleReportRejection}>
              <div className="form-group">
                <label htmlFor="rej-machine">Select Machine *</label>
                <select
                  id="rej-machine"
                  value={rejectionForm.machine_id}
                  onChange={(e) => setRejectionForm((p) => ({ ...p, machine_id: e.target.value }))}
                  required
                >
                  <option value="">-- Choose Machine --</option>
                  {machines.map((m) => (
                    <option key={m.machine_id} value={m.machine_id}>
                      {m.machine_name}
                    </option>
                  ))}
                </select>
                {machines.length === 0 && (
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)', marginTop: '4px' }}>
                    Assign a machine to this work order first.
                  </p>
                )}
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
                <label htmlFor="rej-reason">Reason *</label>
                <textarea
                  id="rej-reason"
                  rows={3}
                  placeholder="Describe why parts were rejected..."
                  value={rejectionForm.rejection_reason}
                  onChange={(e) => setRejectionForm((p) => ({ ...p, rejection_reason: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="rej-image">Evidence Image (Optional)</label>
                <input
                  id="rej-image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setRejectionForm((p) => ({ ...p, image: e.target.files[0] }))}
                  style={{
                    padding: '8px',
                    border: '1px dashed var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-bg-tertiary)',
                  }}
                />
                {rejectionForm.image && (
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-success)', marginTop: '4px' }}>
                    Selected: {rejectionForm.image.name}
                  </p>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger" disabled={reportingRejection || machines.length === 0}>
                  {reportingRejection ? 'Reporting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Step Confirmation */}
      <ConfirmModal
        isOpen={showDeleteStepModal}
        onClose={() => setShowDeleteStepModal(false)}
        onConfirm={handleDeleteStep}
        title="Delete Workflow Step"
        message="Are you sure you want to delete this workflow step? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        loading={deletingStep}
      />
    </div>
  );
}

// Simple trending up icon component
function TrendingUpIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
      <polyline points="16 7 22 7 22 13"/>
    </svg>
  );
}
