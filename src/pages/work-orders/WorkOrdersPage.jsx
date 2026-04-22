import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { workOrderApi } from '../../api/workOrderApi';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { getErrorMessage, calcPercentage, formatDate } from '../../utils/helpers';
import { ClipboardList, Search, ArrowRight, Target, RefreshCw, Plus, X, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

export default function WorkOrdersPage() {
  const navigate = useNavigate();
  const { subscribe } = useSocket();
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchWorkOrders = async () => {
    try {
      const res = await workOrderApi.getAll();
      const data = res.data.data || res.data || [];
      setWorkOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  useEffect(() => {
    const unsubs = [
      subscribe('workorder:created', fetchWorkOrders),
      subscribe('workorder:updated', fetchWorkOrders),
      subscribe('workorder:deleted', fetchWorkOrders),
    ];
    return () => unsubs.forEach((u) => u?.());
  }, [subscribe]);

  const filtered = workOrders.filter((wo) => {
    const matchesSearch = !search ||
      wo.work_order_name?.toLowerCase().includes(search.toLowerCase()) ||
      wo.work_order_id?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || wo.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statuses = ['ALL', ...new Set(workOrders.map((wo) => wo.status).filter(Boolean))];

  if (loading) return <LoadingSpinner text="Loading work orders..." />;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Work Orders</h1>
          <p className="page-subtitle">View all work orders assigned from business level</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn btn-secondary" onClick={fetchWorkOrders}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} /> Create Work Order
          </button>
        </div>
      </div>

      {/* Search and Filter */}
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
        <div className="tabs" style={{ marginBottom: 0 }}>
          {statuses.map((s) => (
            <button
              key={s}
              className={`tab ${statusFilter === s ? 'tab-active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No work orders found"
          message="Work orders will appear here when created by business users."
        />
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
          {filtered.map((wo) => {
            const progress = calcPercentage(wo.total_produced || wo.produced_count || 0, wo.target);
            const totalRej = wo.total_rejected || 0;
            return (
              <div
                key={wo.work_order_id}
                className="card card-interactive"
                onClick={() => navigate(`/work-orders/${wo.work_order_id}`)}
                style={{ cursor: 'pointer' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {wo.work_order_name}
                    </h3>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      {wo.work_order_id}
                    </p>
                  </div>
                  <StatusBadge status={wo.status} />
                </div>

                {wo.description && (
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)', lineHeight: '1.5' }}>
                    {wo.description.substring(0, 120)}{wo.description.length > 120 ? '...' : ''}
                  </p>
                )}

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Target size={14} style={{ color: 'var(--color-accent-primary)' }} />
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      Target: <strong style={{ color: 'var(--color-text-primary)' }}>{wo.target}</strong>
                    </span>
                  </div>
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-accent-primary)' }}>
                    {progress}%
                  </span>
                </div>

                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>

                <div className="flex items-center justify-between mt-4" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  <span>Created: {formatDate(wo.created_at)}</span>
                  <div className="flex items-center gap-3">
                    {totalRej > 0 && (
                      <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>Rejected: {totalRej}</span>
                    )}
                    <ArrowRight size={14} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <CreateWorkOrderModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchWorkOrders();
          }}
        />
      )}
    </div>
  );
}

// Create Work Order Modal Component
function CreateWorkOrderModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    work_order_id: '',
    work_order_name: '',
    target: '',
    description: '',
    targeted_end_date: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.work_order_id || !formData.work_order_name || !formData.target || !formData.targeted_end_date) {
      toast.error('Please fill in all required fields');
      return;
    }

    const dateObj = new Date(formData.targeted_end_date);
    if (isNaN(dateObj.getTime())) {
      toast.error('Invalid date selected');
      return;
    }

    setSubmitting(true);
    try {
      await workOrderApi.create({
        work_order_id: formData.work_order_id,
        work_order_name: formData.work_order_name,
        target: parseInt(formData.target, 10),
        description: formData.description,
        targeted_end_date: formData.targeted_end_date,
        target_day: dateObj.getDate(),
        target_month: dateObj.getMonth() + 1,
        target_year: dateObj.getFullYear()
      });
      toast.success('Work order created successfully');
      onSuccess();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-accent-primary-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-accent-primary)',
            }}>
              <Plus size={20} />
            </div>
            <h3 className="modal-title">Create Work Order</h3>
          </div>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label htmlFor="wo-id">Work Order ID *</label>
              <input
                id="wo-id"
                type="text"
                placeholder="e.g., WO-2026-001"
                value={formData.work_order_id}
                onChange={(e) => setFormData((p) => ({ ...p, work_order_id: e.target.value }))}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="wo-name">Work Order Name *</label>
              <input
                id="wo-name"
                type="text"
                placeholder="e.g., Batch Q1"
                value={formData.work_order_name}
                onChange={(e) => setFormData((p) => ({ ...p, work_order_name: e.target.value }))}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="wo-target">Target Quantity *</label>
              <input
                id="wo-target"
                type="number"
                min="1"
                placeholder="e.g., 1000"
                value={formData.target}
                onChange={(e) => setFormData((p) => ({ ...p, target: e.target.value }))}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="wo-date">Targeted End Date *</label>
              <input
                id="wo-date"
                type="date"
                value={formData.targeted_end_date}
                onChange={(e) => setFormData((p) => ({ ...p, targeted_end_date: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
            <label htmlFor="wo-desc">Description</label>
            <textarea
              id="wo-desc"
              rows="3"
              placeholder="e.g., Make 1000 items..."
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              <Plus size={16} />
              {submitting ? 'Creating...' : 'Create Work Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
