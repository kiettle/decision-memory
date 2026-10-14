import { useEffect, useState } from "react"
import { localCalendarDate } from "../../../../shared/decision-deadlines.js"

export function useLocalDate() {
  const [today, setToday] = useState(localCalendarDate)
  useEffect(() => {
    let timer: number
    const refresh = () => {
      setToday(localCalendarDate())
      window.clearTimeout(timer)
      const midnight = new Date()
      midnight.setHours(24, 0, 0, 0)
      timer = window.setTimeout(refresh, Math.max(1, midnight.getTime() - Date.now()))
    }
    refresh()
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [])
  return today
}
