import { IconButton } from './IconButton'

export function PageLayout({ id, title, onClose, children, isOpen }) {
  return (
    <div id={id} className="page-overlay" style={{ display: isOpen ? 'flex' : 'none' }}>
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <IconButton
          title="Close"
          icon="close"
          onClick={onClose}
          className="nav-button"
        />
      </div>
      <div className="page-content scrollbar">
        <div className="page-content-inner">
          {children}
        </div>
      </div>
    </div>
  )
} 