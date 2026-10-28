import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, Link, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, MasterData } from '../../api/client';
import { ChevronDown, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import DetailedEntryDrawer from '../payment-entry/DetailedEntryDrawer';

export default function AppLayout() {
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [detailedOpen, setDetailedOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch master data for global detailed entry drawer
  const { data: master } = useQuery<MasterData>({
    queryKey: ['master-data-all'],
    queryFn: () => api<MasterData>('/master-data?includeInactive=true')
  });

  const handleSaved = () => {
    queryClient.invalidateQueries();
  };

  const refreshWorkspace = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries();
      await queryClient.refetchQueries({ type: 'active' });
      toast.success('Workspace refreshed');
    } finally {
      setRefreshing(false);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcuts (N -> record payment modal, / -> focus input, G -> T/L/P/R/A/O/S chord navigation)
  useEffect(() => {
    let gPressed = false;
    let gTimeout: number | undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isTyping =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.getAttribute('contenteditable') === 'true');

      // Escape behavior: close drawer or blur active element if typing
      if (e.key === 'Escape') {
        if (isTyping && activeEl instanceof HTMLElement) {
          activeEl.blur();
        }
        window.dispatchEvent(new CustomEvent('close-all-overlays'));
        return;
      }

      // / key focuses quick input or search input
      const firstInput = document.querySelector(
        'input[type="text"], input[role="combobox"]'
      ) as HTMLInputElement;
      if (e.key === '/' && (!isTyping || activeEl === firstInput)) {
        e.preventDefault();
        if (firstInput) {
          firstInput.focus();
          firstInput.select();
        }
        return;
      }

      // N key opens global Detailed Entry drawer form
      if ((e.key === 'n' || e.key === 'N') && !isTyping && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        setDetailedOpen(true);
        return;
      }

      // Alt + 1..7 routing chords
      if (e.altKey) {
        const keyMap: Record<string, string> = {
          '1': '/',
          '2': '/ledger',
          '3': '/review',
          '4': '/payees',
          '5': '/activity',
          '6': '/system',
          '7': '/reports'
        };
        if (keyMap[e.key]) {
          e.preventDefault();
          navigate(keyMap[e.key]!);
          return;
        }
      }

      // Chord G then T/L/R/P/A/O/S
      if (!isTyping) {
        const key = e.key.toLowerCase();
        if (key === 'g') {
          gPressed = true;
          window.clearTimeout(gTimeout);
          gTimeout = window.setTimeout(() => {
            gPressed = false;
          }, 1000);
          return;
        }

        if (gPressed) {
          const chordMap: Record<string, string> = {
            t: '/',
            l: '/ledger',
            r: '/review',
            p: '/payees',
            a: '/activity',
            o: '/reports',
            s: '/system'
          };
          if (chordMap[key]) {
            e.preventDefault();
            gPressed = false;
            window.clearTimeout(gTimeout);
            navigate(chordMap[key]!);
            return;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.clearTimeout(gTimeout);
    };
  }, [navigate]);

  useEffect(() => {
    const openDetailedEntry = () => setDetailedOpen(true);
    window.addEventListener('payment-ledger:open-detailed-entry', openDetailedEntry);
    return () => window.removeEventListener('payment-ledger:open-detailed-entry', openDetailedEntry);
  }, []);

  const primaryNavItems = [
    { label: 'Today', path: '/', key: '1' },
    {
      label: 'Payment Inbox',
      path: '/ledger',
      key: '2'
    },
    { label: 'Payees', path: '/payees', key: '4' },
    { label: 'Reports', path: '/reports', key: '7' }
  ];

  const moreNavItems = [
    { label: 'Activity', path: '/activity', key: '5' },
    { label: 'Export', path: '/export', key: '8' },
    { label: 'System', path: '/system', key: '6' }
  ];

  const allMobileNavItems = [
    { label: 'Today', path: '/' },
    {
      label: 'Payment Inbox',
      path: '/ledger'
    },
    { label: 'Payees', path: '/payees' },
    { label: 'Reports', path: '/reports' },
    { label: 'Activity', path: '/activity' },
    { label: 'Export', path: '/export' },
    { label: 'System', path: '/system' }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F8FC] text-[#111827] font-sans">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      {/* Top Header Navigation Bar (Section 3 App Shell Spec) */}
      <header className="sticky top-0 z-40 h-[56px] grid grid-cols-[1fr_auto_1fr] items-center bg-white/90 backdrop-blur-md border-b border-[#DDE3EC] px-6 shadow-xs">
        {/* Brand & Workspace */}
        <div className="flex items-center gap-3">
          <Link className="flex items-center gap-2 rounded-lg" to="/" aria-label="Payment Ledger home">
            <span className="w-8 h-8 rounded-lg bg-[#165DFF] text-white flex items-center justify-center font-black text-sm shadow-xs">
              ₹
            </span>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-[#111827] leading-tight">
                Payment Ledger
              </span>
              <span className="text-[10px] font-semibold text-[#667085] leading-none">
                One Cashbook
              </span>
            </div>
          </Link>
        </div>

        {/* Centered Navigation Items */}
        <nav className="hidden lg:flex items-center gap-1.5" aria-label="Primary navigation">
          {primaryNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-[#E9F1FF] text-[#165DFF] font-bold shadow-2xs'
                    : 'text-[#667085] hover:text-[#111827] hover:bg-slate-100/70'
                }`
              }
            >
              <span>{item.label}</span>
            </NavLink>
          ))}

          {/* More Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-full text-[#667085] hover:text-[#111827] hover:bg-slate-100/70 cursor-pointer transition-colors ${
                moreOpen ? 'bg-slate-100 text-[#111827]' : ''
              }`}
            >
              <span>More</span>
              <ChevronDown size={12} className={`transform transition-transform duration-200 ${moreOpen ? 'rotate-180' : ''}`} />
            </button>
            {moreOpen && (
              <div className="absolute right-0 mt-2.5 w-36 bg-white border border-[#DDE3EC] rounded-xl shadow-lg py-1.5 z-50">
                {moreNavItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMoreOpen(false)}
                    className={({ isActive }) =>
                      `block px-4 py-2 text-xs font-semibold hover:bg-slate-50 text-[#667085] hover:text-[#111827] ${
                        isActive ? 'text-[#165DFF] bg-[#E9F1FF]/30 font-bold' : ''
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={refreshWorkspace}
            disabled={refreshing}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#DDE3EC] bg-white text-[#667085] transition-colors hover:border-[#B8C7DE] hover:bg-[#F6F8FC] hover:text-[#165DFF] disabled:opacity-60"
            aria-label="Refresh current data"
            title="Refresh current data"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setDetailedOpen(true)}
            className="btn btn-primary h-9 px-4 gap-1.5 shadow-xs cursor-pointer text-xs text-white bg-[#165DFF] hover:bg-[#165DFF]/90 border border-transparent font-bold rounded-full transition-colors flex items-center justify-center whitespace-nowrap"
          >
            <Plus size={14} />
            <span>Add Payment</span>
          </button>
        </div>
      </header>

      <nav
        className="fixed bottom-3 left-3 right-3 z-40 flex items-center gap-1 overflow-x-auto rounded-2xl border border-[#DDE3EC] bg-white/95 p-2 shadow-lg backdrop-blur-md lg:hidden"
        aria-label="Mobile primary navigation"
      >
        {allMobileNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `min-w-max rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                isActive ? 'bg-[#E9F1FF] text-[#165DFF]' : 'text-[#667085] hover:bg-slate-100'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Main Content Workspace */}
      <main id="main-content" tabIndex={-1} className="flex-1 w-full lg:w-[80%] mx-auto p-3 pb-24 md:p-4 lg:px-5 lg:pb-5 flex flex-col">
        <Outlet />
      </main>
      {detailedOpen && master && (
        <DetailedEntryDrawer
          open={detailedOpen}
          onClose={() => setDetailedOpen(false)}
          master={master}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
