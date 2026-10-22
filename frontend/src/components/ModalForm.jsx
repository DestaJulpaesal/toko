import { useEffect, useId } from 'react';
import { X } from 'lucide-react';

/**
 * Komponen ModalForm Reusable untuk Pola CRUD Modern
 *
 * Mendukung 2 mode tampilan:
 * 1. mode="modal"  -> Dialog Pop-up di tengah layar dengan backdrop blur (default)
 * 2. mode="drawer" -> Slide-over Drawer dari sisi kanan layar
 */
export default function ModalForm({
  isOpen,
  onClose,
  title,
  subtitle,
  kicker,
  children,
  maxWidth = '740px',
  mode = 'modal',
  cardClassName = '',
}) {
  const titleId = useId();
  // Tangani tombol ESC untuk menutup modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Kunci scroll pada elemen body saat modal terbuka
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isDrawer = mode === 'drawer';

  return (
    <div
      className="modal-form-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1300,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: isDrawer ? 'stretch' : 'center',
        justifyContent: isDrawer ? 'flex-end' : 'center',
        padding: isDrawer ? '0' : '16px',
        animation: 'modalFadeIn 0.2s ease-out',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className={`modal-form-card ${isDrawer ? 'modal-form-drawer' : 'modal-form-dialog'} ${cardClassName}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: isDrawer ? (maxWidth || '640px') : (maxWidth || '740px'),
          height: isDrawer ? '100%' : 'auto',
          maxHeight: isDrawer ? '100vh' : 'calc(100vh - 36px)',
          backgroundColor: '#ffffff',
          borderRadius: isDrawer ? '0' : '20px',
          boxShadow: isDrawer
            ? '-12px 0 40px rgba(0, 0, 0, 0.25)'
            : '0 25px 60px -15px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: isDrawer ? 'drawerSlideIn 0.25s ease-out' : 'modalScaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header Modal */}
        <div
          className="modal-form-header"
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            backgroundColor: '#ffffff',
            flexShrink: 0,
          }}
        >
          <div>
            {kicker && (
              <span
                style={{
                  display: 'inline-block',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: '#16a34a',
                  marginBottom: '2px',
                }}
              >
                {kicker}
              </span>
            )}
            <h2
              id={titleId}
              style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 800,
                color: '#0f172a',
                lineHeight: 1.25,
              }}
            >
              {title}
            </h2>
            {subtitle && (
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: '0.82rem',
                  color: '#64748b',
                }}
              >
                {subtitle}
              </p>
            )}
          </div>

          {/* Tombol Tutup (X) */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: '#f1f5f9',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.15s, color 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e2e8f0';
              e.currentTarget.style.color = '#0f172a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f1f5f9';
              e.currentTarget.style.color = '#64748b';
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Konten Form Modal (Bisa Scroll) */}
        <div
          className="modal-form-body"
          style={{
            padding: '24px',
            overflowY: 'auto',
            flex: 1,
            backgroundColor: '#ffffff',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
