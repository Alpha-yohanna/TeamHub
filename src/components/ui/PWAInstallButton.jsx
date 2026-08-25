import { useState } from 'react'
import { usePWAInstall } from '../../lib/usePWAInstall'

function InstallIcon(props) {
  return (
    <svg fill="none" height="16" width="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" {...props}>
      <path d="M12 3v11.5" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4.5 19h15" />
    </svg>
  )
}

export function PWAInstallButton({ className = '' }) {
  const { canInstall, canShowFallback, isIosDevice, promptInstall } = usePWAInstall()
  const [isHintOpen, setIsHintOpen] = useState(false)

  if (!canInstall && !canShowFallback) {
    return null
  }

  async function handleClick() {
    if (canInstall) {
      await promptInstall()
      return
    }
    setIsHintOpen((open) => !open)
  }

  const fallbackMessage = isIosDevice
    ? 'To install TeamHub, tap the Share icon in Safari and choose "Add to Home Screen."'
    : "To install TeamHub, tap Chrome's ⋮ menu and select \"Install app\" or \"Add to Home screen.\""

  return (
    <div className={`pwa-install ${className}`.trim()}>
      <button className="pwa-install-button" onClick={handleClick} type="button">
        <InstallIcon aria-hidden="true" />
        Install TeamHub
      </button>

      {isHintOpen && !canInstall && (
        <p className="pwa-install-hint" role="status">
          {fallbackMessage}
        </p>
      )}
    </div>
  )
}
