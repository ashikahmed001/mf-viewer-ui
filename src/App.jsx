import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-react';
import Layout from './components/Layout.jsx';
import AuthProvider from './components/AuthProvider.jsx';
import { SubscriptionProvider } from './context/SubscriptionContext.jsx';
import { FeatureFlagsProvider } from './context/FeatureFlagsContext.jsx';
import GatedPage from './components/GatedPage.jsx';

// ─── Auth shell — always bundled, needed before any plan check ────────────────
import SignInPage from './pages/SignInPage.jsx';
import SignUpPage from './pages/SignUpPage.jsx';

// ─── Core tier — downloaded on first navigation to each route ─────────────────
const Feed       = lazy(() => import('./pages/Feed.jsx'));
const Home       = lazy(() => import('./pages/Home.jsx'));
const FundDetail = lazy(() => import('./pages/FundDetail.jsx'));

// ─── Pro tier — separate chunks, never fetched on free/core routes ────────────
const Compare           = lazy(() => import('./pages/Compare.jsx'));
const CrossFundAnalysis = lazy(() => import('./pages/CrossFundAnalysis.jsx'));
const RisingConviction  = lazy(() => import('./pages/RisingConviction.jsx'));

// ─── Admin tier — chunk only fetched when isAdmin === true ────────────────────
const AdminPage    = lazy(() => import('./pages/AdminPage.jsx'));
const PricingPage  = lazy(() => import('./pages/PricingPage.jsx'));

// ─── Loading fallback ─────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
      <p className="text-sm text-slate-400">Loading…</p>
    </div>
  );
}

// ─── Admin-only route — redirects non-admins, skips chunk fetch ───────────────
const ADMIN_EMAIL = 'ashikahmed001@gmail.com';

function AdminRoute() {
  const { user, isLoaded } = useUser();
  if (!isLoaded) return <PageLoader />;
  if (user?.primaryEmailAddress?.emailAddress !== ADMIN_EMAIL) {
    return <Navigate to="/" replace />;
  }
  return <AdminPage />;
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <Routes>
      {/* Public — no chunk split needed, tiny components */}
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />

      {/* Protected — all page chunks loaded on demand */}
      <Route
        path="/*"
        element={
          <>
            <SignedIn>
              <AuthProvider>
                <SubscriptionProvider>
                <FeatureFlagsProvider>
                <Layout>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      {/* Core */}
                      <Route path="/"                  element={<Feed />} />
                      <Route path="/funds"             element={<Home />} />
                      <Route path="/funds/:id"         element={<FundDetail />} />

                      {/* Pro — each page wrapped in GatedPage so the flag is live-configurable */}
                      <Route path="/funds/:id/compare" element={
                        <GatedPage featureKey="compare_months" featureLabel="Month Comparison">
                          <Compare />
                        </GatedPage>
                      } />
                      <Route path="/analysis" element={
                        <GatedPage featureKey="cross_fund" featureLabel="Cross-Fund Analysis">
                          <CrossFundAnalysis />
                        </GatedPage>
                      } />
                      <Route path="/rising" element={
                        <GatedPage featureKey="rising_conviction" featureLabel="Rising Conviction">
                          <RisingConviction />
                        </GatedPage>
                      } />

                      {/* Admin — chunk gated, non-admins redirected before fetch */}
                      <Route path="/admin"             element={<AdminRoute />} />

                      {/* Pricing */}
                      <Route path="/pricing"           element={<PricingPage />} />
                    </Routes>
                  </Suspense>
                </Layout>
                </FeatureFlagsProvider>
                </SubscriptionProvider>
              </AuthProvider>
            </SignedIn>
            <SignedOut>
              <Navigate to="/sign-in" replace />
            </SignedOut>
          </>
        }
      />
    </Routes>
  );
}
