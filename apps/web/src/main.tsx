import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import { SignIn } from '@/pages/auth/SignIn';
import { SignUp } from '@/pages/auth/SignUp';
import { Dashboard } from '@/pages/home/Dashboard';
import { Profile } from '@/pages/home/Profile';
import { Projects } from '@/pages/home/Projects';
import { AcceptInvite } from '@/pages/organisation/AcceptInvite';
import { Organisation } from '@/pages/organisation/Organisation';
import { RateCards } from '@/pages/rate-cards/RateCards';
import { Shell } from '@/pages/shell/Shell';
import { can, useMe } from '@/lib/store';
import { Workspace } from '@/workspace/Workspace';
import { NotFound } from './pages/not-found/NotFound';

/** Signed in, and (when `allow` says so) allowed by role; the server decides in the end. */
function Guard({ children, allow }: { children: ReactNode; allow?: 'rates' | 'org' }) {
  const { me, loading } = useMe();
  if (loading) return null;
  if (!me) return <Navigate to="/signin" replace />;
  if (allow === 'rates' && !can(me.role).seeRateCards) return <Navigate to="/" replace />;
  if (allow === 'org' && !can(me.role).manageOrg) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// a screen that breaks is reported to the server's log
window.addEventListener('error', (event) => {
  void fetch('/api/v1/client-errors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: event.message, at: location.pathname }) }).catch(() => {});
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/invite/:id" element={<AcceptInvite />} />
        <Route path="/projects/:id" element={<Guard><Workspace /></Guard>} />
        <Route path="*" element={<NotFound />} />
        <Route element={<Guard><Shell /></Guard>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/rate-cards" element={<Guard allow="rates"><RateCards /></Guard>} />
          <Route path="/organisation" element={<Guard allow="org"><Organisation /></Guard>} />
          <Route path="/profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
