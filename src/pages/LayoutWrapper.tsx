import React from 'react';
import { useParams } from 'react-router-dom';
import { ALLOWED_ROUTE_ROLES, App, type RouteRole } from '../App';

const InvalidRoleFallback = ({ invalidRole }: { invalidRole: string }) => (
  <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center p-6">
    <div className="max-w-md w-full bg-stone-900 border border-stone-800 rounded-3xl p-8 text-center shadow-2xl">
      <div className="text-xs uppercase tracking-[0.28em] text-amber-300">Invalid Role</div>
      <h1 className="text-3xl font-bold mt-3">Route not available</h1>
      <p className="text-stone-400 mt-3">
        The role <strong className="text-stone-200">{invalidRole || 'unknown'}</strong> is not supported.
      </p>
      <a
        href="/visitor?page=home"
        className="inline-flex mt-6 px-4 py-2 rounded-xl bg-amber-400 text-stone-900 font-semibold pointer-events-auto"
      >
        Go to visitor home
      </a>
    </div>
  </div>
);

export const LayoutWrapper = () => {
  const params = useParams<{ role: string }>();
  const rawRole = (params.role || '').toLowerCase();

  if (!ALLOWED_ROUTE_ROLES.includes(rawRole as RouteRole)) {
    return <InvalidRoleFallback invalidRole={params.role || ''} />;
  }

  return <App routeRole={rawRole as RouteRole} />;
};
