"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

export const SAVE_NAVIGATION_CURRENT_ROUTE_KEY = "rising-senior:save-navigation:current";
export const SAVE_NAVIGATION_PREVIOUS_ROUTE_KEY = "rising-senior:save-navigation:previous";
const GENERIC_SAVE_RETURN_ROUTES = new Set(["/", "/app"]);

function normalizeRoute(route: string | null | undefined): string | null {
  if (!route) {
    return null;
  }

  if (!route.startsWith("/") || route.startsWith("//")) {
    return null;
  }

  return route;
}

export function buildAppRoute(
  pathname: string,
  searchParams?: { toString(): string } | null
): string {
  const query = searchParams?.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function readCurrentRoute(pathname: string): string {
  if (typeof window === "undefined") {
    return pathname;
  }

  return buildAppRoute(pathname, new URLSearchParams(window.location.search));
}

export function rememberSaveNavigationRoute(route: string) {
  const normalizedRoute = normalizeRoute(route);
  if (!normalizedRoute || typeof window === "undefined") {
    return;
  }

  const currentRoute = normalizeRoute(
    window.sessionStorage.getItem(SAVE_NAVIGATION_CURRENT_ROUTE_KEY)
  );

  if (currentRoute === normalizedRoute) {
    return;
  }

  if (currentRoute) {
    window.sessionStorage.setItem(
      SAVE_NAVIGATION_PREVIOUS_ROUTE_KEY,
      currentRoute
    );
  }

  window.sessionStorage.setItem(
    SAVE_NAVIGATION_CURRENT_ROUTE_KEY,
    normalizedRoute
  );
}

export function resolveSaveReturnRoute(
  currentRoute: string,
  fallbackRoute: string
): string {
  const normalizedFallback = normalizeRoute(fallbackRoute) || "/";

  if (typeof window === "undefined") {
    return normalizedFallback;
  }

  const normalizedCurrent = normalizeRoute(currentRoute);
  const previousRoute = normalizeRoute(
    window.sessionStorage.getItem(SAVE_NAVIGATION_PREVIOUS_ROUTE_KEY)
  );

  if (
    previousRoute &&
    previousRoute !== normalizedCurrent &&
    !GENERIC_SAVE_RETURN_ROUTES.has(previousRoute)
  ) {
    return previousRoute;
  }

  return normalizedFallback;
}

export function navigateToSavedReturnRoute(
  currentRoute: string,
  fallbackRoute: string
) {
  const targetRoute = resolveSaveReturnRoute(currentRoute, fallbackRoute);
  window.location.assign(targetRoute);
}

export function reloadSavedRoute(currentRoute: string) {
  const normalizedCurrent = normalizeRoute(currentRoute) || "/";
  window.location.assign(normalizedCurrent);
}

export function useSaveNavigation() {
  const pathname = usePathname();
  const currentRoute = useMemo(
    () => readCurrentRoute(pathname),
    [pathname]
  );

  return {
    currentRoute,
    returnAfterSave(fallbackRoute: string) {
      navigateToSavedReturnRoute(currentRoute, fallbackRoute);
    },
    reloadAfterSave() {
      reloadSavedRoute(currentRoute);
    },
  };
}
