import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { App } from "./App";
import { PreferencesProvider } from "./preferences/preferences";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
    },
  },
});

const router = createBrowserRouter([
  {
    path: "*",
    element: <App />,
  },
]);

const root = document.getElementById("root");
if (!root) {
  throw new Error("The application root element is missing.");
}

createRoot(root).render(
  <StrictMode>
    <PreferencesProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </PreferencesProvider>
  </StrictMode>,
);
