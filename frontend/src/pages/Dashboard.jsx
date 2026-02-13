import React, { useEffect, useState, useRef } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { TrendingUp, Users, Wifi, MapPin, Plus, Minus, RotateCw, FileText, Settings, User } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const regionsData = [
    { id: 'canteen', name: 'Student Canteen', x: '43.1%', y: '50.9%', capacity: 200, current: 180, status: 'High Congestion', statusColor: 'text-red-500', peak: '1:00 PM', dwell: '30 mins', deviceType: 'Mobile', trend: [20, 30, 50, 80, 90, 70, 60, 40, 30] },
    { id: 'lib', name: 'Main Library', x: '41.6%', y: '58.0%', capacity: 500, current: 425, status: 'Moderate', statusColor: 'text-amber-500', peak: '2:00 PM', dwell: '45 mins', deviceType: 'Mobile', trend: [40, 60, 45, 70, 55, 80, 95, 85, 65] },
    { id: 'pg', name: 'PG Block', x: '39.8%', y: '70.8%', capacity: 150, current: 45, status: 'Low Activity', statusColor: 'text-green-500', peak: '11:00 AM', dwell: '120 mins', deviceType: 'Laptop', trend: [10, 20, 40, 50, 40, 30, 20, 10, 5] },
    { id: 'newblock', name: 'New Block', x: '48.1%', y: '57.6%', capacity: 300, current: 80, status: 'Low Activity', statusColor: 'text-green-500', peak: '10:00 AM', dwell: '60 mins', deviceType: 'Wearable', trend: [5, 10, 15, 20, 25, 40, 60, 80, 90] },
    { id: 'dblock', name: 'Academic Block D', x: '44.8%', y: '73.6%', capacity: 400, current: 50, status: 'Low Activity', statusColor: 'text-green-500', peak: '3:00 PM', dwell: '40 mins', deviceType: 'Mobile', trend: [15, 25, 30, 40, 20, 10, 5, 5, 0] }
];

