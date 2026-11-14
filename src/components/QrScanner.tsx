import { t } from "../i18n"
import { useEffect, useRef, useState } from "react"
import { Html5Qrcode } from "html5-qrcode"
import { Input } from "./ui/input"
import { Button } from "./ui/button"

interface QrScannerProps {
  onScan: (code: string) => void
  onClose: () => void
}

const SCANNER_ID = "qr-scanner-element"

export function QrScanner({ onScan, onClose }: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan
  const [error, setError] = useState("")
  const [manualCode, setManualCode] = useState("")

  useEffect(() => {
    const scanner = new Html5Qrcode(SCANNER_ID)
    scannerRef.current = scanner
    let stopped = false
    const safeStop = async () => {
      if (stopped) return
      stopped = true
      try { await scanner.stop() } catch {}
    }
    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        safeStop()
        onScanRef.current(decodedText)
      },
      () => {},
    ).catch((e) => {
      setError(e?.toString() ?? t("Camera unavailable"))
    })
    return () => { safeStop() }
  }, [])

  const handleManualSubmit = () => {
    const code = manualCode.trim()
    if (code) onScan(code)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-xl p-4 shadow-xl w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        {error ? (
          <div className="w-full aspect-square rounded-lg overflow-hidden bg-muted flex flex-col items-center justify-center p-4 text-center text-sm text-muted-foreground gap-3">
            <p>{t("Camera not available")}</p>
            <div className="w-full max-w-xs space-y-2">
              <Input
                placeholder={t("Enter ticket code manually...")}
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
              />
              <Button size="sm" className="w-full" onClick={handleManualSubmit} disabled={!manualCode.trim()}>
                {t("Submit")}
              </Button>
            </div>
          </div>
        ) : (
          <div id={SCANNER_ID} className="w-full aspect-square rounded-lg overflow-hidden bg-muted" />
        )}
        <p className="text-sm text-muted-foreground text-center mt-3">
          {error ? t("Enter the ticket code manually above") : t("Point camera at the ticket QR code")}
        </p>
        {error && (
          <p className="text-xs text-muted-foreground text-center mt-1">
            {t("Camera requires HTTPS — use Chrome with HTTPS or enter code manually")}
          </p>
        )}
        <button onClick={onClose} className="mt-3 w-full py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors">{t("Cancel")}</button>
      </div>
    </div>
  )
}
