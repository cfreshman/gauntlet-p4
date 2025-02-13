export function IconButton({ id, title, icon, onClick, className = 'icon-button' }) {
  return (
    <button
      id={id}
      title={title}
      className={className}
      onClick={onClick}
    >
      <span className="material-icons-round">{icon}</span>
    </button>
  )
} 