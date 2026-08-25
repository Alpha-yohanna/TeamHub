import { useCallback, useEffect, useState } from 'react'

function checkIsStandalone() {
  if (typeof window === 'undefined') return false
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches ||
      // iOS Safari's legacy "installed to home screen" flag — it never fires beforeinstallprompt.
      window.navigator.standalone,
  )
}

function checkIsIos() {
  if (typeof navigator === 'undefined') return false
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS 13+ reports its UA as a desktop Mac, but exposes multi-touch where a real Mac doesn't.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function checkIsChromiumBased() {
  if (typeof navigator === 'undefined') return false
  return /Chrome|Chromium|Edg\//.test(navigator.userAgent) && !/Firefox/.test(navigator.userAgent)
}

/**
 * Wraps the browser's native PWA install flow (the `beforeinstallprompt` /
 * `appinstalled` events) so the install button doesn't need to duplicate this
 * bookkeeping. iOS Safari and older/other browsers never fire
 * `beforeinstallprompt`, so `canShowFallback` tells the caller when it's safe
 * to show manual "how to install" instructions instead of a native prompt.
 */
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(checkIsStandalone)
  const [isIosDevice] = useState(checkIsIos)
  const [isChromiumBased] = useState(checkIsChromiumBased)

  useEffect(() => {
    function handleBeforeInstallPrompt(event) {
      event.preventDefault()
      setDeferredPrompt(event)
    }

    function handleAppInstalled() {
      setDeferredPrompt(null)
      setIsInstalled(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    let standaloneQuery
    let handleDisplayModeChange
    if (window.matchMedia) {
      standaloneQuery = window.matchMedia('(display-mode: standalone)')
      handleDisplayModeChange = (event) => setIsInstalled(event.matches)
      standaloneQuery.addEventListener('change', handleDisplayModeChange)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      standaloneQuery?.removeEventListener('change', handleDisplayModeChange)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return null

    deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    return choice
  }, [deferredPrompt])

  return {
    canInstall: Boolean(deferredPrompt) && !isInstalled,
    canShowFallback: !isInstalled && !deferredPrompt && (isIosDevice || isChromiumBased),
    isInstalled,
    isIosDevice,
    promptInstall,
  }
}
