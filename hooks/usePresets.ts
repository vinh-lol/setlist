"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDisplayConfig } from "@/hooks/useDisplayConfig";
import {
  BUILT_IN_PRESETS,
  loadUserPresets,
  newPresetId,
  presetFromFile,
  presetToFile,
  sameLook,
  saveUserPresets,
  type Preset,
} from "@/lib/display/presets";

// Built-in + your presets, which one is active, and whether the current look
// has drifted from it ("changed"). Applying a preset replaces the whole look;
// device settings and party content are never touched.
export function usePresets() {
  const { config, device, setConfig, setDevice } = useDisplayConfig();
  const [mine, setMine] = useState<Preset[]>([]);

  useEffect(() => setMine(loadUserPresets()), []);

  const persist = useCallback((next: Preset[]) => {
    setMine(next);
    saveUserPresets(next);
  }, []);

  const all = useMemo(() => [...BUILT_IN_PRESETS, ...mine], [mine]);
  const active = all.find((p) => p.id === device.activePresetId) ?? null;
  const changed = !active || !sameLook(active.config, config);

  const apply = (p: Preset) => {
    setConfig(() => p.config);
    setDevice({ activePresetId: p.id });
  };

  const saveAsNew = (name: string): Preset => {
    const p: Preset = { id: newPresetId(), name: name.trim().slice(0, 40) || "My look", builtIn: false, config };
    persist([...mine, p]);
    setDevice({ activePresetId: p.id });
    return p;
  };

  // Overwrite the active preset with the current look (yours only).
  const updateActive = () => {
    if (!active || active.builtIn) return;
    persist(mine.map((p) => (p.id === active.id ? { ...p, config } : p)));
  };

  const revert = () => {
    if (active) setConfig(() => active.config);
  };

  const remove = (id: string) => {
    persist(mine.filter((p) => p.id !== id));
    // The look on screen stays; it just isn't tied to a saved preset anymore.
    if (device.activePresetId === id) setDevice({ activePresetId: "" });
  };

  const rename = (id: string, name: string) => {
    const n = name.trim().slice(0, 40);
    if (n) persist(mine.map((p) => (p.id === id ? { ...p, name: n } : p)));
  };

  /** Downloads the current look as a .json file. */
  const exportCurrent = () => {
    const name = active && !changed ? active.name : "My look";
    const url = URL.createObjectURL(presetToFile(name, config));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "look"}.setlist-look.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /** Adds a look file as one of your presets and applies it. Throws a readable error. */
  const importFile = async (file: File) => {
    const { name, config: imported } = presetFromFile(await file.text());
    const p: Preset = { id: newPresetId(), name, builtIn: false, config: imported };
    persist([...mine, p]);
    apply(p);
    return p;
  };

  return { builtIn: BUILT_IN_PRESETS, mine, active, changed, apply, saveAsNew, updateActive, revert, remove, rename, exportCurrent, importFile };
}
