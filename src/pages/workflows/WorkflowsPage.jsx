import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { workOrderApi } from '../../api/workOrderApi';
import { workflowApi } from '../../api/workflowApi';
import { machineApi } from '../../api/machineApi';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmModal from '../../components/common/ConfirmModal';
import { getErrorMessage, formatDate, calcPercentage } from '../../utils/helpers';
import {
  GitBranch, Plus, RefreshCw, Search, ArrowRight, X, CheckCircle2,
  Circle, PlayCircle, SkipForward, Clock, Trash2, Edit3, Save, Monitor,
  AlertTriangle, ChevronDown, ChevronRight, ListTodo, Workflow
} from 'lucide-react';
import toast from 'react-hot-toast';

const STEP_STATUS_CONFIG = {
  PENDING: { icon: Circle, color: 'var(--color-text-muted)', bgColor: 'var(--color-bg-tertiary)', label: 'Pending' },
  IN_PROGRESS: { icon: PlayCircle, color: 'var(--color-accent-primary)', bgColor: 'var(--color-accent-primary-glow)', label: 'In Progress' },
  COMPLETED: { icon: CheckCircle2, color: 'var(--color-success)', bgColor: 'var(--color-success-bg)', label: 'Completed' },
  SKIPPED: { icon: SkipForward, color: 'var(--color-warning)', bgColor: 'var(--color-warning-bg)', label: 'Skipped' },
};

const STEP_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'];

