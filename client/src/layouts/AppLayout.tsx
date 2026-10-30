import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { NetworkBanner } from '../components/NetworkBanner';

interface AppLayoutProps {
  pendingCount?: number;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ pendingCount = 0 }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-cream text-black">
      {/* 1. Subtle, Persistent Connectivity Banner */}
      <NetworkBanner pendingCount={pendingCount} />

      {/* 2. Top Navigation */}
      <Navbar
        onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        isSidebarOpen={isSidebarOpen}
        pendingCount={pendingCount}
      />

      {/* 3. Main Workspace - Full Available Width */}
      <div className="flex-1 flex w-full">
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          pendingCount={pendingCount}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-y-auto w-full bg-cream">
          <Outlet />
        </main>
      </div>

      {/* 4. Minimal Neo-Brutalist Footer */}
      <footer className="border-t-2 border-black bg-white py-3.5 px-4 sm:px-6 lg:px-8 text-xs font-bold text-black">
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 RuralCare Connect — Offline-first field healthcare operations.</p>
          <div className="flex items-center gap-3 text-neutral-700">
            <span>Community Health Worker System</span>
            <span>•</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal border border-black" />
              IndexedDB & PostgreSQL
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
