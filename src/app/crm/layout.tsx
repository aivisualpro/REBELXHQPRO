'use client';

import React, { Suspense } from 'react';
import {
  Trophy, Users,
  GitBranch, MessageSquare, ListTodo, BarChart3,
  Plus, Search, ListFilter, Settings,
  Phone, PhoneCall, Hourglass, AlertTriangle,
  Eye, Briefcase,
  PanelLeftClose, PanelLeftOpen, StickyNote, ShieldAlert
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import ClientModal from '@/components/crm/ClientModal';
import { usePermissions } from '@/hooks/usePermissions';

// ─── Smart Views Sidebar Component ──────────────────────────────────────────
const SMART_VIEWS = [
  {
    id: 'daily-calling',
    name: 'Daily Calling List',
    icon: <Phone className="w-4 h-4" />,
    iconColor: 'text-blue-500',
    activeGlow: 'shadow-blue-500/20',
    activeBg: 'bg-blue-500/10 border-blue-500/30',
    badgeColor: 'bg-blue-500'
  },

  {
    id: 'leads-to-call',
    name: 'Leads to Call',
    icon: <PhoneCall className="w-4 h-4" />,
    iconColor: 'text-orange-500',
    activeGlow: 'shadow-orange-500/20',
    activeBg: 'bg-orange-500/10 border-orange-500/30',
    badgeColor: 'bg-orange-500'
  },
  {
    id: 'no-contact-7d',
    name: 'No Contact > 7 Days',
    icon: <Hourglass className="w-4 h-4" />,
    iconColor: 'text-amber-500',
    activeGlow: 'shadow-amber-500/20',
    activeBg: 'bg-amber-500/10 border-amber-500/30',
    badgeColor: 'bg-amber-500'
  },

];

function SmartViewsSidebar({ isSidebarCollapsed }: { isSidebarCollapsed: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  const [countsLoaded, setCountsLoaded] = React.useState(false);

  React.useEffect(() => {
    const fetchCounts = async () => {
      try {
        const res = await fetch('/api/crm/smart-views');
        const data = await res.json();
        if (data.counts) {
          setCounts(data.counts);
        }
      } catch (error) {
        console.error('Failed to load smart view counts:', error);
      } finally {
        setCountsLoaded(true);
      }
    };
    fetchCounts();
    // Refresh every 2 minutes
    const interval = setInterval(fetchCounts, 120000);
    return () => clearInterval(interval);
  }, []);

  const isSmartViewActive = (viewId: string) => {
    return pathname === '/crm/smart-view' && searchParams?.get('view') === viewId;
  };

  return (
    <div className="space-y-0.5">
      {SMART_VIEWS.map((view) => {
        const count = counts[view.id] || 0;
        const isActive = isSmartViewActive(view.id);


        return (
          <Link
            key={view.id}
            href={`/crm/smart-view?view=${view.id}`}
            className="block"
            title={isSidebarCollapsed ? view.name : ''}
          >
            <div className={cn(
              "flex items-center rounded-md cursor-pointer transition-all duration-200 group/sv",
              isSidebarCollapsed ? "justify-center py-2.5 px-0" : "px-3 py-2",
              isActive
                ? cn("border", view.activeBg, view.activeGlow)
                : "hover:bg-secondary border border-transparent"
            )}>
              <div className={cn(
                "flex justify-center transition-transform duration-200 group-hover/sv:scale-110",
                !isSidebarCollapsed && "mr-3 w-5",
                isActive ? view.iconColor : 'text-muted'
              )}>
                {view.icon}
              </div>
              {!isSidebarCollapsed && (
                <>
                  <span className={cn(
                    "text-[13px] transition-colors flex-1 truncate",
                    isActive ? cn("font-semibold", view.iconColor) : "text-muted group-hover/sv:text-foreground"
                  )}>
                    {view.name}
                  </span>
                  {countsLoaded && count > 0 && (
                    <span className={cn(
                      "text-[9px] font-black text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none transition-all",
                      view.badgeColor,
                      isActive ? "opacity-100" : "opacity-70 group-hover/sv:opacity-100"
                    )}>
                      {count > 999 ? '999+' : count}
                    </span>
                  )}
                </>
              )}
              {isSidebarCollapsed && countsLoaded && count > 0 && (
                <span className={cn(
                  "absolute -top-0.5 -right-0.5 text-[7px] font-black text-white px-1 py-0 rounded-full min-w-[12px] text-center leading-tight",
                  view.badgeColor
                )}>
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default function CRMLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { isModuleEnabled, loading: permLoading } = usePermissions();
  const [isClientModalOpen, setIsClientModalOpen] = React.useState(false);
  const [clientModalType, setClientModalType] = React.useState<'Client' | 'Lead'>('Lead');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);

  // Load persistence and unread count
  React.useEffect(() => {
    const saved = localStorage.getItem('crmSidebarCollapsed');
    if (saved !== null) {
      setIsSidebarCollapsed(saved === 'true');
    }
    setIsMounted(true);
  }, []);

  // Close mobile sidebar on route change
  React.useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [pathname]);

  const toggleSidebar = React.useCallback(() => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('crmSidebarCollapsed', String(next));
      return next;
    });
  }, []);



  const isActive = (path: string) => pathname === path;

  // Route-level protection: block CRM if module is disabled
  if (!permLoading && !isModuleEnabled('crm')) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background gap-4">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-red-500/60" />
        </div>
        <h2 className="text-sm font-black text-foreground uppercase tracking-widest">Access Restricted</h2>
        <p className="text-[12px] text-muted-foreground max-w-sm text-center">
          CRM is not enabled in your workspace. Contact your administrator for access.
        </p>
        <button
          onClick={() => router.push('/')}
          className="mt-2 h-8 px-4 bg-primary text-primary-foreground hover:opacity-90 transition-all rounded-lg text-[10px] font-black uppercase tracking-widest cursor-pointer"
        >
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-background overflow-hidden font-sans">
      {/* Mobile sidebar backdrop */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[900] lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar toggle button */}
      <button
        onClick={() => setIsMobileSidebarOpen(prev => !prev)}
        className="fixed bottom-4 left-4 z-[950] lg:hidden w-11 h-11 bg-primary text-black rounded-full shadow-lg flex items-center justify-center hover:opacity-90 transition-all active:scale-95"
        aria-label="Toggle CRM sidebar"
      >
        {isMobileSidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
      </button>

      {/* Sidebar */}
      <div className={cn(
        "bg-card flex flex-col text-muted h-full shrink-0 border-r border-border transition-all duration-300 ease-in-out",
        // Mobile: fixed overlay
        "fixed lg:relative z-[910] lg:z-auto",
        isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        isSidebarCollapsed ? "w-[64px]" : "w-[260px]"
      )}>

        {/* Top Header & Toggle */}
        <div className={cn(
          "flex items-center shrink-0 border-b border-border transition-all duration-300",
          isSidebarCollapsed ? "justify-center h-9" : "justify-between h-9 px-4"
        )}>
          {!isSidebarCollapsed && (
            <span className="text-foreground font-black text-xs uppercase tracking-widest opacity-80">CRM Console</span>
          )}
          <button
            onClick={toggleSidebar}
            className="p-1.5 hover:bg-secondary rounded transition-colors text-muted hover:text-foreground"
            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isSidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-0.5">



          {/* Leads */}
          <div className="group/sidebar-item relative">
            <Link href="/crm/leads" className="block" title={isSidebarCollapsed ? "Leads" : ""}>
              <div className={cn(
                "flex items-center rounded-md cursor-pointer transition-colors group",
                isSidebarCollapsed ? "justify-center py-2.5 px-0" : "justify-between px-3 py-2",
                isActive('/crm/leads') ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
              )}>
                <div className={cn("flex items-center", isSidebarCollapsed ? "justify-center" : "space-x-3")}>
                  <Trophy className={cn("w-5 h-5 transition-colors", !isSidebarCollapsed && "mr-3", isActive('/crm/leads') ? "text-primary-foreground" : "group-hover:text-foreground")} />
                  {!isSidebarCollapsed && <span className={cn("text-[14px] font-medium transition-colors", isActive('/crm/leads') ? "text-primary-foreground" : "group-hover:text-foreground")}>Leads</span>}
                </div>
              </div>
            </Link>
            {!isSidebarCollapsed && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setClientModalType('Lead');
                  setIsClientModalOpen(true);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-secondary rounded transition-colors text-muted hover:text-foreground cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Clients - New Tab */}
          <div className="group/sidebar-item relative">
            <Link href="/crm/clients" className="block" title={isSidebarCollapsed ? "Clients" : ""}>
              <div className={cn(
                "flex items-center rounded-md cursor-pointer transition-colors group",
                isSidebarCollapsed ? "justify-center py-2.5 px-0" : "justify-between px-3 py-2",
                isActive('/crm/clients') ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
              )}>
                <div className={cn("flex items-center", isSidebarCollapsed ? "justify-center" : "space-x-3")}>
                  <Briefcase className={cn("w-5 h-5 transition-colors", !isSidebarCollapsed && "mr-3", isActive('/crm/clients') ? "text-primary-foreground" : "group-hover:text-foreground")} />
                  {!isSidebarCollapsed && <span className={cn("text-[14px] font-medium transition-colors", isActive('/crm/clients') ? "text-primary-foreground" : "group-hover:text-foreground")}>Clients</span>}
                </div>
              </div>
            </Link>
          </div>

          {[
            { name: 'Tasks', icon: ListTodo, href: '/crm/tasks' },
          ].map((item) => (
            <Link key={item.name} href={item.href} className="block" title={isSidebarCollapsed ? item.name : ""}>
              <div className={cn(
                "flex items-center rounded-md cursor-pointer transition-colors group",
                isSidebarCollapsed ? "justify-center py-2.5 px-0" : "px-3 py-2",
                isActive(item.href) ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
              )}>
                <item.icon className={cn("w-5 h-5 transition-colors", !isSidebarCollapsed && "mr-3", isActive(item.href) ? "text-primary-foreground" : "group-hover:text-foreground")} />
                {!isSidebarCollapsed && <span className={cn("text-[14px] font-medium transition-colors", isActive(item.href) ? "text-primary-foreground" : "group-hover:text-foreground")}>{item.name}</span>}
              </div>
            </Link>
          ))}

          <div className="my-4 border-t border-border" />

          {/* Smart Views Header */}
          {!isSidebarCollapsed && (
            <div className="px-3 pb-2 flex items-center justify-between group">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Smart Views</span>
              <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <ListFilter className="w-3.5 h-3.5 hover:text-foreground cursor-pointer" />
                <Search className="w-3.5 h-3.5 hover:text-foreground cursor-pointer" />
              </div>
            </div>
          )}

          {/* Smart View Items */}
          <Suspense fallback={null}>
            <SmartViewsSidebar isSidebarCollapsed={isSidebarCollapsed} />
          </Suspense>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border space-y-0.5 bg-card">
          {[
            { name: 'Settings', icon: Settings, href: '/crm/settings' },
          ].map((item) => (
            <Link key={item.name} href={item.href} title={isSidebarCollapsed ? item.name : ""} className="block">
              <div className={cn(
                "flex items-center rounded-md cursor-pointer transition-colors group",
                isSidebarCollapsed ? "justify-center py-2.5 px-0" : "justify-between px-3 py-2 hover:bg-secondary",
                isActive(item.href) ? "bg-primary text-primary-foreground" : ""
              )}>
                <div className={cn("flex items-center", isSidebarCollapsed ? "justify-center" : "space-x-3")}>
                  <item.icon className={cn("w-5 h-5 transition-colors", !isSidebarCollapsed && "mr-3", isActive(item.href) ? "text-primary-foreground" : "group-hover:text-foreground")} />
                  {!isSidebarCollapsed && <span className={cn("text-[14px] font-medium transition-colors", isActive(item.href) ? "text-primary-foreground" : "group-hover:text-foreground")}>{item.name}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background/50">
        {/* Content Header Bar - portal target for page-specific search/filters/actions */}
        <div id="crm-content-header-portal" className="shrink-0" />
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>

      <ClientModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        initialType={clientModalType}
        onSuccess={() => {
          // Force refresh if we are on the page of the type we just created
          const targetPath = clientModalType === 'Lead' ? '/crm/leads' : '/crm/clients';
          if (pathname === targetPath) {
            window.location.reload();
          } else {
            router.push(targetPath);
          }
        }}
      />
    </div>
  );
}
