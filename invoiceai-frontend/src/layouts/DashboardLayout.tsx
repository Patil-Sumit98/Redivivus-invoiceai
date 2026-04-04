import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Home, Upload, List, Eye, Settings, X, Layers } from 'lucide-react';

const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: Home },
  { name: 'Upload Files', path: '/upload', icon: Upload },
  { name: 'Invoice History', path: '/invoices', icon: List },
  { name: 'Review Queue', path: '/review-queue', icon: Eye },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export const DashboardLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const location = useLocation();

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row overflow-hidden font-sans">
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/50 z-20 md:hidden transition-opacity backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside 
        className={`fixed md:static inset-y-0 left-0 z-30 transform transition-transform duration-300 ease-in-out bg-slate-900 text-white flex flex-col h-full shadow-2xl md:shadow-none
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${isExpanded ? 'md:w-64' : 'md:w-20'} w-64 shrink-0`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 shrink-0 bg-slate-950/50">
          <div className="flex items-center gap-3 overflow-hidden ml-1">
            <Layers className="h-7 w-7 text-blue-500 shrink-0" />
            <span className={`font-bold text-xl tracking-tight transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'md:opacity-0 md:hidden'}`}>
              InvoiceAI
            </span>
          </div>
          <button className="md:hidden p-2 -mr-2 text-gray-400 hover:text-white rounded-md hover:bg-slate-800" onClick={() => setIsSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            
            return (
              <NavLink
                key={item.name}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-3 rounded-md transition-all group relative
                  ${isActive 
                    ? 'bg-blue-600 text-white shadow-md font-semibold' 
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'}`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-white' : 'group-hover:text-white'}`} />
                <span className={`transition-all duration-300 whitespace-nowrap
                  ${isExpanded ? 'opacity-100' : 'md:opacity-0 md:w-0 md:overflow-hidden'}`}
                >
                  {item.name}
                </span>
                
                {!isExpanded && (
                  <div className="absolute left-full ml-4 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-xl border border-slate-700 hidden md:block">
                    {item.name}
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-slate-800 hidden md:block shrink-0 bg-slate-950/30">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors py-2"
          >
             <span className="text-xs uppercase font-bold tracking-wider">{isExpanded ? 'Collapse Menu' : '>>>'}</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        <Navbar onMenuClick={toggleSidebar} />
        
        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6 md:p-8 custom-scrollbar">
          <div className="max-w-[1600px] mx-auto w-full h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};