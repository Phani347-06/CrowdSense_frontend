import React, { useEffect, useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { TrendingUp, Users, Wifi, MapPin, Plus, Minus, RotateCw, FileText, Settings, User, Brain, Shield } from 'lucide-react';

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
    const [showFlow, setShowFlow] = useState(true);
    const [timeTravelValue, setTimeTravelValue] = useState(new Date().getHours());
    const [isTimeTravelActive, setIsTimeTravelActive] = useState(false);
    const { searchQuery, setSearchQuery } = useOutletContext();
    const [isSearchView, setIsSearchView] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedRegion, setSelectedRegion] = useState(regionsData[0]);
    const [localTrend, setLocalTrend] = useState([]);
    const [chartDataVisible, setChartDataVisible] = useState([true, true]);
    const [summary, setSummary] = useState({
        total_devices: 0,
        total_people: 0,
        total_predicted: 0,
        avg_cri: 0,
        max_cri: 0,
        peak_zone: '—',
        alert_count: 0,
        timestamp: '--:--'
    });

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
                const url = isTimeTravelActive
                    ? `http://127.0.0.1:5000/api/forecast?hour=${timeTravelValue}&minute=0`
                    : 'http://127.0.0.1:5000/api/live';

                const [liveRes, summaryRes] = await Promise.all([
                    fetch(url),
                    fetch('http://127.0.0.1:5000/api/summary')
                ]);

                if (liveRes.ok) {
                    const result = await liveRes.json();
                    const data = result.zones || result;
                    const flows = result.flows || [];

                    if (data && Object.keys(data).length > 0) {
                        setRegions(prevRegions => prevRegions.map(region => {
                            const incoming = data[region.id];
                            if (incoming) {
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
                        setFlowData(flows);

                        // If forecast mode provides a summary, use it
                        if (isTimeTravelActive && result.summary) {
                            setSummary(result.summary);
                        }
                    }
                }

                if (!isTimeTravelActive && summaryRes.ok) {
                    const sumData = await summaryRes.json();
                    setSummary(sumData);
                }
            } catch (error) {
                console.log('Waiting for backend...');
            }
        };

        fetchLiveData();
        // Faster polling when time traveling for snapiness
        const interval = setInterval(fetchLiveData, isTimeTravelActive ? 500 : 2000);
        return () => clearInterval(interval);
    }, [isTimeTravelActive, timeTravelValue]);

    const [peakInfo, setPeakInfo] = useState({ hour: 0, delta: 0 });

    // Search Logic: Highly Optimized Batch Fetching
    useEffect(() => {
        const triggerSearch = async () => {
            if (searchQuery.trim().length > 0) {
                const query = searchQuery.toLowerCase().trim();
                const match = regions.find(r =>
                    r.name.toLowerCase().includes(query) ||
                    r.id.toLowerCase().includes(query)
                );

                if (match) {
                    console.log("Dashboard: Match found, entering Focus View", match.name);
                    setSelectedRegion(match);
                    setIsSearchView(true);
                    setIsSearching(true);
                    setLocalTrend([]); // Clear stale data
                    setSearchQuery(''); // Clear search query to prevent trigger loop

                    try {
                        // Optimized: One batch call for all 24 hours
                        const res = await fetch(`http://127.0.0.1:5000/api/forecast/24h/${match.id}`);
                        if (res.ok) {
                            const data = await res.json();
                            setLocalTrend(data);

                            // Calculate Peak Hour dynamically within operational window (08:00 - 18:00)
                            const operationalData = data.filter(t => t.hour >= 8 && t.hour <= 18);
                            const peak = (operationalData.length > 0 ? operationalData : data).reduce(
                                (max, curr) => curr.predicted > max.predicted ? curr : max,
                                data[0]
                            );

                            const currentHour = new Date().getHours();
                            const peakHour = parseInt(peak.hour);
                            const deltaRaw = peakHour - currentHour;
                            const delta = deltaRaw < 0 ? 24 + deltaRaw : deltaRaw;
                            setPeakInfo({ hour: peakHour, delta: delta });
                        }
                    } catch (e) {
                        console.error("Batch forecast failed", e);
                    } finally {
                        setIsSearching(false);
                    }
                }
            }
        };
        triggerSearch();
    }, [searchQuery, regions, setSearchQuery]);



    // Fetch Live History for Selected Region (Incremental updates)
    useEffect(() => {
        const fetchCurrentTrend = async () => {
            if (isSearchView) return; // Full day view handles its own data
            try {
                const res = await fetch(`http://127.0.0.1:5000/api/trend/${selectedRegion.id}`);
                if (res.ok) {
                    const data = await res.json();
                    setLocalTrend(data);
                }
            } catch (e) { console.error("Zone trend fetch error", e); }
        };
        fetchCurrentTrend();
    }, [selectedRegion.id, isSearchView]);

    // Sync selected region when data updates
    useEffect(() => {
        const updated = regions.find(r => r.id === selectedRegion.id);
        if (updated) setSelectedRegion(updated);
    }, [regions, selectedRegion.id]);

    // Trend data for charts
    const [trendLabels, setTrendLabels] = useState([]);
    const [trendActual, setTrendActual] = useState([]);
    const [trendPredicted, setTrendPredicted] = useState([]);

    // Fetch trend data
    useEffect(() => {
        const fetchTrend = async () => {
            try {
                const res = await fetch('http://127.0.0.1:5000/api/trend');
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.length > 0) {
                        // Sample every 5th point to avoid overcrowding the chart
                        const step = Math.max(1, Math.floor(data.length / 30));
                        const sampled = data.filter((_, i) => i % step === 0 || i === data.length - 1);
                        setTrendLabels(sampled.map(d => d.hour));
                        setTrendActual(sampled.map(d => d.total_actual));
                        setTrendPredicted(sampled.map(d => d.total_predicted));
                    }
                }
            } catch (e) { /* backend not ready */ }
        };
        fetchTrend();
        const intv = setInterval(fetchTrend, 5000);
        return () => clearInterval(intv);
    }, []);

    // Chart Data — driven by live trend API
    const chartData = {
        labels: trendLabels.length > 0 ? trendLabels : ['--'],
        datasets: [
            {
                label: 'Actual',
                data: trendActual.length > 0 ? trendActual : [0],
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
                pointRadius: 3,
                pointHoverRadius: 6,
                borderWidth: 2,
                hidden: !chartDataVisible[0]
            },
            {
                label: 'ML Predicted',
                data: trendPredicted.length > 0 ? trendPredicted : [0],
                borderColor: '#a855f7',
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

    if (isSearchView) {
        const currentLoad = Math.round((selectedRegion.current / selectedRegion.capacity) * 100);

        // Filter trend data to 8 AM - 6 PM for the graph, handle both numbers and strings
        const filteredTrend = localTrend.filter(t => {
            const h = typeof t.hour === 'string' ? parseInt(t.hour.split(':')[0]) : t.hour;
            return h >= 8 && h <= 18;
        });

        // Create a unique key for the chart to force a fresh render when the region or data changes
        const chartKey = `chart-${selectedRegion.id}-${filteredTrend.length}`;

        const predictionLineData = {
            labels: filteredTrend.length > 0 ? filteredTrend.map(t => {
                const h = typeof t.hour === 'string' ? parseInt(t.hour.split(':')[0]) : t.hour;
                return `${h}:00`;
            }) : ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"],
            datasets: [{
                label: 'Predicted People',
                data: filteredTrend.length > 0 ? filteredTrend.map(t => t.predicted) : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                borderColor: '#22c55e',
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                borderWidth: 4,
                tension: 0.4,
                pointRadius: 6,
                fill: true,
                pointHoverRadius: 8,
                pointHoverBackgroundColor: '#22c55e',
                pointHoverBorderColor: '#09090b',
                pointBackgroundColor: '#22c55e',
                pointBorderColor: '#09090b',
                pointBorderWidth: 2
            }]
        };



        const predictionOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1c1c1e',
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 },
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: (ctx) => `Predicted: ${ctx.raw} people`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#64748b',
                        font: { size: 12, weight: '600' },
                        maxRotation: 0,
                        autoSkip: false
                    }
                },
                y: {
                    beginAtZero: true,
                    suggestedMax: selectedRegion.capacity,
                    grid: { color: 'rgba(255,255,255,0.03)', drawBorder: false },
                    ticks: {
                        color: '#64748b',
                        font: { size: 12 },
                        callback: (v) => v + ' ppl',
                        stepSize: Math.ceil(selectedRegion.capacity / 5)
                    }
                }
            }
        };



        return (
            <div className="fixed inset-0 z-[100] bg-[#09090b] p-10 flex flex-col animate-in fade-in zoom-in duration-500 overflow-hidden">
                <div className="flex justify-between items-center max-w-7xl mx-auto w-full mb-10">
                    <button
                        onClick={() => { setIsSearchView(false); setSearchQuery(''); }}
                        className="group flex items-center gap-3 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black transition-all border border-white/10"
                    >
                        <RotateCw size={20} className="group-hover:rotate-180 transition-transform duration-500" />
                        <span className="tracking-widest text-xs">BACK TO DASHBOARD</span>
                    </button>
                    <div className="text-right">
                        <h2 className="text-4xl font-black text-white tracking-tighter">{selectedRegion.name}</h2>
                        <div className="flex items-center justify-end gap-2 mt-1">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Full Day Crowd Prediction</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center max-w-6xl mx-auto w-full">
                    <div className="bg-[#1c1c1e] rounded-[60px] p-16 shadow-2xl border border-white/5 w-full relative overflow-hidden ring-1 ring-white/10">
                        {/* Background subtle glow */}
                        <div className="absolute top-0 right-0 w-96 h-96 bg-green-500/5 blur-[120px] rounded-full -mr-20 -mt-20"></div>

                        <div className="flex justify-between items-start mb-12 relative z-10">
                            <div>
                                <div className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Current Saturation</div>
                                <div className="text-[160px] font-medium text-white leading-none tracking-tighter flex items-end">
                                    {currentLoad}<span className="text-7xl text-white/30 ml-2 mb-6">%</span>
                                </div>
                            </div>
                            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl px-6 py-4 flex items-center gap-3 text-green-500 font-black tracking-wider shadow-lg shadow-green-500/5 mt-8">
                                <div className="relative">
                                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                    <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-500 animate-ping"></div>
                                </div>
                                <span className="text-lg">
                                    {isSearching ? 'Calculating...' : peakInfo.delta === 0 ? 'Peaking now' : `Should peak in ${peakInfo.delta} h`}
                                </span>
                            </div>
                        </div>

                        <div className="h-[280px] relative mt-4">
                            <Line key={chartKey} data={predictionLineData} options={predictionOptions} />
                        </div>


                        {/* Forecast Timeline (Operational Hours 8AM - 6PM) */}
                        <div className="mt-12">
                            <div className="flex justify-between items-center mb-4">
                                <div className="text-slate-500 text-[10px] uppercase font-black tracking-[0.2em]">Operational Window (08:00 - 18:00)</div>
                                <div className="text-blue-500 text-[10px] font-black uppercase tracking-widest bg-blue-500/10 px-2 py-1 rounded">Peak Analytics</div>
                            </div>
                            <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                                {localTrend.filter(t => {
                                    const h = typeof t.hour === 'string' ? parseInt(t.hour.split(':')[0]) : t.hour;
                                    return h >= 8 && h <= 18;
                                }).map((t, i) => {
                                    const currentHour = new Date().getHours();
                                    const h = typeof t.hour === 'string' ? parseInt(t.hour.split(':')[0]) : t.hour;
                                    return (
                                        <div key={i} className={`min-w-[110px] bg-white/5 border ${h === currentHour ? 'border-blue-500/50 bg-blue-500/5' : 'border-white/5'} rounded-2xl p-4 flex flex-col items-center transition-all hover:bg-white/10`}>
                                            <div className="text-[10px] font-black text-slate-500 mb-2">{h}:00</div>
                                            <div className={`text-2xl font-bold ${t.load > 70 ? 'text-red-500' : t.load > 40 ? 'text-amber-500' : 'text-white'} mb-1`}>{t.load}%</div>
                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{t.predicted} ppl</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>


                        <div className="grid grid-cols-4 gap-12 mt-12 pt-10 border-t border-white/5 relative z-10">
                            <div>
                                <div className="text-slate-500 text-xs uppercase font-black tracking-widest mb-3">Estimated Now</div>
                                <div className="text-white text-3xl font-bold font-mono">{selectedRegion.current}<span className="text-sm text-slate-500 ml-2">ppl</span></div>
                            </div>
                            <div>
                                <div className="text-slate-500 text-xs uppercase font-black tracking-widest mb-3">Today's Peak</div>
                                <div className="text-white text-3xl font-bold font-mono">{peakInfo.hour}:00</div>
                            </div>
                            <div>
                                <div className="text-slate-500 text-xs uppercase font-black tracking-widest mb-3">AI Confidence</div>
                                <div className="text-white text-3xl font-bold font-mono">98.2<span className="text-sm text-slate-500 ml-1">%</span></div>
                            </div>
                            <div>
                                <div className="text-slate-500 text-xs uppercase font-black tracking-widest mb-3">Live Risk</div>
                                <div className="text-green-500 text-3xl font-bold tracking-tighter">LOW</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="mb-8">
                <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Campus Overview</h2>
                <p className="text-gray-500 dark:text-gray-400">Real-time crowd analytics and ML predictions.</p>
            </div>
            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
                <StatCard
                    icon={Wifi} color="blue" title={isTimeTravelActive ? "Predicted Devices" : "Total Devices"} value={summary.total_people ? summary.total_people.toLocaleString() : '—'} trend={isTimeTravelActive ? 'Forecast' : (summary.total_people > 0 ? 'Live' : null)} isPositive={true}
                    details={[{ label: 'Avg Signal', value: '-65 dBm' }, { label: 'Zones', value: regions.length }]}
                />
                <StatCard
                    icon={Users} color="purple" title={isTimeTravelActive ? "Predicted People" : "Est. People"} value={summary.total_devices ? summary.total_devices.toLocaleString() : '—'} trend={isTimeTravelActive ? 'Simulated' : (summary.total_devices > 0 ? '+12%' : null)} isPositive={true}
                    details={[{ label: 'Avg Dwell', value: '42 min' }, { label: 'Peak Zone', value: summary.peak_zone || '—' }]}
                />
                <StatCard
                    icon={Brain} color="green" title="AI Projected Demand" value={summary.total_predicted ? summary.total_predicted.toLocaleString() : '—'} statusText={isTimeTravelActive ? "Forecast Mode" : "Predictive"} statusColor="text-blue-500"
                    details={[{ label: 'Accuracy', value: '96.2%' }, { label: 'Model', value: 'XGBoost v2' }]}
                />
                <StatCard
                    icon={Shield} color="orange" title={isTimeTravelActive ? "Forecast Risk Index" : "Campus Risk Index"} value={summary.avg_cri || '—'} statusText={isTimeTravelActive ? "Projected" : (summary.max_cri >= 70 ? 'High Risk' : summary.max_cri >= 50 ? 'Moderate' : 'Stable')} statusColor={summary.max_cri >= 70 ? 'text-red-500' : summary.max_cri >= 50 ? 'text-amber-500' : 'text-green-500'}
                    details={[{ label: 'Alerts', value: isTimeTravelActive ? 0 : (summary.alert_count || 0) }, { label: 'Critical', value: summary.zones_critical || 0 }]}
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
                        <div className="flex items-center gap-4">
                            {/* Time Travel Slider */}
                            <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-700/50 px-4 py-2 rounded-xl border border-gray-100 dark:border-slate-600">
                                <span className={`text-[10px] font-black uppercase tracking-widest ${isTimeTravelActive ? 'text-blue-500' : 'text-gray-400'}`}>
                                    {isTimeTravelActive ? `Forecast: ${timeTravelValue}:00` : 'Time Projection'}
                                </span>
                                <input
                                    type="range" min="0" max="23"
                                    value={timeTravelValue}
                                    onChange={(e) => {
                                        setTimeTravelValue(parseInt(e.target.value));
                                        setIsTimeTravelActive(true);
                                    }}
                                    className="w-32 h-1.5 bg-gray-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                                {isTimeTravelActive && (
                                    <button
                                        onClick={() => setIsTimeTravelActive(false)}
                                        className="text-[10px] bg-blue-500 text-white px-2 py-1 rounded font-black hover:bg-blue-600 transition-colors"
                                    >
                                        BACK TO LIVE
                                    </button>
                                )}
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer bg-gray-50 dark:bg-slate-700/50 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-slate-600 transition-all hover:bg-gray-100">
                                <span className={`text-xs font-bold ${showFlow ? 'text-blue-500' : 'text-gray-400'}`}>Smart Flow</span>
                                <div className="relative inline-block w-8 h-4">
                                    <input type="checkbox" className="opacity-0 w-0 h-0" checked={showFlow} onChange={() => setShowFlow(!showFlow)} />
                                    <span className={`absolute top-0 left-0 right-0 bottom-0 transition-all rounded-full ${showFlow ? 'bg-blue-500' : 'bg-gray-300'}`}>
                                        <span className={`absolute left-1 top-0.5 bg-white w-3 h-3 rounded-full transition-transform ${showFlow ? 'translate-x-3' : ''}`}></span>
                                    </span>
                                </div>
                            </label>
                            <div className="flex bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
                                <button className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded-md text-gray-500 dark:text-gray-300 transition-colors shadow-sm" onClick={() => setZoomLevel(z => Math.min(4, z + 0.2))}><Plus size={16} /></button>
                                <button className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded-md text-gray-500 dark:text-gray-300 transition-colors shadow-sm" onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.2))}><Minus size={16} /></button>
                            </div>
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

                            {/* Smart Crowd Flow Overlay */}
                            {showFlow && (
                                <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                                    <defs>
                                        <marker id="arrowhead-flow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                                            <path d="M0,0 L8,4 L0,8 Z" fill="#3b82f6" />
                                        </marker>
                                        <linearGradient id="flow-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0" />
                                            <stop offset="50%" stopColor="#3b82f6" stopOpacity="1" />
                                            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    {flowData.map((flow, i) => {
                                        const start = getRegionCoords(flow.from);
                                        const end = getRegionCoords(flow.to);
                                        if (start.x === '0%' || end.x === '0%') return null;

                                        // Calculate midpoint for an extra arrow indicator
                                        const midX = (parseFloat(start.x) + parseFloat(end.x)) / 2 + '%';
                                        const midY = (parseFloat(start.y) + parseFloat(end.y)) / 2 + '%';
                                        const pathData = `M ${start.x} ${start.y} L ${midX} ${midY} L ${end.x} ${end.y}`;

                                        return (
                                            <g key={i}>
                                                {/* Background track */}
                                                <path
                                                    d={pathData}
                                                    stroke="#3b82f6"
                                                    strokeWidth="1.5"
                                                    fill="none"
                                                    style={{ opacity: 0.15 }}
                                                    markerEnd="url(#arrowhead-flow)"
                                                />
                                                {/* Moving Micro-Arrows (3-segment stream) */}
                                                {[0, 1, 2].map(seg => (
                                                    <path
                                                        key={seg}
                                                        d={pathData}
                                                        stroke="url(#flow-gradient)"
                                                        strokeWidth={1.5 + (flow.intensity * 4)}
                                                        strokeDasharray="8, 20"
                                                        fill="none"
                                                        markerEnd="url(#arrowhead-flow)"
                                                        markerMid="url(#arrowhead-flow)"
                                                        style={{
                                                            opacity: flow.intensity * 0.9,
                                                            animationDelay: `${seg * 0.3}s`
                                                        }}
                                                        className="animate-flow-dash"
                                                    />
                                                ))}
                                            </g>
                                        );
                                    })}
                                </svg>
                            )}

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
                            <div className="text-xs font-bold text-blue-500 tracking-wider mb-2 uppercase">Daily Prediction Flow</div>
                            <div className="flex-1 flex items-stretch justify-between gap-1 pt-2 h-full">
                                {localTrend.length > 0 ? (
                                    localTrend.slice(-24).map((val, i) => (
                                        <div key={i} className="flex flex-col justify-end items-center gap-1 w-full relative group h-full cursor-pointer">
                                            <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                                                {val.hour}:00 - {val.predicted} ppl
                                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-slate-800 rotate-45"></div>
                                            </div>
                                            <div className={`w-full rounded-t-[2px] transition-all duration-300 ${val.hour === new Date().getHours() ? 'bg-blue-600 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-blue-200 dark:bg-slate-700/50 group-hover:bg-blue-400'}`}
                                                style={{ height: `${Math.min(100, (val.predicted / selectedRegion.capacity) * 100)}%` }}></div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="w-full flex items-center justify-center text-xs text-gray-400 italic">No prediction data available</div>
                                )}
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
                        <p className="text-sm text-gray-500 dark:text-gray-400">Live Actual vs ML Predicted density</p>
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
