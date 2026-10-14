import React, { Suspense, lazy } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./auth";
import { ToastProvider } from "./toast";
import { Spinner } from "./ui";

import Layout from "./Layout";
import Login from "./pages/Login";
import Inventory from "./pages/Inventory";

// Lazy-loaded routes for code-splitting & ultra-fast initial load
const Purchases = lazy(() => import("./pages/Purchases"));
const PurchaseForm = lazy(() => import("./pages/PurchaseForm"));
const Sales = lazy(() => import("./pages/Sales"));
const SaleForm = lazy(() => import("./pages/SaleForm"));
const SaleDetail = lazy(() => import("./pages/SaleDetail"));
const Brokerage = lazy(() => import("./pages/Brokerage"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Assets = lazy(() => import("./pages/Assets"));
const Reports = lazy(() => import("./pages/Reports"));
const Buyers = lazy(() => import("./pages/Buyers"));
const PacketView = lazy(() => import("./pages/PacketView"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30000,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--surface)",
        }}
      >
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--surface)",
        }}
      >
        <Spinner />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/inventory" replace />;
  }

  return <>{children}</>;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an uncaught render error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            background: "var(--surface)",
            color: "var(--foreground)",
            fontFamily: "inherit",
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 520,
              width: "100%",
              padding: 28,
              textAlign: "center",
              border: "1px solid var(--border)",
              boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
            }}
          >
            <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>
              Something went wrong loading this view
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>
              {this.state.error?.message || "An unexpected rendering error occurred."}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
              >
                🔄 Refresh Page
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.hash = "#/inventory";
                  window.location.reload();
                }}
              >
                💎 Back to Inventory
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <HashRouter>
              <Suspense
                fallback={
                  <div
                    style={{
                      minHeight: "80vh",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "var(--surface)",
                    }}
                  >
                    <Spinner />
                  </div>
                }
              >
                <Routes>
                  {/* Public route */}
                  <Route
                    path="/login"
                    element={
                      <PublicRoute>
                        <Login />
                      </PublicRoute>
                    }
                  />

                  {/* Public Offline Packet Dossier Document View */}
                  <Route path="/packet/:id" element={<PacketView />} />
                  <Route path="/view/:id" element={<PacketView />} />

                  {/* Protected app shell */}
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }
                  >
                    {/* Default root redirects directly to Inventory (Dashboard removed) */}
                    <Route index element={<Navigate to="/inventory" replace />} />
                    <Route path="dashboard" element={<Navigate to="/inventory" replace />} />

                    {/* Boxes & Packet Inventory Master */}
                    <Route path="inventory" element={<Inventory />} />
                    <Route path="products" element={<Navigate to="/inventory" replace />} />

                    {/* Purchases & Packet Intake */}
                    <Route path="purchases" element={<Purchases />} />
                    <Route path="purchases/new" element={<PurchaseForm />} />
                    <Route path="purchases/:id/edit" element={<PurchaseForm />} />
                    <Route path="purchases/edit/:id" element={<PurchaseForm />} />

                    {/* Sales & Approvals Section */}
                    <Route path="sales" element={<Sales />} />
                    <Route path="sales/new" element={<SaleForm />} />
                    <Route path="sales/:id/edit" element={<SaleForm />} />
                    <Route path="sales/edit/:id" element={<SaleForm />} />
                    <Route path="sales/:id" element={<SaleDetail />} />
                    <Route path="billing" element={<Navigate to="/sales/new" replace />} />
                    <Route path="approvals" element={<Navigate to="/sales?tab=approvals" replace />} />

                    {/* Brokerage Section */}
                    <Route path="brokerage" element={<Brokerage />} />

                    {/* Expenses Section (Petty vs Business) */}
                    <Route path="expenses" element={<Expenses />} />

                    {/* Assets & Liquid Cash Section */}
                    <Route path="assets" element={<Assets />} />

                    {/* Overall Profit and Analytics (Password Protected) */}
                    <Route path="reports" element={<Reports />} />
                    <Route path="analytics" element={<Navigate to="/reports" replace />} />

                    {/* Buyers & Sellers Directory */}
                    <Route path="buyers" element={<Buyers />} />
                    <Route path="dealers" element={<Navigate to="/buyers" replace />} />
                  </Route>

                  {/* Fallback */}
                  <Route path="*" element={<Navigate to="/inventory" replace />} />
                </Routes>
              </Suspense>
            </HashRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}
