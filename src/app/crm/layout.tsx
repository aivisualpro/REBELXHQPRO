'use client';

import React from 'react';
import { 
  Inbox, CheckCircle2, Clock, Trophy, Building2, Users, 
  GitBranch, MessageSquare, ListTodo, BarChart3, 
  Plus, Search, ListFilter, HelpCircle, Plug, Settings, 
  ChevronLeft, Phone, PhoneCall, Hourglass, 
  Eye, Briefcase, Activity, Send
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import ClientModal from '@/components/crm/ClientModal';

export default function CRMLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = React.useState<number | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = React.useState(false);
  const [clientModalType, setClientModalType] = React.useState<'Client' | 'Lead'>('Lead');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);

  const fetchUnreadCount = React.useCallback(async () => {
    try {
        const res = await fetch('/api/gmail?label=INBOX&limit=1');
        const data = await res.json();
        if (typeof data.unreadCount === 'number') {
            setUnreadCount(data.unreadCount);
        }
    } catch (e) {
        console.error("Failed to fetch unread count");
    }
  }, []);

  React.useEffect(() => {
    if (session?.user) {
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 60000); // Refresh every minute
        return () => clearInterval(interval);
    }
  }, [session?.user, fetchUnreadCount]);

  const isActive = (path: string) => pathname === path;

  return (
    <div className="flex h-screen w-full bg-white overflow-hidden font-sans">
      {/* Sidebar */}
      <div className={cn(
        "bg-[#1C1C1C] flex flex-col text-slate-400 h-full shrink-0 border-r border-[#2A2A2A] transition-all duration-300",
        isSidebarCollapsed ? "w-[80px]" : "w-[260px]"
      )}>
        
        {/* Top Navigation */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-0.5">
          
          {/* Inbox & Sent */}
          <div className="space-y-0.5">
            <Link href="/crm/inbox" className="block">
                <div className={cn(
                    "flex items-center rounded-md cursor-pointer transition-colors group",
                    isSidebarCollapsed ? "justify-center py-3 px-2" : "justify-between px-3 py-2",
                    isActive('/crm/inbox') ? "bg-[#2C2C2C] text-white" : "hover:bg-[#2A2A2A]"
                )}>
                  <div className={cn("flex items-center", isSidebarCollapsed ? "justify-center" : "space-x-3")}>
                    <Inbox className={cn("w-5 h-5 group-hover:text-white transition-colors", !isSidebarCollapsed && "mr-3")} />
                    {!isSidebarCollapsed && <span className="text-[14px] font-medium group-hover:text-white transition-colors">Inbox</span>}
                  </div>
                  {!!unreadCount && (
                    <span className="bg-[#FFEF5F] text-black text-[10px] font-black px-1.5 py-0.5 rounded-sm">
                        {unreadCount}
                    </span>
                  )}
                </div>
            </Link>

            <Link href="/crm/sent" className="block">
                <div className={cn(
                    "flex items-center rounded-md cursor-pointer transition-colors group",
                    isSidebarCollapsed ? "justify-center py-3 px-2" : "justify-between px-3 py-2",
                    isActive('/crm/sent') ? "bg-[#2C2C2C] text-white" : "hover:bg-[#2A2A2A]"
                )}>
                  <div className={cn("flex items-center", isSidebarCollapsed ? "justify-center" : "space-x-3")}>
                    <Send className={cn("w-5 h-5 group-hover:text-white transition-colors", !isSidebarCollapsed && "mr-3")} />
                    {!isSidebarCollapsed && <span className="text-[14px] font-medium group-hover:text-white transition-colors">Sent</span>}
                  </div>
                </div>
            </Link>

            <Link href="/crm/calls" className="block">
                <div className={cn(
                    "flex items-center rounded-md cursor-pointer transition-colors group",
                    isSidebarCollapsed ? "justify-center py-3 px-2" : "justify-between px-3 py-2",
                    isActive('/crm/calls') ? "bg-[#2C2C2C] text-white" : "hover:bg-[#2A2A2A]"
                )}>
                  <div className={cn("flex items-center", isSidebarCollapsed ? "justify-center" : "space-x-3")}>
                    <Phone className={cn("w-5 h-5 group-hover:text-white transition-colors", !isSidebarCollapsed && "mr-3")} />
                    {!isSidebarCollapsed && <span className="text-[14px] font-medium group-hover:text-white transition-colors">Calls</span>}
                  </div>
                </div>
            </Link>

            <Link href="/crm/sms" className="block">
                <div className={cn(
                    "flex items-center rounded-md cursor-pointer transition-colors group",
                    isSidebarCollapsed ? "justify-center py-3 px-2" : "justify-between px-3 py-2",
                    isActive('/crm/sms') ? "bg-[#2C2C2C] text-white" : "hover:bg-[#2A2A2A]"
                )}>
                  <div className={cn("flex items-center", isSidebarCollapsed ? "justify-center" : "space-x-3")}>
                    <MessageSquare className={cn("w-5 h-5 group-hover:text-white transition-colors", !isSidebarCollapsed && "mr-3")} />
                    {!isSidebarCollapsed && <span className="text-[14px] font-medium group-hover:text-white transition-colors">SMS</span>}
                  </div>
                </div>
            </Link>
          </div>

          {[
            { name: 'Done', icon: CheckCircle2, href: '/crm/done' },
            { name: 'Future', icon: Clock, href: '/crm/future' },
            { name: 'Opportunities', icon: Trophy, href: '/crm/opportunities' },
          ].map((item) => (
            <Link key={item.name} href={item.href} className="block">
                <div className={cn(
                  "flex items-center rounded-md cursor-pointer transition-colors group",
                  isSidebarCollapsed ? "justify-center py-3 px-2" : "px-3 py-2 hover:bg-[#2A2A2A]"
                )}>
                  <item.icon className={cn("w-5 h-5 group-hover:text-white transition-colors", !isSidebarCollapsed && "mr-3")} />
                  {!isSidebarCollapsed && <span className="text-[14px] font-medium group-hover:text-white transition-colors">{item.name}</span>}
                </div>
            </Link>
          ))}

          {/* Leads */}
          <div className="group/sidebar-item relative">
            <Link href="/crm/leads" className="block">
                <div className={cn(
                    "flex items-center rounded-md cursor-pointer transition-colors group",
                    isSidebarCollapsed ? "justify-center py-3 px-2" : "justify-between px-3 py-2",
                    isActive('/crm/leads') ? "bg-[#2C2C2C] text-white" : "hover:bg-[#2A2A2A]"
                )}>
                  <div className={cn("flex items-center", isSidebarCollapsed ? "justify-center" : "space-x-3")}>
                    <Building2 className={cn("w-5 h-5 group-hover:text-white transition-colors", !isSidebarCollapsed && "mr-3")} />
                    {!isSidebarCollapsed && <span className="text-[14px] font-medium group-hover:text-white transition-colors">Leads</span>}
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
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-[#3A3A3A] rounded transition-colors text-slate-500 hover:text-white"
            >
                <Plus className="w-4 h-4" />
            </button>
            )}
          </div>

           {/* Clients - New Tab */}
           <div className="group/sidebar-item relative">
            <Link href="/crm/clients" className="block">
                <div className={cn(
                    "flex items-center rounded-md cursor-pointer transition-colors group",
                    isSidebarCollapsed ? "justify-center py-3 px-2" : "justify-between px-3 py-2",
                    isActive('/crm/clients') ? "bg-[#2C2C2C] text-white" : "hover:bg-[#2A2A2A]"
                )}>
                  <div className={cn("flex items-center", isSidebarCollapsed ? "justify-center" : "space-x-3")}>
                    <Briefcase className={cn("w-5 h-5 group-hover:text-white transition-colors", !isSidebarCollapsed && "mr-3")} />
                    {!isSidebarCollapsed && <span className="text-[14px] font-medium group-hover:text-white transition-colors">Clients</span>}
                  </div>
                </div>
            </Link>
            {!isSidebarCollapsed && (
            <button 
                onClick={(e) => {
                    e.preventDefault();
                    setClientModalType('Client');
                    setIsClientModalOpen(true);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-[#3A3A3A] rounded transition-colors text-slate-500 hover:text-white"
            >
                <Plus className="w-4 h-4" />
            </button>
            )}
           </div>

          {/* Contacts */}
          <div className={cn(
            "flex items-center rounded-md cursor-pointer transition-colors group",
            isSidebarCollapsed ? "justify-center py-3 px-2" : "px-3 py-2 hover:bg-[#2A2A2A]"
          )}>
            <Users className={cn("w-5 h-5 group-hover:text-white transition-colors", !isSidebarCollapsed && "mr-3")} />
            {!isSidebarCollapsed && <span className="text-[14px] font-medium group-hover:text-white transition-colors">Contacts</span>}
          </div>

          {/* Workflows */}
          <div className={cn(
            "flex items-center rounded-md cursor-pointer transition-colors group",
            isSidebarCollapsed ? "justify-center py-3 px-2" : "justify-between px-3 py-2 hover:bg-[#2A2A2A]"
          )}>
            <div className={cn("flex items-center", isSidebarCollapsed ? "justify-center" : "space-x-3")}>
              <GitBranch className={cn("w-5 h-5 group-hover:text-white transition-colors", !isSidebarCollapsed && "mr-3")} />
              {!isSidebarCollapsed && <span className="text-[14px] font-medium group-hover:text-white transition-colors">Workflows</span>}
            </div>
            {!isSidebarCollapsed && <Plus className="w-4 h-4 hover:text-white" />}
          </div>

          {[
            { name: 'Conversations', icon: MessageSquare, href: '/crm/conversations' },
            { name: 'Tasks', icon: ListTodo, href: '/crm/tasks' },
            { name: 'Reports', icon: BarChart3, href: '/crm/reports' },
          ].map((item) => (
            <Link key={item.name} href={item.href} className="block">
                <div className={cn(
                    "flex items-center rounded-md cursor-pointer transition-colors group",
                    isSidebarCollapsed ? "justify-center py-3 px-2" : "px-3 py-2",
                    isActive(item.href) ? "bg-[#2C2C2C] text-white" : "hover:bg-[#2A2A2A]"
                )}>
                  <item.icon className={cn("w-5 h-5 group-hover:text-white transition-colors", !isSidebarCollapsed && "mr-3")} />
                  {!isSidebarCollapsed && <span className="text-[14px] font-medium group-hover:text-white transition-colors">{item.name}</span>}
                </div>
            </Link>
          ))}

          <div className="my-4 border-t border-[#2A2A2A]" />

          {/* Smart Views Header */}
          {!isSidebarCollapsed && (
          <div className="px-3 pb-2 flex items-center justify-between group">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Smart Views</span>
            <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <ListFilter className="w-3.5 h-3.5 hover:text-white cursor-pointer" />
              <Search className="w-3.5 h-3.5 hover:text-white cursor-pointer" />
            </div>
          </div>
          )}

          {/* Smart View Items */}
          <div className="space-y-0.5">
            <div className={cn(
              "flex items-center rounded-md cursor-pointer transition-colors hover:bg-[#2A2A2A]",
              isSidebarCollapsed ? "justify-center py-3 px-2" : "px-3 py-2"
            )}>
              <div className={cn("flex justify-center", !isSidebarCollapsed && "mr-3 w-5")}>
                <Phone className="w-4 h-4 text-slate-400" />
              </div>
              {!isSidebarCollapsed && <span className="text-[13px] text-slate-400">Daily Calling List</span>}
            </div>
            
            <div className={cn(
              "flex items-center rounded-md cursor-pointer transition-colors hover:bg-[#2A2A2A]",
              isSidebarCollapsed ? "justify-center py-3 px-2" : "px-3 py-2"
            )}>
              <div className={cn("flex justify-center", !isSidebarCollapsed && "mr-3 w-5")}>
                <div className="w-3 h-3 rounded-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.5)]" />
              </div>
              {!isSidebarCollapsed && <span className="text-[13px] text-slate-400">Red Flag Opportunities</span>}
            </div>

            <div className={cn(
              "flex items-center rounded-md cursor-pointer transition-colors hover:bg-[#2A2A2A]",
              isSidebarCollapsed ? "justify-center py-3 px-2" : "px-3 py-2"
            )}>
              <div className={cn("flex justify-center", !isSidebarCollapsed && "mr-3 w-5")}>
                <PhoneCall className="w-4 h-4 text-red-500" />
              </div>
              {!isSidebarCollapsed && <span className="text-[13px] text-slate-400">Leads to Call</span>}
            </div>

            <div className={cn(
              "flex items-center rounded-md cursor-pointer transition-colors hover:bg-[#2A2A2A]",
              isSidebarCollapsed ? "justify-center py-3 px-2" : "px-3 py-2"
            )}>
              <div className={cn("flex justify-center", !isSidebarCollapsed && "mr-3 w-5")}>
                <Hourglass className="w-4 h-4 text-amber-600" />
              </div>
              {!isSidebarCollapsed && <span className="text-[13px] text-slate-400">No Contact &gt; 7 Days</span>}
            </div>

            <div className={cn(
              "flex items-center rounded-md cursor-pointer transition-colors hover:bg-[#2A2A2A]",
              isSidebarCollapsed ? "justify-center py-3 px-2" : "px-3 py-2"
            )}>
              <div className={cn("flex justify-center", !isSidebarCollapsed && "mr-3 w-5")}>
                <Eye className="w-4 h-4 text-slate-400" />
              </div>
              {!isSidebarCollapsed && <span className="text-[13px] text-slate-400">Email Opened This Week</span>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#2A2A2A] space-y-0.5 bg-[#1C1C1C]">
          {[
            { name: 'Support & FAQs', icon: HelpCircle, external: true },
            { name: 'Integrations', icon: Plug },
            { name: 'Settings', icon: Settings },
          ].map((item) => (
            <div key={item.name} className={cn(
              "flex items-center rounded-md cursor-pointer transition-colors group",
              isSidebarCollapsed ? "justify-center py-3 px-2" : "justify-between px-3 py-2 hover:bg-[#2A2A2A]"
            )}>
              <div className={cn("flex items-center", isSidebarCollapsed ? "justify-center" : "space-x-3")}>
                <item.icon className={cn("w-5 h-5 group-hover:text-white transition-colors", !isSidebarCollapsed && "mr-3")} />
                {!isSidebarCollapsed && <span className="text-[14px] font-medium group-hover:text-white transition-colors">{item.name}</span>}
              </div>
              {!isSidebarCollapsed && item.external && <div className="text-xs">↗</div>}
            </div>
          ))}
          
          <div className="my-2 border-t border-[#2A2A2A]" />
          
          <div 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={cn(
              "flex items-center rounded-md cursor-pointer transition-colors group text-slate-500 hover:text-white hover:bg-[#2A2A2A]",
              isSidebarCollapsed ? "justify-center py-3 px-2" : "justify-between px-3 py-2"
            )}
            title={isSidebarCollapsed ? "Expand" : "Collapse"}
          >
            {!isSidebarCollapsed && <span className="text-[14px] font-medium">Collapse</span>}
            <ChevronLeft className={cn("w-5 h-5 transition-transform duration-300", isSidebarCollapsed && "rotate-180")} />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto bg-slate-50">
        {children}
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
