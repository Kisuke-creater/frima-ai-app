"use client";

import { useSyncExternalStore } from "react";

export type AppLanguage = "ja" | "en";

export const APP_LANGUAGE_OPTIONS: AppLanguage[] = ["ja", "en"];
export const DEFAULT_LANGUAGE: AppLanguage = "ja";
export const LANGUAGE_STORAGE_KEY = "frima-language";

const LANGUAGE_CHANGE_EVENT = "frima-language-change";

export function isAppLanguage(value: string | null): value is AppLanguage {
  return value === "ja" || value === "en";
}

export function getStoredLanguage(): AppLanguage {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }

  try {
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isAppLanguage(storedLanguage) ? storedLanguage : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function emitLanguageChange() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(LANGUAGE_CHANGE_EVENT));
}

function subscribeToLanguageChange(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === LANGUAGE_STORAGE_KEY) {
      callback();
    }
  };

  const handleCustomEvent = () => {
    callback();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(LANGUAGE_CHANGE_EVENT, handleCustomEvent);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(LANGUAGE_CHANGE_EVENT, handleCustomEvent);
  };
}

export function setAppLanguage(language: AppLanguage) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    return;
  }

  emitLanguageChange();
}

export function useAppLanguage(): AppLanguage {
  return useSyncExternalStore(
    subscribeToLanguageChange,
    getStoredLanguage,
    () => DEFAULT_LANGUAGE,
  );
}
