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
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Active Zones</h2>
                <div className="flex gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search zones..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none w-64"
                        />
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                        <Filter size={16} /> Filter
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredRegions.map((region) => {
                    const load = Math.round((region.current / region.capacity) * 100);
                    let statusText = region.status;
                    let statusColor = 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400';
                    let loadColor = 'bg-green-500';
                    let Icon = CheckCircle;

                    if (region.status === 'Closed') {
                        statusColor = 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-gray-400';
                        loadColor = 'bg-gray-400';
                        Icon = Info;
                    } else {
                        if (load >= 90) {
                            statusText = 'High Congestion';
                            statusColor = 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400';
                            loadColor = 'bg-red-500';
                            Icon = AlertTriangle;
                        } else if (load >= 60) {
                            statusText = 'Moderate';
                            statusColor = 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
                            loadColor = 'bg-amber-500';
                            Icon = Info;
                        } else {
                            statusText = 'Low Activity';
                            statusColor = 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400';
                            loadColor = 'bg-green-500';
                            Icon = CheckCircle;
                        }
                    }

                    // Show warning if predicted density exceeds event capacity
                    const overCapacity = region.predicted && region.predicted > region.capacity;

                    return (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-md transition-shadow group" key={region.id}>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${statusColor.replace('text-', 'bg-opacity-20 ')}`}>
                                        <Users size={24} className="opacity-80" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-900 dark:text-white leading-tight">{region.name}</h3>
                                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
                                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 rounded text-gray-600 dark:text-gray-300">Zone {region.zone}</span>
                                            <span>Floor {region.floor}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 ${statusColor}`}>
                                    <Icon size={12} /> {statusText}
                                </div>
                            </div>

                            {/* Over Capacity Warning */}
                            {overCapacity && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2 mb-4 flex items-center gap-2">
                                    <AlertTriangle size={14} className="text-red-500 shrink-0" />
                                    <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                                        Predicted density ({region.predicted}) exceeds capacity ({region.capacity})!
                                    </span>
                                </div>
                            )}

                            {/* Surge Badge */}
                            {region.surge && (
                                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2 mb-4 flex items-center gap-2">
                                    <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                                        Surge detected! Rapid crowd increase.
                                    </span>
                                </div>
                            )}

                            <div className="flex items-end justify-between mb-2">
                                <div>
                                    <div className="text-3xl font-bold text-gray-900 dark:text-white mb-0.5">{region.current}</div>
                                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Current Devices</div>
                                </div>
                                <div className="text-right">
                                    <div className={`text-lg font-bold ${load > 90 ? 'text-red-500' : load > 60 ? 'text-amber-500' : 'text-green-500'}`}>{load}%</div>
                                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Load</div>
                                </div>
                            </div>

                            <div className="h-2 w-full bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden mb-6">
                                <div className={`h-full rounded-full transition-all duration-500 ${loadColor}`} style={{ width: `${Math.min(load, 100)}%` }}></div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-slate-700">
                                <div>
                                    <div className="flex justify-between text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                                        <span>Max Capacity</span>
                                        <span className="text-gray-900 dark:text-white font-bold">{region.capacity}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="50"
                                        max="2000"
                                        value={region.capacity}
                                        onChange={(e) => handleCapacityChange(region.id, e.target.value)}
                                        className="w-full h-1.5 bg-gray-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                </div>

                                <label className="flex items-center justify-between cursor-pointer group/toggle">
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center gap-2 group-hover/toggle:text-blue-500 transition-colors">
                                        <Bell size={16} /> Notifications
                                    </span>
                                    <div className="relative">
                                        <input type="checkbox" className="sr-only peer" defaultChecked={load > 70} />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                    </div>
                                </label>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Events;
