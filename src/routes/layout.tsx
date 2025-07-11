import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useAsyncEffect,
  useEventListener,
  useMount,
  useTextSelection,
} from "ahooks";
import { isArray, isString } from "lodash-es";
import { error } from "@tauri-apps/plugin-log";

import { useAppStore } from "@/stores/appStore";
import useEscape from "@/hooks/useEscape";
import useSettingsWindow from "@/hooks/useSettingsWindow";
import { useThemeStore } from "@/stores/themeStore";
import platformAdapter from "@/utils/platformAdapter";
import { AppTheme } from "@/types/index";
import ErrorNotification from "@/components/Common/ErrorNotification";
import { useModifierKeyPress } from "@/hooks/useModifierKeyPress";
import { useIconfontScript } from "@/hooks/useScript";
import { Extension } from "@/components/Settings/Extensions";
import { useExtensionsStore } from "@/stores/extensionsStore";

export default function Layout() {
  const location = useLocation();

  const activeTheme = useThemeStore((state) => state.activeTheme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const isDark = useThemeStore((state) => state.isDark);
  const setIsDark = useThemeStore((state) => state.setIsDark);

  function updateBodyClass(path: string) {
    const body = document.body;
    body.classList.remove("input-body");

    if (path === "/ui") {
      body.classList.add("input-body");
    }
  }

  useMount(async () => {
    await platformAdapter.setShadow(true);

    const unlistenTheme = await platformAdapter.listenThemeChanged(
      (theme: AppTheme) => {
        setTheme(theme);
        setIsDark(theme === "dark");
      }
    );

    platformAdapter.onThemeChanged(({ payload }) => {
      if (activeTheme !== "auto") return;

      setIsDark(payload === "dark");
    });

    return () => {
      unlistenTheme();
    };
  });

  useAsyncEffect(async () => {
    let nextTheme: any = activeTheme === "auto" ? null : activeTheme;

    await platformAdapter.setWindowTheme(nextTheme);

    nextTheme = nextTheme ?? (await platformAdapter.getWindowTheme());

    setIsDark(nextTheme === "dark");
  }, [activeTheme]);

  useEffect(() => {
    const theme = isDark ? "dark" : "light";
    const root = window.document.documentElement;

    root.className = theme;
    root.dataset.theme = theme;
  }, [isDark]);

  useEffect(() => {
    updateBodyClass(location.pathname);
  }, [location.pathname]);

  useEscape();

  useSettingsWindow();

  const { i18n } = useTranslation();
  const language = useAppStore((state) => state.language);
  const { text: selectionText } = useTextSelection();

  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language]);

  // Disable right-click for production environment
  useEventListener("contextmenu", (event) => {
    if (import.meta.env.DEV || selectionText) return;

    event.preventDefault();
  });

  useModifierKeyPress();

  useEventListener("unhandledrejection", ({ reason }) => {
    const message = isString(reason) ? reason : JSON.stringify(reason);

    error(message);
  });

  useIconfontScript();

  const setDisabledExtensions = useExtensionsStore((state) => {
    return state.setDisabledExtensions;
  });

  useMount(async () => {
    const result = await platformAdapter.invokeBackend<[boolean, Extension[]]>(
      "list_extensions"
    );

    if (!isArray(result)) return;

    const disabledExtensions = result[1].filter((item) => !item.enabled);

    setDisabledExtensions(disabledExtensions.map((item) => item.id));
  });

  return (
    <>
      <Outlet />
      <ErrorNotification />
    </>
  );
}