export default function WorkflowsPage() {
  const navigate = useNavigate();
  const { subscribe } = useSocket();
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState([]);
  const [workflows, setWorkflows] = useState({});
  const [machines, setMachines] = useState([]);
  const [search, setSearch] = useState('');
  const [expandedWorkOrder, setExpandedWorkOrder] = useState(null);
  const [updatingStep, setUpdatingStep] = useState({});

  // Add/Edit step modal state
  const [showStepModal, setShowStepModal] = useState(false);
  const [editingStep, setEditingStep] = useState(null);
  const [stepForm, setStepForm] = useState({
    step_name: '',
    step_description: '',
    step_order: 1,
    assigned_machine_id: '',
  });
  const [savingStep, setSavingStep] = useState(false);

  // Delete step modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingStep, setDeletingStep] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Active work order for step operations
  const [activeWorkOrderId, setActiveWorkOrderId] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [woRes, machRes] = await Promise.allSettled([
        workOrderApi.getAll(),
        machineApi.getAll(),
      ]);

      if (woRes.status === 'fulfilled') {
        const woData = woRes.value.data?.data || woRes.value.data || [];
        setWorkOrders(Array.isArray(woData) ? woData : []);
      }

      if (machRes.status === 'fulfilled') {
        const machData = machRes.value.data?.data || machRes.value.data || [];
        setMachines(Array.isArray(machData) ? machData : []);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWorkflowForWorkOrder = async (workOrderId) => {
    try {
      const res = await workflowApi.getWorkflow(workOrderId);
      const wfData = res.data?.data || res.data;
      setWorkflows((prev) => ({
        ...prev,
        [workOrderId]: wfData,
      }));
    } catch (err) {
      toast.error(`Failed to load workflow for ${workOrderId}`);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const unsubs = [
      subscribe('workflow:step_updated', fetchData),
      subscribe('workflow:step_added', fetchData),
      subscribe('workflow:step_deleted', fetchData),
      subscribe('workorder:created', fetchData),
      subscribe('workorder:updated', fetchData),
    ];
    return () => unsubs.forEach((u) => u?.());
  }, [subscribe, fetchData]);

  const toggleExpand = async (workOrderId) => {
    if (expandedWorkOrder === workOrderId) {
      setExpandedWorkOrder(null);
    } else {
      setExpandedWorkOrder(workOrderId);
      if (!workflows[workOrderId]) {
        await fetchWorkflowForWorkOrder(workOrderId);
      }
    }
  };

  const handleStepStatusUpdate = async (workOrderId, stepId, newStatus) => {
    setUpdatingStep((prev) => ({ ...prev, [stepId]: true }));
    try {
      await workflowApi.updateStepStatus(stepId, newStatus);
      toast.success(`Step updated to ${newStatus.replace(/_/g, ' ')}`);
      await fetchWorkflowForWorkOrder(workOrderId);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUpdatingStep((prev) => ({ ...prev, [stepId]: false }));
    }
  };

  const openAddStepModal = (workOrderId) => {
    const currentWorkflow = workflows[workOrderId];
    const steps = currentWorkflow?.steps || currentWorkflow?.workflow_steps || [];
    setActiveWorkOrderId(workOrderId);
    setEditingStep(null);
    setStepForm({
      step_name: '',
      step_description: '',
      step_order: steps.length + 1,
      assigned_machine_id: '',
    });
    setShowStepModal(true);
  };

  const openEditStepModal = (workOrderId, step) => {
    setActiveWorkOrderId(workOrderId);
    setEditingStep(step);
    setStepForm({
      step_name: step.step_name,
      step_description: step.step_description || '',
      step_order: step.step_order,
      assigned_machine_id: step.assigned_machine_id || '',
    });
    setShowStepModal(true);
  };

  const handleSaveStep = async (e) => {
    e.preventDefault();
    if (!stepForm.step_name.trim()) {
      toast.error('Step name is required');
      return;
    }

    setSavingStep(true);
    try {
      const stepData = {
        step_name: stepForm.step_name.trim(),
        step_description: stepForm.step_description.trim(),
        step_order: parseInt(stepForm.step_order, 10),
      };

      if (stepForm.assigned_machine_id) {
        stepData.assigned_machine_id = stepForm.assigned_machine_id;
      }

      if (editingStep) {
        await workflowApi.updateStep(editingStep.id, stepData);
        toast.success('Step updated successfully');
      } else {
        await workflowApi.addStep(activeWorkOrderId, stepData);
        toast.success('Step added successfully');
      }

      setShowStepModal(false);
      await fetchWorkflowForWorkOrder(activeWorkOrderId);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingStep(false);
    }
  };

  const openDeleteModal = (workOrderId, step) => {
    setActiveWorkOrderId(workOrderId);
    setDeletingStep(step);
    setShowDeleteModal(true);
  };

  const handleDeleteStep = async () => {
    if (!deletingStep) return;

    setDeleting(true);
    try {
      await workflowApi.deleteStep(deletingStep.id);
      toast.success('Step deleted successfully');
      setShowDeleteModal(false);
      await fetchWorkflowForWorkOrder(activeWorkOrderId);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
      setDeletingStep(null);
    }
  };

  const filteredWorkOrders = workOrders.filter((wo) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      wo.work_order_name?.toLowerCase().includes(searchLower) ||
      wo.work_order_id?.toLowerCase().includes(searchLower) ||
      wo.description?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) return <LoadingSpinner text="Loading workflows..." />;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Workflow Management</h1>
          <p className="page-subtitle">Manage workflows for all work orders</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchData}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-4 mb-6" style={{ flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '240px', maxWidth: '400px' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder="Search work orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '40px' }}
          />
        </div>
      </div>

      {filteredWorkOrders.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="No work orders found"
          message={search ? "No work orders match your search criteria." : "Work orders will appear here when created by business users."}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {filteredWorkOrders.map((wo) => {
            const isExpanded = expandedWorkOrder === wo.work_order_id;
            const workflow = workflows[wo.work_order_id];
            const steps = workflow?.steps || workflow?.workflow_steps || [];
            const progress = calcPercentage(wo.total_produced || wo.produced_count || 0, wo.target);

            return (
              <div key={wo.work_order_id} className="card" style={{ margin: 0, overflow: 'hidden' }}>
                {/* Work Order Header */}
                <div
                  onClick={() => toggleExpand(wo.work_order_id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-4)',
                    cursor: 'pointer',
                    background: isExpanded ? 'var(--color-bg-tertiary)' : 'transparent',
                    borderBottom: isExpanded ? '1px solid var(--color-border)' : 'none',
                    transition: 'background 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--color-accent-primary-glow)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-accent-primary)',
                      }}
                    >
                      <GitBranch size={20} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {wo.work_order_name}
                        </h3>
                        <StatusBadge status={wo.status} />
                      </div>
                      <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        {wo.work_order_id} • Target: {wo.target} • Progress: {progress}%
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        padding: 'var(--space-2) var(--space-3)',
                        background: 'var(--color-bg-secondary)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      <ListTodo size={14} />
                      {steps.length} steps
                    </div>
                    {isExpanded ? <ChevronDown size={20} color="var(--color-text-muted)" /> : <ChevronRight size={20} color="var(--color-text-muted)" />}
                  </div>
                </div>

                {/* Expanded Workflow Content */}
                {isExpanded && (
                  <div style={{ padding: 'var(--space-4)' }}>
                    {/* Description */}
                    {wo.description && (
                      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)', lineHeight: 1.6 }}>
                        {wo.description}
                      </p>
                    )}

                    {/* Progress Bar */}
                    <div style={{ marginBottom: 'var(--space-4)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Overall Progress</span>
                        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-accent-primary)' }}>{progress}%</span>
                      </div>
                      <div className="progress-bar" style={{ height: '8px' }}>
                        <div className="progress-fill" style={{ width: `${progress}%` }} />
                      </div>
                    </div>

                    {/* Workflow Steps */}
                    <div style={{ marginBottom: 'var(--space-4)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                        <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          Workflow Steps
                        </h4>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => openAddStepModal(wo.work_order_id)}
                        >
                          <Plus size={14} /> Add Step
                        </button>
                      </div>

                      {steps.length === 0 ? (
                        <div
                          style={{
                            padding: 'var(--space-6)',
                            textAlign: 'center',
                            background: 'var(--color-bg-secondary)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px dashed var(--color-border)',
                          }}
                        >
                          <Circle size={32} style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', opacity: 0.5 }} />
                          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                            No workflow steps defined yet.
                          </p>
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ marginTop: 'var(--space-3)' }}
                            onClick={() => openAddStepModal(wo.work_order_id)}
                          >
                            <Plus size={14} /> Add First Step
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                          {steps
                            .sort((a, b) => a.step_order - b.step_order)
                            .map((step, index) => {
                              const config = STEP_STATUS_CONFIG[step.status] || STEP_STATUS_CONFIG.PENDING;
                              const StatusIcon = config.icon;
                              const machine = machines.find((m) => m.machine_id === step.assigned_machine_id);

                              return (
                                <div
                                  key={step.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 'var(--space-3)',
                                    padding: 'var(--space-4)',
                                    background: config.bgColor,
                                    borderRadius: 'var(--radius-md)',
                                    border: `1px solid ${step.status === 'COMPLETED' ? 'var(--color-success-border)' : step.status === 'IN_PROGRESS' ? 'rgba(59,130,246,0.3)' : 'var(--color-border)'}`,
                                  }}
                                >
                                  {/* Step Number */}
                                  <div
                                    style={{
                                      width: 32,
                                      height: 32,
                                      borderRadius: '50%',
                                      background: config.color,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: 'white',
                                      fontSize: 'var(--font-size-xs)',
                                      fontWeight: 700,
                                      flexShrink: 0,
                                    }}
                                  >
                                    {step.step_order}
                                  </div>

                                  {/* Step Content */}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                      <div style={{ flex: 1 }}>
                                        <h5 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '2px' }}>
                                          {step.step_name}
                                        </h5>
                                        {step.step_description && (
                                          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                                            {step.step_description}
                                          </p>
                                        )}
                                        {machine && (
                                          <div
                                            style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: 'var(--space-1)',
                                              padding: '2px var(--space-2)',
                                              background: 'var(--color-bg-card)',
                                              borderRadius: 'var(--radius-sm)',
                                              fontSize: 'var(--font-size-xs)',
                                              color: 'var(--color-accent-primary)',
                                            }}
                                          >
                                            <Monitor size={12} />
                                            {machine.machine_name}
                                          </div>
                                        )}
                                      </div>

                                      {/* Status & Actions */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                        <div
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--space-1)',
                                            padding: 'var(--space-1) var(--space-2)',
                                            background: 'var(--color-bg-card)',
                                            borderRadius: 'var(--radius-sm)',
                                            fontSize: 'var(--font-size-xs)',
                                            color: config.color,
                                          }}
                                        >
                                          <StatusIcon size={12} />
                                          {config.label}
                                        </div>

                                        {/* Status Actions */}
                                        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                                          {STEP_STATUSES.filter((s) => s !== step.status).map((status) => (
                                            <button
                                              key={status}
                                              className="btn btn-sm"
                                              style={{
                                                padding: '4px 8px',
                                                fontSize: 'var(--font-size-xs)',
                                                background: STEP_STATUS_CONFIG[status].bgColor,
                                                color: STEP_STATUS_CONFIG[status].color,
                                                border: `1px solid ${STEP_STATUS_CONFIG[status].color}`,
                                              }}
                                              onClick={() => handleStepStatusUpdate(wo.work_order_id, step.id, status)}
                                              disabled={updatingStep[step.id]}
                                            >
                                              {updatingStep[step.id] ? '...' : status === 'IN_PROGRESS' ? 'Start' : status === 'COMPLETED' ? 'Complete' : status === 'SKIPPED' ? 'Skip' : 'Reset'}
                                            </button>
                                          ))}
                                        </div>

                                        {/* Edit/Delete Actions */}
                                        <button
                                          className="btn btn-ghost btn-icon btn-sm"
                                          onClick={() => openEditStepModal(wo.work_order_id, step)}
                                          title="Edit step"
                                        >
                                          <Edit3 size={14} />
                                        </button>
                                        <button
                                          className="btn btn-ghost btn-icon btn-sm"
                                          style={{ color: 'var(--color-danger)' }}
                                          onClick={() => openDeleteModal(wo.work_order_id, step)}
                                          title="Delete step"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>

                    {/* Quick Actions */}
                    <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/work-orders/${wo.work_order_id}`)}
                      >
                        View Work Order <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Step Modal */}
      {showStepModal && (
        <div className="modal-overlay" onClick={() => setShowStepModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-accent-primary-glow)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-accent-primary)',
                  }}
                >
                  {editingStep ? <Edit3 size={20} /> : <Plus size={20} />}
                </div>
                <h3 className="modal-title">{editingStep ? 'Edit Step' : 'Add Workflow Step'}</h3>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowStepModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveStep}>
              <div className="form-group">
                <label htmlFor="step-name">Step Name *</label>
                <input
                  id="step-name"
                  type="text"
                  placeholder="e.g., Material Preparation"
                  value={stepForm.step_name}
                  onChange={(e) => setStepForm((p) => ({ ...p, step_name: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="step-description">Description</label>
                <textarea
                  id="step-description"
                  rows={3}
                  placeholder="Describe what needs to be done in this step..."
                  value={stepForm.step_description}
                  onChange={(e) => setStepForm((p) => ({ ...p, step_description: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="step-order">Step Order *</label>
                <input
                  id="step-order"
                  type="number"
                  min="1"
                  value={stepForm.step_order}
                  onChange={(e) => setStepForm((p) => ({ ...p, step_order: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="step-machine">Assign Machine (Optional)</label>
                <select
                  id="step-machine"
                  value={stepForm.assigned_machine_id}
                  onChange={(e) => setStepForm((p) => ({ ...p, assigned_machine_id: e.target.value }))}
                >
                  <option value="">-- Select Machine --</option>
                  {machines.map((m) => (
                    <option key={m.machine_id} value={m.machine_id}>
                      {m.machine_name} ({m.machine_id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowStepModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingStep}>
                  {savingStep ? (editingStep ? 'Saving...' : 'Adding...') : (editingStep ? 'Save Changes' : 'Add Step')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteStep}
        title="Delete Workflow Step"
        message={`Are you sure you want to delete "${deletingStep?.step_name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
