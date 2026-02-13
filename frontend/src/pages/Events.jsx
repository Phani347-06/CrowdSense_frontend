import React, { useState, useEffect } from 'react';
import { AlertTriangle, Info, CheckCircle, Bell, Users, Search, Filter } from 'lucide-react';

const defaultRegions = [
    { id: 'lib', name: 'Main Library', current: 425, capacity: 500, floor: 1, zone: 'A', status: 'High Congestion' },
    { id: 'canteen', name: 'Student Canteen', current: 120, capacity: 200, floor: 2, zone: 'B', status: 'Moderate' },
    { id: 'pg', name: 'PG Block', current: 45, capacity: 150, floor: 1, zone: 'C', status: 'Low Activity' },
    { id: 'dblock', name: 'Academic Block D', current: 50, capacity: 400, floor: 3, zone: 'D', status: 'Low Activity' },
    { id: 'jb', name: 'J-Block', current: 800, capacity: 1300, floor: 0, zone: 'E', status: 'Moderate' },
];

const Events = () => {
    const [regions, setRegions] = useState(defaultRegions);
    const [search, setSearch] = useState('');
    const [capacityOverrides, setCapacityOverrides] = useState({});

    // Fetch live data from backend
    useEffect(() => {
        const fetchLiveData = async () => {
            try {
                const response = await fetch('http://127.0.0.1:5000/api/live');
                if (response.ok) {
                    const data = await response.json();
                    if (data && Object.keys(data).length > 0) {
                        setRegions(prev => prev.map(region => {
                            const incoming = data[region.id];
                            if (incoming) {
                                return {
                                    ...region,
                                    current: incoming.current,
                                    capacity: capacityOverrides[region.id] || incoming.capacity,
                                    status: incoming.risk_level === 'CRITICAL' ? 'High Congestion' : incoming.risk_level === 'HIGH' ? 'High Congestion' : incoming.risk_level === 'MODERATE' ? 'Moderate' : 'Low Activity',
                                    cri: incoming.cri,
                                    predicted: incoming.predicted,
                                    surge: incoming.surge
                                };
                            }
                            return region;
                        }));
                    }
                }
            } catch (error) {
                console.log("Waiting for backend...");
            }
        };
        fetchLiveData();
        const interval = setInterval(fetchLiveData, 3000);
        return () => clearInterval(interval);
    }, [capacityOverrides]);

    const handleCapacityChange = (id, newCap) => {
        const val = Number(newCap);
        setCapacityOverrides(prev => ({ ...prev, [id]: val }));
        setRegions(regions.map(r => r.id === id ? { ...r, capacity: val } : r));
    };

    const filteredRegions = regions.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="space-y-8 max-w-[1600px] mx-auto">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Security & Event Planning</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Manage zone thresholds and monitor ML-predicted crowd surges.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search active zones..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-11 pr-6 py-3 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none w-72 transition-all shadow-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Smart Prediction Alerts Banner */}
            {regions.some(r => r.predicted > r.capacity || r.surge) && (
                <div className="relative overflow-hidden bg-gradient-to-r from-red-600 to-amber-600 p-[1px] rounded-3xl shadow-xl shadow-red-500/10">
                    <div className="bg-white dark:bg-slate-900 px-6 py-5 rounded-[23px] flex flex-col md:flex-row items-center gap-6">
                        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-red-500/10 text-red-600 shrink-0 animate-pulse">
                            <AlertTriangle size={32} />
                        </div>
                        <div className="flex-1 text-center md:text-left">
                            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1">Critical ML Intelligence Alerts</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {regions.filter(r => r.predicted > r.capacity).length} zone(s) predicted to breach capacity limit.
                                {regions.some(r => r.surge) && " Rapid crowd surge detected in active sectors."}
                            </p>
                        </div>
                        <div className="flex gap-3 shrink-0">
                            <button className="px-5 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-all">
                                Dismiss
                            </button>
                            <button className="px-6 py-2.5 bg-red-600 text-white text-sm font-black rounded-xl hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all">
                                Deploy Security
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Zone Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredRegions.map((region) => {
                    const load = Math.round((region.current / region.capacity) * 100);
                    const projectedLoad = Math.round((region.predicted / region.capacity) * 100);

                    let statusColor = 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400';
                    let loadBarColor = 'bg-green-500';
                    let Icon = CheckCircle;

                    if (load >= 90) {
                        statusColor = 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400';
                        loadBarColor = 'bg-red-500';
                        Icon = AlertTriangle;
                    } else if (load >= 60) {
                        statusColor = 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400';
                        loadBarColor = 'bg-amber-500';
                        Icon = Info;
                    }

                    return (
                        <div key={region.id} className="group relative bg-white dark:bg-slate-800 rounded-[32px] overflow-hidden border border-gray-100 dark:border-slate-700/50 shadow-sm hover:shadow-2xl hover:shadow-blue-500/5 transition-all duration-500">
                            {/* Card Header */}
                            <div className="p-8">
                                <div className="flex justify-between items-start mb-8">
                                    <div className="flex gap-5">
                                        <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-500/5 transition-all duration-500">
                                            <Users size={32} strokeWidth={1.5} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${statusColor}`}>
                                                    {region.status}
                                                </span>
                                            </div>
                                            <h3 className="text-xl font-black text-gray-900 dark:text-white">{region.name}</h3>
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter mt-1">Zone {region.zone} • Floor {region.floor}</p>
                                        </div>
                                    </div>
                                    <div className={`p-2 rounded-xl border ${load >= 90 ? 'border-red-100 bg-red-50 text-red-500' : 'border-gray-100 bg-gray-50 text-gray-400'} transition-colors`}>
                                        <Icon size={20} />
                                    </div>
                                </div>

                                {/* Main Stats */}
                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/30">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Live Count</p>
                                        <p className="text-2xl font-black text-gray-900 dark:text-white">{region.current}</p>
                                    </div>
                                    <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/30">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Current Load</p>
                                        <p className={`text-2xl font-black ${load >= 90 ? 'text-red-500' : 'text-blue-500'}`}>{load}%</p>
                                    </div>
                                </div>

                                {/* Progress Bars */}
                                <div className="space-y-6">
                                    {/* Current Progress bar */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            <span>Current Occupancy</span>
                                            <span>{load}%</span>
                                        </div>
                                        <div className="h-2.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden p-[2px]">
                                            <div
                                                className={`h-full rounded-full transition-all duration-1000 ${loadBarColor} shadow-[0_0_10px_rgba(0,0,0,0.1)]`}
                                                style={{ width: `${Math.min(100, load)}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* ML Prediction bar - Unique styling */}
                                    <div className="p-5 rounded-3xl bg-blue-500/5 border border-blue-500/10 space-y-3">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                                <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">ML Prediction Insights</span>
                                            </div>
                                            <span className="text-sm font-black text-blue-600 dark:text-blue-400">{projectedLoad}%</span>
                                        </div>
                                        <div className="h-1.5 bg-blue-500/10 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-1000"
                                                style={{ width: `${Math.min(100, projectedLoad)}%` }}
                                            />
                                        </div>
                                        <p className="text-[10px] font-medium text-blue-500/70 italic leading-snug">
                                            Expected density: <span className="font-bold">{region.predicted}</span> in next cycle.
                                            {region.surge && " WARNING: High velocity growth detected."}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Card Footer Tools */}
                            <div className="px-8 py-6 bg-slate-50 dark:bg-slate-900/30 border-t border-gray-100 dark:border-slate-700/50 space-y-5">
                                <div>
                                    <div className="flex justify-between text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-tighter">
                                        <span>Risk Threshold Management</span>
                                        <span className="text-blue-600 font-black">{region.capacity} devices</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="50"
                                        max="1500"
                                        value={region.capacity}
                                        onChange={(e) => handleCapacityChange(region.id, e.target.value)}
                                        className="w-full h-1.5 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-600 dark:text-gray-400 flex items-center gap-2">
                                        <Bell size={14} className="text-blue-500" /> Threshold Alerts
                                    </span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" defaultChecked={load > 70} />
                                        <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

};

export default Events;
