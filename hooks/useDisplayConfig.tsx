"use client";

// Display settings for /party, shared through React context so any piece of the
// dashboard (and, later, the settings drawer) can read and change them.
//
// State starts at the defaults and loads from storage after mount, so the
// server render and the first client render match. `loaded` tells callers when
// stored values are in; writes go straight to storage from the setters (never
// from an effect), so the defaults can't overwrite a save before it loads.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_CONFIG,
  DEFAULT_CONTENT,
  DEFAULT_DEVICE,
  normalizeConfig,
  normalizeContent,
  normalizeDevice,
  type DeviceSettings,
  type DisplayConfig,
  type PartyContent,
} from "@/lib/display/config";
import {
  loadConfig,
  loadContent,
  loadDevice,
  saveConfig,
  saveContent,
  saveDevice,
} from "@/lib/display/storage";

type Update<T> = Partial<T> | ((prev: T) => T);

interface DisplayState {
  config: DisplayConfig;
  device: DeviceSettings;
  content: PartyContent;
  loaded: boolean;
  setConfig: (u: Update<DisplayConfig>) => void;
  setDevice: (u: Update<DeviceSettings>) => void;
  setContent: (u: Update<PartyContent>) => void;
}

const Ctx = createContext<DisplayState | null>(null);

function apply<T>(prev: T, u: Update<T>): T {
  return typeof u === "function" ? (u as (p: T) => T)(prev) : { ...prev, ...u };
}

export function DisplayConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<DisplayConfig>(DEFAULT_CONFIG);
  const [device, setDeviceState] = useState<DeviceSettings>(DEFAULT_DEVICE);
  const [content, setContentState] = useState<PartyContent>(DEFAULT_CONTENT);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setConfigState(loadConfig());
    setDeviceState(loadDevice());
    setContentState(loadContent());
    setLoaded(true);
  }, []);

  const setConfig = useCallback((u: Update<DisplayConfig>) => {
    setConfigState((prev) => {
      const next = normalizeConfig(apply(prev, u));
      saveConfig(next);
      return next;
    });
  }, []);

  const setDevice = useCallback((u: Update<DeviceSettings>) => {
    setDeviceState((prev) => {
      const next = normalizeDevice(apply(prev, u));
      saveDevice(next);
      return next;
    });
  }, []);

  const setContent = useCallback((u: Update<PartyContent>) => {
    setContentState((prev) => {
      const next = normalizeContent(apply(prev, u));
      saveContent(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ config, device, content, loaded, setConfig, setDevice, setContent }),
    [config, device, content, loaded, setConfig, setDevice, setContent],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDisplayConfig(): DisplayState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDisplayConfig must be used inside <DisplayConfigProvider>");
  return v;
}
