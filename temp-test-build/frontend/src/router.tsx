import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// Inject a global fetch timeout of 10 seconds to prevent un-aborted HTTP requests from hanging the UI
if (typeof window !== "undefined" && !(window as any).__fetchPatched__) {
  (window as any).__fetchPatched__ = true;
  const originalFetch = window.fetch;
  window.fetch = async function (input, init) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await originalFetch(input, {
        ...init,
        signal: init?.signal || controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw new Error("Request timed out. The server did not respond within 10 seconds.");
      }
      throw error;
    }
  };
}

export const getRouter = () => {
  // QueryClient config to fail fast instead of stalling on long retry sequences
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
        staleTime: 5000,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
