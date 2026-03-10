import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from '../App';
import { LayoutWrapper } from '../pages/LayoutWrapper';

export const AppRouter = () => (
  <ErrorBoundary>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Navigate to="/visitor?page=home" replace />} />
        <Route path="/:role" element={<LayoutWrapper />} />
        <Route path="*" element={<Navigate to="/visitor?page=home" replace />} />
      </Routes>
    </BrowserRouter>
  </ErrorBoundary>
);
