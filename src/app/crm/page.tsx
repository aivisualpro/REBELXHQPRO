'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, Briefcase, DollarSign, Activity, 
  TrendingUp, TrendingDown, Clock, Phone, Mail, MessageSquare, Loader2,
  PieChart as PieChartIcon, BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// ─── Number Formatter ────────────────────────────────────────────────────────
const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);

export default function CRMDashboard() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/crm/dashboard')
      .then(res => res.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch(err => toast.error(err.message || 'Failed to load dashboard'))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">
            Compiling Intelligence...
          </span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { metrics, charts, recentActivities } = data;
  
  // Helpers for Tailwind bar charts
  const maxStageCount = Math.max(...(charts?.leadsByStage?.map((s: any) => s.count) || [1]));
  const totalLeadsTypes = charts?.leadsByType?.reduce((sum: number, t: any) => sum + t.count, 0) || 1;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden relative">
      {/* ─── Premium Header ─── */}
      <div className="shrink-0 relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent pointer-events-none" />
        <div className="relative px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-foreground uppercase tracking-tight flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              CRM Intelligence
            </h1>
            <p className="text-[12px] text-muted-foreground mt-1 tracking-wide">
              Real-time snapshot of your sales pipeline and activity
            </p>
          </div>
          <div className="text-[11px] font-black uppercase tracking-widest text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-lg border border-border">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-custom p-6 space-y-6">
        {/* ─── Key Metrics ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Clients"
            value={metrics?.totalClients || 0}
            icon={<Briefcase />}
            color="text-blue-500"
            bg="bg-blue-500/10"
            trend="+12%"
          />
          <MetricCard
            title="Total Leads"
            value={metrics?.totalLeads || 0}
            icon={<Users />}
            color="text-emerald-500"
            bg="bg-emerald-500/10"
            trend="+5%"
          />
          <MetricCard
            title="Pipeline Value"
            value={formatCurrency(metrics?.forecastedRevenue || 0)}
            icon={<DollarSign />}
            color="text-amber-500"
            bg="bg-amber-500/10"
            trend={null}
          />
          <MetricCard
            title="Monthly Activities"
            value={metrics?.activitiesThisMonth || 0}
            icon={<Activity />}
            color="text-violet-500"
            bg="bg-violet-500/10"
            trend={metrics?.activityGrowth ? `${metrics.activityGrowth > 0 ? '+' : ''}${metrics.activityGrowth}%` : '0%'}
            trendDown={metrics?.activityGrowth < 0}
          />
        </div>

        {/* ─── Charts Row ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          {/* Funnel/Stages (CSS Native Bar Chart) */}
          <div className="lg:col-span-2 bg-card border border-border rounded-xl shadow-sm flex flex-col">
            <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
              <h2 className="text-[12px] font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Pipeline Stages
              </h2>
            </div>
            <div className="p-6 flex-1 min-h-[300px] flex flex-col justify-center space-y-5">
              {(charts?.leadsByStage || []).map((stage: any, idx: number) => {
                const widthPct = Math.max(2, Math.round((stage.count / maxStageCount) * 100)); // minimum 2% width
                return (
                  <div key={idx} className="flex items-center gap-4 group">
                    <div className="w-32 text-[11px] font-bold text-muted-foreground uppercase tracking-widest truncate text-right">
                      {stage.name || 'Undefined'}
                    </div>
                    <div className="flex-1 flex items-center gap-3">
                      <div className="h-6 bg-blue-500 rounded-r-md rounded-l relative group-hover:bg-blue-400 transition-colors shadow-sm" style={{ width: `${widthPct}%` }} />
                      <span className="text-[12px] font-black text-foreground">{stage.count}</span>
                    </div>
                    <div className="w-24 text-[10px] font-bold text-muted-foreground/60 text-right">
                      {formatCurrency(stage.value || 0)}
                    </div>
                  </div>
                );
              })}
              {!(charts?.leadsByStage?.length) && (
                <div className="mt-10 text-center text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                  No pipeline data
                </div>
              )}
            </div>
          </div>

          {/* Type Distribution (CSS Breakdown) */}
          <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col">
            <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
              <h2 className="text-[12px] font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-emerald-500" />
                Company Types
              </h2>
            </div>
            <div className="p-6 flex-1 min-h-[300px] flex flex-col justify-center space-y-4">
              {/* Stacked visually like a bar pie */}
              <div className="w-full h-4 bg-secondary rounded-full overflow-hidden flex mb-2">
                {(charts?.leadsByType || []).map((type: any, idx: number) => {
                  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 'bg-pink-500', 'bg-sky-500'];
                  const widthPct = Math.round((type.count / totalLeadsTypes) * 100);
                  return (
                    <div key={idx} className={cn("h-full", colors[idx % colors.length])} style={{ width: `${widthPct}%` }} title={`${type.name}: ${type.count}`} />
                  );
                })}
              </div>

              {/* Legend List */}
              <div className="space-y-3 mt-4">
                {(charts?.leadsByType || []).map((type: any, idx: number) => {
                  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 'bg-pink-500', 'bg-sky-500'];
                  const pct = Math.round((type.count / totalLeadsTypes) * 100);
                  return (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2.5 h-2.5 rounded-full", colors[idx % colors.length])} />
                        <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">{type.name || 'Unknown'}</span>
                      </div>
                      <div className="text-[12px] font-black text-muted-foreground">
                        {type.count} <span className="text-[10px] opacity-50 font-normal">({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
                {!(charts?.leadsByType?.length) && (
                  <div className="text-center text-[11px] font-bold text-muted-foreground uppercase tracking-widest pt-4">
                    No type data
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* ─── Bottom Row ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* Activity Breakdown */}
          <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col">
            <div className="px-5 py-4 border-b border-border/50">
              <h2 className="text-[12px] font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-500" />
                Activity Breakdown (This Month)
              </h2>
            </div>
            <div className="p-5 flex-1 flex flex-col justify-center space-y-4">
              {(charts?.activityByType || []).map((act: any) => {
                const isEmail = act.name === 'Email';
                const isCall = act.name === 'Call';
                const IconWrapper = isEmail ? Mail : (isCall ? Phone : MessageSquare);
                const colorCls = isEmail ? 'text-blue-500' : (isCall ? 'text-emerald-500' : 'text-purple-500');
                const bgCls = isEmail ? 'bg-blue-500' : (isCall ? 'bg-emerald-500' : 'bg-purple-500');
                const total = metrics?.activitiesThisMonth || 1;
                const pct = Math.round((act.count / total) * 100);

                return (
                  <div key={act.name} className="flex items-center gap-4">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-border/50 shadow-sm", colorCls)}>
                      <IconWrapper className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-end mb-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">{act.name}s</span>
                        <span className="text-[12px] font-black text-foreground">{act.count}</span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", bgCls)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
              {!(charts?.activityByType?.length) && (
                 <p className="text-center text-[11px] font-bold text-muted-foreground uppercase tracking-widest py-8">
                   No activity data available
                 </p>
              )}
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col">
            <div className="px-5 py-4 border-b border-border/50">
              <h2 className="text-[12px] font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-violet-500" />
                Live Activity Feed
              </h2>
            </div>
            <div className="p-0 overflow-hidden flex-1">
              <div className="h-[280px] overflow-y-auto scrollbar-thin divide-y divide-border/50">
                {(recentActivities || []).map((act: any) => {
                  const isCall = act.type === 'Call';
                  const IconWrap = isCall ? Phone : (act.type === 'Email' ? Mail : MessageSquare);
                  const cc = isCall ? 'text-emerald-500' : (act.type === 'Email' ? 'text-blue-500' : 'text-purple-500');
                  
                  return (
                    <div key={act._id} className="p-3.5 hover:bg-muted/30 transition-colors flex items-start gap-3">
                      <div className={cn("w-7 h-7 rounded bg-secondary flex items-center justify-center shrink-0 mt-0.5", cc)}>
                        <IconWrap className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-foreground truncate">
                          {act.client?.name || 'Unknown Contact'}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5 max-w-sm">
                          {act.comments || `${act.type} logged by ${act.createdBy || 'System'}`}
                        </p>
                      </div>
                      <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest shrink-0">
                        {new Date(act.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  );
                })}
                {!(recentActivities?.length) && (
                   <p className="text-center text-[11px] font-bold text-muted-foreground uppercase tracking-widest py-10">
                     No recent activities
                   </p>
                )}
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function MetricCard({ title, value, icon, color, bg, trend, trendDown }: any) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
      <div className="flex justify-between items-start mb-4">
        <div className={cn("w-10 h-10 flex items-center justify-center rounded-xl transition-transform group-hover:scale-110", bg, color)}>
          {React.cloneElement(icon, { className: "w-5 h-5" })}
        </div>
        {trend && (
          <span className={cn(
            "text-[10px] font-black flex items-center gap-0.5 px-2 py-0.5 rounded-full border",
            trendDown ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
          )}>
            {trendDown ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
            {trend}
          </span>
        )}
      </div>
      <div>
        <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{title}</h3>
        <p className="text-2xl font-black text-foreground tracking-tight">{value}</p>
      </div>
    </div>
  );
}
