import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import { CategoriesProvider } from '../../context/CategoriesContext';

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <CategoriesProvider>
      <div className="flex min-h-screen">
        <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenu={() => setMenuOpen(true)} />
          {/* On phones, the bottom bar must not cover the end of the page */}
          <main className="main-with-nav mx-auto w-full max-w-[1280px] flex-1 px-4 pt-6 sm:px-8 sm:pt-8 lg:pb-8">
            <Outlet />
          </main>
        </div>
      </div>
      <BottomNav onMenu={() => setMenuOpen(true)} />
    </CategoriesProvider>
  );
}
