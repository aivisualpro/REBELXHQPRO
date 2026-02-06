'use client';

import React from 'react';
import { 
  Inbox, Trophy, Users, 
  GitBranch, MessageSquare, ListTodo, BarChart3, 
  Plus, Search, ListFilter, HelpCircle, Plug, Settings, 
  Phone, PhoneCall, Hourglass, 
  Eye, Briefcase, Send,
  PanelLeftClose, PanelLeftOpen, StickyNote
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState<boolean>(false);
  const [isMounted, setIsMounted] = React.useState(false);

  // Load persistence and unread count
  React.useEffect(() => {
    const saved = localStorage.getItem('crmSidebarCollapsed');
    if (saved !== null) {
      setIsSidebarCollapsed(saved === 'true');
    }
    setIsMounted(true);
  }, []);

  const toggleSidebar = React.useCallback(() => {
    setIsSidebarCollapsed(prev => {
        const next = !prev;
        localStorage.setItem('crmSidebarCollapsed', String(next));
        return next;
    });
  }, []);

  const fetchUnreadCount = React.useCallback(async () => {
    try {
        // First, check if filtering is enabled
        const settingsRes = await fetch('/api/settings');
        const settings = await settingsRes.json();
        const filterEnabled = settings.crmFilterEmailsByClients === true;
        
        if (filterEnabled) {
          // Fetch client emails and filtered inbox emails
          const [clientsRes, gmailRes] = await Promise.all([
            fetch('/api/clients?limit=10000'),
            fetch('/api/gmail?label=INBOX')
          ]);
          
          const clientsData = await clientsRes.json();
          const gmailData = await gmailRes.json();
          
          // Extract all client emails
          const clientEmails: string[] = [];
          clientsData.clients?.forEach((client: any) => {
            client.emails?.forEach((e: any) => {
              if (e.value) clientEmails.push(e.value.toLowerCase().trim());
            });
          });
          
          // Filter emails by client emails and count unread
          if (gmailData.emails && clientEmails.length > 0) {
            const filteredUnread = gmailData.emails.filter((email: any) => {
              const senderEmail = (email.senderEmail || '').toLowerCase().trim();
              const allRecipients = [
                email.recipient || '',
                email.cc || '',
                email.bcc || ''
              ].join(' ').toLowerCase();
              
              const senderMatch = clientEmails.some(ce => senderEmail.includes(ce) || ce.includes(senderEmail));
              const recipientMatch = clientEmails.some(ce => allRecipients.includes(ce));
              
              return (senderMatch || recipientMatch) && !email.isRead;
            }).length;
            
            setUnreadCount(filteredUnread);
          } else {
            setUnreadCount(0);
          }
        } else {
          // Use standard Gmail unread count
          const res = await fetch('/api/gmail?label=INBOX&limit=1');
          const data = await res.json();
          if (typeof data.unreadCount === 'number') {
            setUnreadCount(data.unreadCount);
          }
        }
    } catch (e) {
        console.error("Failed to fetch unread count", e);
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
    <div className="flex h-full w-full bg-background overflow-hidden font-sans">
      {/* Sidebar */}
      <div className={cn(
        "bg-card flex flex-col text-muted h-full shrink-0 border-r border-border transition-all duration-300 ease-in-out",
        isSidebarCollapsed ? "w-[64px]" : "w-[260px]"
      )}>
        
        {/* Top Header & Toggle */}
        <div className={cn(
          "flex items-center shrink-0 border-b border-border transition-all duration-300",
          isSidebarCollapsed ? "justify-center h-11" : "justify-between h-11 px-4"
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
          
          {/* Inbox & Sent */}
          <div className="space-y-0.5">
            <Link href="/crm/inbox" className="block" title={isSidebarCollapsed ? "Inbox" : ""}>
                <div className={cn(
                    "flex items-center rounded-md cursor-pointer transition-colors group",
                    isSidebarCollapsed ? "justify-center py-2.5 px-0" : "justify-between px-3 py-2",
                    isActive('/crm/inbox') ? "bg-[#FFEF5F] text-black" : "hover:bg-secondary"
                )}>
                  <div className={cn("flex items-center", isSidebarCollapsed ? "justify-center" : "space-x-3")}>
                    <Inbox className={cn("w-5 h-5 transition-colors", !isSidebarCollapsed && "mr-3", isActive('/crm/inbox') ? "text-black" : "group-hover:text-foreground")} />
                    {!isSidebarCollapsed && <span className={cn("text-[14px] font-medium transition-colors", isActive('/crm/inbox') ? "text-black" : "group-hover:text-foreground")}>Inbox</span>}
                  </div>
                  {!!unreadCount && (
                    <span className={cn(
                        "bg-black text-white text-[10px] font-black rounded-sm",
                        isSidebarCollapsed ? "absolute top-1 right-1 px-1 py-0 min-w-[12px] text-center" : "px-1.5 py-0.5"
                    )}>
                        {unreadCount}
                    </span>
                  )}
                </div>
            </Link>

          {[
            { name: 'Sent', icon: Send, href: '/crm/sent' },
          ].map((item) => (
            <Link key={item.name} href={item.href} className="block" title={isSidebarCollapsed ? item.name : ""}>
                <div className={cn(
                  "flex items-center rounded-md cursor-pointer transition-colors group",
                  isSidebarCollapsed ? "justify-center py-2.5 px-0" : "px-3 py-2",
                  isActive(item.href) ? "bg-[#FFEF5F] text-black" : "hover:bg-secondary"
                )}>
                  <item.icon className={cn("w-5 h-5 transition-colors", !isSidebarCollapsed && "mr-3", isActive(item.href) ? "text-black" : "group-hover:text-foreground")} />
                  {!isSidebarCollapsed && <span className={cn("text-[14px] font-medium transition-colors", isActive(item.href) ? "text-black" : "group-hover:text-foreground")}>{item.name}</span>}
                </div>
            </Link>
          ))}
          </div>

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

          {/* Contacts */}
          <div title={isSidebarCollapsed ? "Contacts" : ""} className={cn(
            "flex items-center rounded-md cursor-pointer transition-colors group",
            isSidebarCollapsed ? "justify-center py-2.5 px-0" : "px-3 py-2 hover:bg-secondary"
          )}>
            <Users className={cn("w-5 h-5 group-hover:text-foreground transition-colors", !isSidebarCollapsed && "mr-3")} />
            {!isSidebarCollapsed && <span className="text-[14px] font-medium group-hover:text-foreground transition-colors">Contacts</span>}
          </div>

          {/* Workflows */}
          <div title={isSidebarCollapsed ? "Workflows" : ""} className={cn(
            "flex items-center rounded-md cursor-pointer transition-colors group",
            isSidebarCollapsed ? "justify-center py-2.5 px-0" : "justify-between px-3 py-2 hover:bg-secondary"
          )}>
            <div className={cn("flex items-center", isSidebarCollapsed ? "justify-center" : "space-x-3")}>
              <GitBranch className={cn("w-5 h-5 group-hover:text-foreground transition-colors", !isSidebarCollapsed && "mr-3")} />
              {!isSidebarCollapsed && <span className="text-[14px] font-medium group-hover:text-foreground transition-colors">Workflows</span>}
            </div>
            {!isSidebarCollapsed && <Plus className="w-4 h-4 hover:text-foreground" />}
          </div>

          {[
            { name: 'Conversations', icon: MessageSquare, href: '/crm/conversations' },
            { name: 'Tasks', icon: ListTodo, href: '/crm/tasks' },
            { name: 'Notes', icon: StickyNote, href: '/crm/notes' },
            { name: 'Reports', icon: BarChart3, href: '/crm/reports' },
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
          <div className="space-y-0.5">
            <div title={isSidebarCollapsed ? "Daily Calling List" : ""} className={cn(
              "flex items-center rounded-md cursor-pointer transition-colors hover:bg-secondary",
              isSidebarCollapsed ? "justify-center py-2.5 px-0" : "px-3 py-2"
            )}>
              <div className={cn("flex justify-center", !isSidebarCollapsed && "mr-3 w-5")}>
                <Phone className="w-4 h-4 text-muted" />
              </div>
              {!isSidebarCollapsed && <span className="text-[13px] text-muted group-hover:text-foreground transition-colors">Daily Calling List</span>}
            </div>
            
            <div title={isSidebarCollapsed ? "Red Flag Opportunities" : ""} className={cn(
              "flex items-center rounded-md cursor-pointer transition-colors hover:bg-secondary",
              isSidebarCollapsed ? "justify-center py-2.5 px-0" : "px-3 py-2"
            )}>
              <div className={cn("flex justify-center", !isSidebarCollapsed && "mr-3 w-5")}>
                <div className="w-3 h-3 rounded-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.5)]" />
              </div>
              {!isSidebarCollapsed && <span className="text-[13px] text-muted group-hover:text-foreground transition-colors">Red Flag Opportunities</span>}
            </div>

            <div title={isSidebarCollapsed ? "Leads to Call" : ""} className={cn(
              "flex items-center rounded-md cursor-pointer transition-colors hover:bg-secondary",
              isSidebarCollapsed ? "justify-center py-2.5 px-0" : "px-3 py-2"
            )}>
              <div className={cn("flex justify-center", !isSidebarCollapsed && "mr-3 w-5")}>
                <PhoneCall className="w-4 h-4 text-red-500" />
              </div>
              {!isSidebarCollapsed && <span className="text-[13px] text-muted group-hover:text-foreground transition-colors">Leads to Call</span>}
            </div>

            <div title={isSidebarCollapsed ? "No Contact > 7 Days" : ""} className={cn(
              "flex items-center rounded-md cursor-pointer transition-colors hover:bg-secondary",
              isSidebarCollapsed ? "justify-center py-2.5 px-0" : "px-3 py-2"
            )}>
              <div className={cn("flex justify-center", !isSidebarCollapsed && "mr-3 w-5")}>
                <Hourglass className="w-4 h-4 text-amber-600" />
              </div>
              {!isSidebarCollapsed && <span className="text-[13px] text-muted group-hover:text-foreground transition-colors">No Contact &gt; 7 Days</span>}
            </div>

            <div title={isSidebarCollapsed ? "Email Opened This Week" : ""} className={cn(
              "flex items-center rounded-md cursor-pointer transition-colors hover:bg-secondary",
              isSidebarCollapsed ? "justify-center py-2.5 px-0" : "px-3 py-2"
            )}>
              <div className={cn("flex justify-center", !isSidebarCollapsed && "mr-3 w-5")}>
                <Eye className="w-4 h-4 text-muted" />
              </div>
              {!isSidebarCollapsed && <span className="text-[13px] text-muted group-hover:text-foreground transition-colors">Email Opened This Week</span>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border space-y-0.5 bg-card">
          {[
            { name: 'Support & FAQs', icon: HelpCircle, external: true, href: '#' },
            { name: 'Integrations', icon: Plug, href: '#' },
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
                {!isSidebarCollapsed && item.external && <div className="text-xs">↗</div>}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto bg-background/50">
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
