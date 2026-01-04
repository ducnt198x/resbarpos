import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, Receipt, ShoppingBag, Loader2, Wallet, Users, Calendar, Filter } from 'lucide-react';
import { useCurrency } from '../CurrencyContext';
import { supabase } from '../supabase';

type FilterType = 'today' | 'week' | 'month' | 'custom';

export const Dashboard: React.FC = () => {
  const { formatPrice } = useCurrency();
  const [loading, setLoading] = useState(true);
  
  // --- Filter States ---
  const [filterType, setFilterType] = useState<FilterType>('today');
  const [customDate, setCustomDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');
  const [staffList, setStaffList] = useState<{id: string, full_name: string}[]>([]);

  // --- Data States ---
  const [stats, setStats] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [staffPerformanceData, setStaffPerformanceData] = useState<any[]>([]);

  useEffect(() => {
    const fetchStaff = async () => {
        const { data } = await supabase.from('users').select('id, full_name').order('full_name');
        if (data) setStaffList(data);
    };
    fetchStaff();
  }, []);

  const fetchData = useCallback(async () => {
      setLoading(true);
      
      const now = new Date();
      let startDateStr = '';
      let endDateStr = '';

      if (filterType === 'custom') {
          startDateStr = `${customDate}T00:00:00`;
          endDateStr = `${customDate}T23:59:59`;
      } else if (filterType === 'today') {
          const today = now.toISOString().split('T')[0];
          startDateStr = `${today}T00:00:00`;
          endDateStr = `${today}T23:59:59`;
      } else if (filterType === 'week') {
          const weekAgo = new Date(now);
          weekAgo.setDate(now.getDate() - 7);
          startDateStr = weekAgo.toISOString();
          endDateStr = now.toISOString();
      } else {
          const monthAgo = new Date(now);
          monthAgo.setDate(now.getDate() - 30);
          startDateStr = monthAgo.toISOString();
          endDateStr = now.toISOString();
      }
      
      const { data: orders } = await supabase
        .from('orders')
        .select('*, users(id, full_name)')
        .gte('created_at', startDateStr)
        .lte('created_at', endDateStr)
        .order('created_at', { ascending: true });
      
      if (orders) {
          const filteredOrders = selectedStaffId === 'all' 
             ? orders 
             : orders.filter(o => o.user_id === selectedStaffId);

          const activeOrders = filteredOrders.filter(o => o.status !== 'Cancelled');
          const completedOrders = filteredOrders.filter(o => o.status === 'Completed');

          const actualRevenue = completedOrders.reduce((acc, o) => acc + (o.total_amount || 0), 0);
          const provisionalRevenue = activeOrders.reduce((acc, o) => acc + (o.total_amount || 0), 0);
          const totalOrderCount = activeOrders.length;
          const completedCount = completedOrders.length;
          const avgTicket = completedCount > 0 ? actualRevenue / completedCount : 0;
          
          setStats([
             { label: 'Actual Revenue', val: formatPrice(actualRevenue), icon: DollarSign, color: 'text-green-500', bgColor: 'bg-green-500/10' },
             { label: 'Provisional Revenue', val: formatPrice(provisionalRevenue), icon: Wallet, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
             { label: 'Total Orders', val: totalOrderCount, icon: Receipt, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
             { label: 'Avg Ticket', val: formatPrice(avgTicket), icon: ShoppingBag, color: 'text-purple-500', bgColor: 'bg-purple-500/10' }
          ]);

          const isSingleDay = filterType === 'today' || filterType === 'custom';
          
          if (isSingleDay) {
            const hourly = new Array(24).fill(0);
            activeOrders.forEach(o => { 
                const h = new Date(o.created_at).getHours(); 
                hourly[h] += o.total_amount || 0; 
            });
            setRevenueData(hourly.map((v, i) => ({ name: `${i}:00`, value: v })));
          } else {
            const dailyMap: {[key: string]: number} = {};
            activeOrders.forEach(o => {
                const dateKey = new Date(o.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
                dailyMap[dateKey] = (dailyMap[dateKey] || 0) + (o.total_amount || 0);
            });
            setRevenueData(Object.keys(dailyMap).map(d => ({ name: d, value: dailyMap[d] })));
          }

          const staffMap: {[key: string]: { revenue: number, count: number }} = {};
          
          completedOrders.forEach(o => {
             const name = o.users?.full_name || o.staff_name || 'Unknown';
             if (!staffMap[name]) staffMap[name] = { revenue: 0, count: 0 };
             staffMap[name].revenue += (o.total_amount || 0);
             staffMap[name].count += 1;
          });

          const staffChart = Object.keys(staffMap)
             .map(name => ({ name, revenue: staffMap[name].revenue, orders: staffMap[name].count }))
             .sort((a, b) => b.revenue - a.revenue);
             
          setStaffPerformanceData(staffChart);
      }
      setLoading(false);
  }, [filterType, customDate, selectedStaffId, formatPrice]);

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const yAxisTicks = useMemo(() => {
    const maxVal = revenueData.length > 0 ? Math.max(...revenueData.map(d => d.value)) : 0;
    
    let limit = 2000000;
    if (maxVal > 2000000) {
        while (limit < maxVal) {
            limit += 1000000;
        }
    }
    
    if (isNaN(limit) || limit === Infinity) limit = 10000000;

    const step = limit <= 2000000 ? 500000 : 1000000;
    const ticks = [];
    for (let i = 0; i <= limit; i += step) {
        ticks.push(i);
    }
    
    return ticks;
  }, [revenueData]);

  const yAxisFormatter = (value: number) => {
    if (value === 0) return '0';
    if (value >= 1000000) return `${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return String(value);
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" size={48}/></div>;

  return (
    <div className="flex-1 h-full bg-background overflow-y-auto p-8 custom-scrollbar">
      
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-white">Dashboard Overview</h2>
            <p className="text-secondary text-sm mt-1">Real-time performance metrics</p>
          </div>

          <div className="flex flex-col md:flex-row gap-3 bg-surface p-2 rounded-xl border border-border w-full md:w-auto">
              <div className="flex bg-background rounded-lg p-1 border border-border">
                  {(['today', 'week', 'month'] as const).map(ft => (
                      <button
                        key={ft}
                        onClick={() => { setFilterType(ft); }}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold capitalize transition-all ${filterType === ft ? 'bg-primary text-background shadow' : 'text-secondary hover:text-white'}`}
                      >
                        {ft}
                      </button>
                  ))}
              </div>

              <div className="relative flex items-center gap-2 bg-background px-3 py-1.5 rounded-lg border border-border cursor-pointer hover:border-primary transition-colors group">
                  <Calendar size={14} className="text-secondary group-hover:text-primary transition-colors" />
                  <span className={`text-xs font-bold ${filterType === 'custom' ? 'text-primary' : 'text-white'}`}>
                    {customDate}
                  </span>
                  <input 
                    type="date" 
                    value={customDate}
                    onChange={(e) => { 
                        setCustomDate(e.target.value); 
                        setFilterType('custom'); 
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
              </div>

              <div className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-lg border border-border">
                  <Filter size={14} className="text-secondary" />
                  <select 
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    className="bg-transparent text-xs font-bold outline-none text-white appearance-none cursor-pointer min-w-[100px]"
                  >
                      <option value="all">All Staff</option>
                      {staffList.map(s => (
                          <option key={s.id} value={s.id}>{s.full_name}</option>
                      ))}
                  </select>
              </div>
          </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
         {stats.map((s, i) => (
             <div key={i} className="p-5 rounded-xl bg-surface border border-border flex flex-col justify-between hover:border-primary/30 transition-colors">
                 <div className="flex justify-between items-start mb-4">
                   <div>
                     <span className="text-secondary text-xs font-bold uppercase tracking-wider block mb-1">{s.label}</span>
                     <div className="text-2xl font-bold text-white">{s.val}</div>
                   </div>
                   <div className={`p-2 rounded-lg ${s.bgColor} ${s.color}`}>
                     <s.icon size={20} />
                   </div>
                 </div>
             </div>
         ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* --- Main Revenue Chart --- */}
        <div className="lg:col-span-2 bg-surface rounded-xl border border-border p-6 h-[450px] flex flex-col">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 rounded-lg text-primary"><DollarSign size={20}/></div>
                <div>
                    <h3 className="text-white font-bold text-lg">Revenue Trends</h3>
                    <p className="text-xs text-secondary">
                        {filterType === 'today' || filterType === 'custom' ? 'Hourly breakdown' : 'Daily breakdown'}
                    </p>
                </div>
            </div>
            {/* Added Explicit Style Dimensions to Fix Recharts Warning */}
            <div className="w-full" style={{ width: '100%', height: 400, minHeight: 400 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#24473b" vertical={false}/>
                    <XAxis 
                        dataKey="name" 
                        stroke="#93c8b6" 
                        fontSize={11} 
                        axisLine={false} 
                        tickLine={false} 
                        dy={10}
                    />
                    <YAxis 
                        stroke="#93c8b6" 
                        fontSize={11} 
                        axisLine={false} 
                        tickLine={false}
                        ticks={yAxisTicks}
                        tickFormatter={yAxisFormatter}
                        width={45}
                    />
                    <Tooltip 
                        contentStyle={{backgroundColor: '#1a2c26', borderRadius:'12px', border:'1px solid #24473b', color:'#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.5)'}} 
                        cursor={{fill:'#24473b', opacity:0.4}}
                        formatter={(value: number) => [formatPrice(value), 'Revenue']}
                        labelStyle={{color: '#93c8b6', marginBottom: '4px', fontSize: '12px'}}
                    />
                    <Bar 
                        dataKey="value" 
                        fill="#19e6a2" 
                        radius={[4,4,0,0]} 
                        barSize={filterType === 'today' || filterType === 'custom' ? 24 : 16}
                    />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* --- Staff Performance Chart --- */}
        <div className="bg-surface rounded-xl border border-border p-6 h-[450px] flex flex-col">
             <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500"><Users size={20}/></div>
                <div>
                    <h3 className="text-white font-bold text-lg">Staff Performance</h3>
                    <p className="text-xs text-secondary">Top revenue generators</p>
                </div>
            </div>
            {/* Added Explicit Style Dimensions to Fix Recharts Warning */}
            <div className="w-full" style={{ width: '100%', height: 400, minHeight: 400 }}>
                {staffPerformanceData.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-secondary opacity-50">
                        <Users size={48} strokeWidth={1} className="mb-2 text-border"/>
                        <p className="text-sm">No data available for this period</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={staffPerformanceData} layout="vertical" margin={{ top: 0, right: 20, left: 40, bottom: 0 }} barGap={2}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#24473b" horizontal={false}/>
                            <XAxis type="number" hide />
                            <YAxis 
                                dataKey="name" 
                                type="category" 
                                stroke="#fff" 
                                fontSize={11} 
                                width={80}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip 
                                cursor={{fill:'#24473b', opacity:0.4}}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                            <div className="bg-surface border border-border p-3 rounded-lg shadow-xl">
                                                <p className="font-bold text-white mb-1">{data.name}</p>
                                                <div className="space-y-1">
                                                    <p className="text-primary text-xs font-bold">Revenue: {formatPrice(data.revenue)}</p>
                                                    <p className="text-secondary text-xs">Orders: {data.orders}</p>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};