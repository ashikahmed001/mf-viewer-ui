/**
 * ThemeContext — dark / light theme with time-based auto mode.
 *
 * Modes:
 *   'auto'  — switches by time: light during day window, dark at night
 *   'light' — always light
 *   'dark'  — always dark
 *
 * Preferences stored in localStorage under 'theme_prefs'.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const DEFAULT_DAY_START = 6;   // 6 am
const DEFAULT_DAY_END   = 20;  // 8 pm

const ThemeContext = createContext(null);

function loadPrefs() {
  try {
    const raw = localStorage.getItem('theme_prefs');
    if (raw) return { ...defaultPrefs(), ...JSON.parse(raw) };
  } catch {}
  return defaultPrefs();
}

function defaultPrefs() {
  return { mode: 'auto', dayStart: DEFAULT_DAY_START, dayEnd: DEFAULT_DAY_END };
}

function isDayTime(dayStart, dayEnd) {
  const h = new Date().getHours();
  return h >= dayStart && h < dayEnd;
}

function applyTheme(dark) {
  document.documentElement.classList.toggle('dark', dark);
}

export function ThemeProvider({ children }) {
  const [prefs, setPrefs] = useState(loadPrefs);

  // Derive whether dark is active right now
  const computeDark = useCallback((p) => {
    if (p.mode === 'dark')  return true;
    if (p.mode === 'light') return false;
    return !isDayTime(p.dayStart, p.dayEnd);
  }, []);

  const [isDark, setIsDark] = useState(() => computeDark(loadPrefs()));

  // Apply theme to <html> and keep updated
  useEffect(() => {
    const dark = computeDark(prefs);
    setIsDark(dark);
    applyTheme(dark);

    // In auto mode, re-check every minute so it flips right at the boundary
    if (prefs.mode !== 'auto') return;
    const timer = setInterval(() => {
      const d = computeDark(prefs);
      setIsDark(d);
      applyTheme(d);
    }, 60_000);
    return () => clearInterval(timer);
  }, [prefs, computeDark]);

  function updatePrefs(patch) {
    setPrefs(prev => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem('theme_prefs', JSON.stringify(next)); } catch {}
      return next;
    });
  }

  // Helper: what time does the next switch happen?
  function nextSwitchLabel() {
    if (prefs.mode !== 'auto') return null;
    const h = new Date().getHours();
    if (isDark) {
      // currently dark → next switch is to light at dayStart
      const diff = prefs.dayStart > h
        ? prefs.dayStart - h
        : 24 - h + prefs.dayStart;
      return `Switches to light in ~${diff}h`;
    } else {
      // currently light → next switch is to dark at dayEnd
      const diff = prefs.dayEnd > h
        ? prefs.dayEnd - h
        : 24 - h + prefs.dayEnd;
      return `Switches to dark in ~${diff}h`;
    }
  }

  return (
    <ThemeContext.Provider value={{ isDark, prefs, updatePrefs, nextSwitchLabel }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