const StatCard = ({ icon: Icon, color, title, value, trend, isPositive, statusText, statusColor, details }) => {
    const colorClasses = {
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
        purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
        green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
        orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
    };

    return (
        <div className="relative h-36">
            <div className="absolute top-0 left-0 w-full h-36 hover:h-60 bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-2xl hover:shadow-blue-500/10 border border-gray-100 dark:border-slate-700 flex flex-col justify-start z-10 hover:z-50 transition-all duration-300 ease-in-out hover:scale-105 hover:-translate-y-2 origin-top overflow-hidden">
                <div className="flex justify-between items-start mb-4 shrink-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClasses[color]}`}>
                        <Icon size={20} />
                    </div>
                    {trend && (
                        <span className={`text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 ${isPositive ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-600'}`}>
                            {isPositive ? <TrendingUp size={10} /> : <TrendingUp size={10} className="rotate-180" />}
                            {trend}
                        </span>
                    )}
                    {statusText && (
                        <span className={`text-xs font-bold ${statusColor}`}>{statusText}</span>
                    )}
                </div>
                <div className="shrink-0">
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{value}</div>
                </div>

                {/* Expanded Content */}
                <div className="mt-auto pt-4 border-t border-gray-100 dark:border-slate-700 opacity-0 hover:opacity-100 transition-opacity duration-300 delay-100">
                    <div className="grid grid-cols-2 gap-3">
                        {details.map((item, idx) => (
                            <div key={idx}>
                                <div className="text-xs text-gray-400 mb-0.5">{item.label}</div>
                                <div className="text-sm font-bold text-gray-700 dark:text-gray-200">{item.value}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const Dashboard = () => {
    const [regions, setRegions] = useState(regionsData);
    const [flowData, setFlowData] = useState([]);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [selectedRegion, setSelectedRegion] = useState(regionsData[0]);
    const [chartDataVisible, setChartDataVisible] = useState([true, true]);
    const [summary, setSummary] = useState({ total_devices: 0, total_people: 0, avg_cri: 0, max_cri: 0, peak_zone: '—', alert_count: 0 });

    const mapRef = useRef(null);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [translate, setTranslate] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);

    const getRegionCoords = (id) => {
        const r = regions.find(reg => reg.id === id);
        return r ? { x: r.x, y: r.y } : { x: '0%', y: '0%' };
    };

    // Live Data Integration
    useEffect(() => {
        const fetchLiveData = async () => {
            try {
                const [liveRes, summaryRes] = await Promise.all([
                    fetch('http://127.0.0.1:5000/api/live'),
                    fetch('http://127.0.0.1:5000/api/summary')
                ]);

                if (liveRes.ok) {
                    const data = await liveRes.json();
                    if (data && Object.keys(data).length > 0) {
                        const newFlows = [];

                        setRegions(prevRegions => prevRegions.map(region => {
                            const incoming = data[region.id];
                            if (incoming) {
                                if (incoming.flows && incoming.flows.length > 0) {
                                    incoming.flows.forEach(f => {
                                        newFlows.push({
                                            from: f.from_zone,
                                            to: f.to_zone,
                                            intensity: f.count > 20 ? 'high' : 'medium'
                                        });
                                    });
                                }
                                return {
                                    ...region,
                                    current: incoming.current,
                                    predicted: incoming.predicted,
                                    est_people: incoming.est_people,
                                    growth_rate: incoming.growth_rate,
                                    status: incoming.risk_level === 'CRITICAL' ? 'Critical Surge' : incoming.risk_level === 'HIGH' ? 'High Congestion' : incoming.risk_level === 'MODERATE' ? 'Moderate' : 'Low Activity',
                                    statusColor: incoming.cri >= 70 ? 'text-red-500' : incoming.cri >= 50 ? 'text-amber-500' : 'text-green-500',
                                    cri: incoming.cri,
                                    surge: incoming.surge
                                };
                            }
                            return region;
                        }));
                        setFlowData(newFlows);
                    }
                }

                if (summaryRes.ok) {
                    const sumData = await summaryRes.json();
                    setSummary(sumData);
                }
            } catch (error) {
                console.log('Waiting for backend...');
            }
        };

        fetchLiveData();
        const interval = setInterval(fetchLiveData, 2000);
        return () => clearInterval(interval);
    }, []);

    // Sync selected region when data updates
    useEffect(() => {
        const updated = regions.find(r => r.id === selectedRegion.id);
        if (updated) setSelectedRegion(updated);
    }, [regions, selectedRegion.id]);

    // Chart Data
    const chartData = {
        labels: ['8:00', '9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'],
        datasets: [
            {
                label: 'Actual',
                data: [650, 800, 1200, 1450, 1600, 1550, 1400, 1200, 950, 800],
                borderColor: '#3b82f6',
                backgroundColor: (context) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
                    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
                    return gradient;
                },
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                borderWidth: 2,
                hidden: !chartDataVisible[0]
            },
            {
                label: 'Predicted',
                data: [600, 850, 1150, 1500, 1650, 1600, 1450, 1250, 1000, 850],
                borderColor: '#9ca3af',
                borderDash: [5, 5],
                fill: false,
                tension: 0.4,
                pointRadius: 0,
                borderWidth: 2,
                hidden: !chartDataVisible[1]
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
        scales: {
            y: { grid: { color: 'rgba(200, 200, 200, 0.1)', drawBorder: false }, border: { display: false }, ticks: { color: '#9ca3af' } },
            x: { grid: { display: false }, border: { display: false }, ticks: { color: '#9ca3af' } }
        },
        interaction: { mode: 'nearest', axis: 'x', intersect: false }
    };

    // Map Interaction Handlers
    const handleWheel = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoomLevel(prev => Math.min(4, Math.max(0.5, prev + delta)));
    };

    const handleMouseDown = (e) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - translate.x, y: e.clientY - translate.y });
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        setTranslate({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    };

    const handleMouseUp = () => setIsDragging(false);

    return (
        <div className="space-y-6">
            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
                <StatCard
                    icon={Wifi} color="blue" title="Est. People" value={summary.total_devices ? summary.total_devices.toLocaleString() : '—'} trend={summary.total_devices > 0 ? 'Live' : null} isPositive={true}
                    details={[{ label: 'Avg CRI', value: summary.avg_cri || 0 }, { label: 'Alerts', value: summary.alert_count || 0 }]}
                />
                <StatCard
                    icon={Users} color="purple" title="Total Devices" value={summary.total_people ? summary.total_people.toLocaleString() : '—'} trend={summary.total_people > 0 ? 'Live' : null} isPositive={true}
                    details={[{ label: 'Peak Zone', value: summary.peak_zone || '—' }, { label: 'Max CRI', value: summary.max_cri || 0 }]}
                />
                <StatCard
                    icon={Wifi} color="green" title="Live Zones" value={`${(summary.zones_moderate || 0) + (summary.zones_high || 0) + (summary.zones_critical || 0) + (summary.zones_low || 0)}`} statusText="Active" statusColor="text-green-500"
                    details={[{ label: 'Critical', value: summary.zones_critical || 0 }, { label: 'Moderate', value: summary.zones_moderate || 0 }]}
                />
                <StatCard
                    icon={MapPin} color="orange" title="Max CRI" value={summary.max_cri || '—'} statusText={summary.max_cri >= 70 ? 'High Risk' : summary.max_cri >= 50 ? 'Moderate' : 'Normal'} statusColor={summary.max_cri >= 70 ? 'text-red-500' : summary.max_cri >= 50 ? 'text-amber-500' : 'text-green-500'}
                    details={[{ label: 'Peak', value: summary.peak_zone || '—' }, { label: 'Time', value: summary.timestamp || '—' }]}
                />
            </div>

            {/* Split View */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px] lg:h-[500px]">
                {/* Live Map */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col overflow-hidden relative group z-0">
                    <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 z-10">
                        <div className="flex items-center gap-2">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg text-blue-600 dark:text-blue-400">
                                <MapPin size={18} />
                            </div>
                            <h3 className="font-bold text-gray-900 dark:text-white">Campus Density Map</h3>
                        </div>
                        <div className="flex bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
                            <button className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded-md text-gray-500 dark:text-gray-300 transition-colors shadow-sm" onClick={() => setZoomLevel(z => Math.min(4, z + 0.2))}><Plus size={16} /></button>
                            <button className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded-md text-gray-500 dark:text-gray-300 transition-colors shadow-sm" onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.2))}><Minus size={16} /></button>
                        </div>
                    </div>

                    <div className="flex-1 bg-slate-100 dark:bg-slate-900/50 relative overflow-hidden cursor-grab active:cursor-grabbing"
                        ref={mapRef}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onWheel={handleWheel}
                    >
                        {/* Map Visual Layer */}
                        <div className="map-visual absolute inset-0 w-full h-full origin-center"
                            style={{ transform: `translate(${translate.x}px, ${translate.y}px) scale(${zoomLevel})` }}
                        >
                            <iframe
                                className="absolute inset-0 w-full h-full border-none opacity-80 dark:opacity-60 saturate-[.85] contrast-[1.1] pointer-events-none"
                                src="https://www.openstreetmap.org/export/embed.html?bbox=78.383911,17.535606,78.388299,17.541877&layer=mapnik"
                            ></iframe>

                            {/* Flow Arrows Overlay */}
                            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 filter drop-shadow-sm">
                                <defs>
                                    <marker id="arrowhead-flow" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                                        <polygon points="0 0, 6 2, 0 4" fill="#3b82f6" opacity="0.6" />
                                    </marker>
                                </defs>
                                {flowData.map((flow, i) => {
                                    const start = getRegionCoords(flow.from);
                                    const end = getRegionCoords(flow.to);
                                    if (start.x === '0%' || end.x === '0%') return null;

                                    return (
                                        <line
                                            key={i}
                                            x1={start.x} y1={start.y}
                                            x2={end.x} y2={end.y}
                                            stroke="#3b82f6"
                                            strokeWidth="2"
                                            strokeDasharray="4,4"
                                            markerEnd="url(#arrowhead-flow)"
                                            className="opacity-50 animate-pulse"
                                        />
                                    );
                                })}
                            </svg>

                            {regions.map(region => (
                                <div key={region.id}
                                    className={`group/marker marker ${region.status.includes('High') || region.cri >= 70 ? 'marker-red' : region.status.includes('Moderate') || region.cri >= 50 ? 'marker-amber' : 'marker-green'} ${selectedRegion.id === region.id ? 'active' : ''}`}
                                    style={{ left: region.x, top: region.y }}
                                    onClick={(e) => { e.stopPropagation(); setSelectedRegion(region); }}
                                >
                                    <div className="marker-pulse"></div>
                                    <div className="marker-center transition-transform hover:scale-110"></div>

                                    {/* Tooltip on hover */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover/marker:opacity-100 pointer-events-none transition-opacity z-20 shadow-xl">
                                        {region.name}
                                        <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Region Details */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col h-full overflow-hidden">
                    <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
                        <h3 className="font-bold text-gray-900 dark:text-white">Region Details</h3>
                        <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><Settings size={18} /></button>
                    </div>
                    <div className="p-6 flex flex-col h-full">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center shrink-0">
                                <FileText size={20} />
                            </div>
                            <div>
                                <h4 className="font-bold text-lg text-gray-900 dark:text-white leading-tight">{selectedRegion.name}</h4>
                                <div className={`text-sm font-semibold ${selectedRegion.statusColor} mt-1 flex items-center gap-1.5`}>
                                    <span className={`w-2 h-2 rounded-full bg-current inline-block`}></span>
                                    {selectedRegion.status}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-gray-50 dark:bg-slate-900/50 p-3 rounded-xl">
                                <label className="text-xs text-gray-500 dark:text-gray-400 font-medium block mb-1">Capacity</label>
                                <div className="text-lg font-bold text-gray-900 dark:text-white font-mono">{Math.round((selectedRegion.current / selectedRegion.capacity) * 100)}%</div>
                            </div>
                            <div className="bg-gray-50 dark:bg-slate-900/50 p-3 rounded-xl">
                                <label className="text-xs text-gray-500 dark:text-gray-400 font-medium block mb-1">CRI Score</label>
                                <div className={`text-lg font-bold font-mono ${(selectedRegion.cri || 0) >= 70 ? 'text-red-500' : (selectedRegion.cri || 0) >= 50 ? 'text-amber-500' : 'text-green-500'}`}>{selectedRegion.cri || '—'}</div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl">
                                <label className="text-xs text-blue-600 dark:text-blue-400 font-medium block mb-1">ML Predicted</label>
                                <div className="text-lg font-bold text-blue-700 dark:text-blue-300 font-mono">{selectedRegion.predicted || '—'}</div>
                            </div>
                            <div className="bg-gray-50 dark:bg-slate-900/50 p-3 rounded-xl">
                                <label className="text-xs text-gray-500 dark:text-gray-400 font-medium block mb-1">Growth Rate</label>
                                <div className={`text-lg font-bold font-mono ${(selectedRegion.growth_rate || 0) > 0 ? 'text-red-500' : 'text-green-500'}`}>{selectedRegion.growth_rate != null ? `${selectedRegion.growth_rate}%` : '—'}</div>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col min-h-[120px]">
                            <div className="text-xs font-bold text-gray-400 tracking-wider mb-2">LIVE TRENDS</div>
                            <div className="flex-1 flex items-stretch justify-between gap-2 pt-2 h-full">
                                {selectedRegion.trend.map((val, i) => (
                                    <div key={i} className="flex flex-col justify-end items-center gap-1 w-full relative group h-full cursor-pointer">
                                        {/* Tooltip */}
                                        <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                                            {val}%
                                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                                        </div>

                                        <div className={`w-full rounded-t-sm transition-all duration-300 ${i === 6 ? 'bg-blue-500 dark:bg-blue-600' : (i > 6 ? 'bg-transparent border border-dashed border-slate-300 dark:border-slate-600' : 'bg-slate-200 dark:bg-slate-700 group-hover:bg-blue-400 dark:group-hover:bg-slate-600')}`}
                                            style={{ height: `${val}%` }}></div>
                                        {i === 6 && <div className="absolute -top-8 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm z-10">Now</div>}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-100 dark:border-slate-700">
                            <div className="flex flex-col">
                                <span className="text-xs text-gray-500 dark:text-gray-400">Avg. Dwell Time</span>
                                <strong className="text-sm text-gray-900 dark:text-white">{selectedRegion.dwell}</strong>
                            </div>
                            <div className="flex flex-col text-right">
                                <span className="text-xs text-gray-500 dark:text-gray-400">Device Type</span>
                                <strong className="text-sm text-gray-900 dark:text-white">{selectedRegion.deviceType}</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Trend Analysis */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
                <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">Crowd Trend Analysis</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Actual vs Predicted density over 12 hours</p>
                    </div>
                    <div className="flex bg-gray-100 dark:bg-slate-900 p-1 rounded-xl">
                        <button className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${chartDataVisible[0] && chartDataVisible[1] ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`} onClick={() => setChartDataVisible([true, true])}>All</button>
                        <button className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${chartDataVisible[0] && !chartDataVisible[1] ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`} onClick={() => setChartDataVisible([true, false])}>Actual</button>
                        <button className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${!chartDataVisible[0] && chartDataVisible[1] ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`} onClick={() => setChartDataVisible([false, true])}>Predicted</button>
                    </div>
                </div>
                <div className="p-6 h-80">
                    <Line data={chartData} options={chartOptions} />
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
