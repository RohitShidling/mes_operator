import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { workOrderApi } from '../../api/workOrderApi';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { getErrorMessage, calcPercentage, formatDate } from '../../utils/helpers';
import { ClipboardList, Search, ArrowRight, Target, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function WorkOrdersPage() {
  const navigate = useNavigate();
  const { subscribe } = useSocket();
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

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
        <button className="btn btn-secondary" onClick={fetchWorkOrders}>
          <RefreshCw size={16} /> Refresh
        </button>
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
            const progress = calcPercentage(wo.produced_count || 0, wo.target);
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
                  <ArrowRight size={14} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
