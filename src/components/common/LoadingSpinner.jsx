export default function LoadingSpinner({ size = 'md', text = '' }) {
  return (
    <div className="spinner-container">
      <div style={{ textAlign: 'center' }}>
        <div className={`spinner ${size === 'sm' ? 'spinner-sm' : ''}`} />
        {text && (
          <p style={{ marginTop: 'var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            {text}
          </p>
        )}
      </div>
    </div>
  );
}
