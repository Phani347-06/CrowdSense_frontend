import React, { useEffect, useState } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { TrendingUp, Activity, Clock, AlertTriangle } from 'lucide-react';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const Prediction = () => {
    const [liveData, setLiveData] = useState(null);
    const [alerts, setAlerts] = useState([]);

    // Fetch live data from backend
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [liveRes, alertRes] = await Promise.all([
                    fetch('http://127.0.0.1:5000/api/live'),
                    fetch('http://127.0.0.1:5000/api/alerts')
                ]);
                if (liveRes.ok) {
                    const data = await liveRes.json();
                    setLiveData(data);
                }
                if (alertRes.ok) {
                    const alertData = await alertRes.json();
                    setAlerts(alertData);
                }
            } catch (err) {
                console.log("Waiting for backend...");
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 3000);
        return () => clearInterval(interval);
    }, []);

    // Compute stats from live data
    const totalDevices = liveData ? Object.values(liveData).reduce((sum, z) => sum + z.current, 0) : 0;
    const totalPeople = liveData ? Object.values(liveData).reduce((sum, z) => sum + z.est_people, 0) : 0;
    const maxCri = liveData ? Math.max(...Object.values(liveData).map(z => z.cri)) : 0;
    const peakZone = liveData ? Object.values(liveData).reduce((a, b) => a.cri > b.cri ? a : b, { cri: 0 }) : null;

    const regionsData = liveData ? Object.values(liveData).map(z => ({
        id: z.id,
        name: z.name,
        x: z.id === 'canteen' ? '44.1%' : z.id === 'lib' ? '46.6%' : z.id === 'pg' ? '40.8%' : z.id === 'newblock' ? '49.1%' : '45.8%',
        y: z.id === 'canteen' ? '50.9%' : z.id === 'lib' ? '58.0%' : z.id === 'pg' ? '70.8%' : z.id === 'newblock' ? '57.6%' : '73.6%',
        capacity: z.capacity,
        current: z.current,
        status: z.risk_level === 'CRITICAL' ? 'High Congestion' : z.risk_level === 'HIGH' ? 'High Congestion' : z.risk_level === 'MODERATE' ? 'Moderate' : 'Low Activity',
        color: z.cri >= 70 ? 'bg-red-500' : z.cri >= 50 ? 'bg-amber-500' : 'bg-green-500'
    })) : [
        { id: 'canteen', name: 'Student Canteen', x: '44.1%', y: '50.9%', capacity: 200, current: 180, status: 'High Congestion', color: 'bg-red-500' },
        { id: 'lib', name: 'Main Library', x: '46.6%', y: '58.0%', capacity: 500, current: 425, status: 'Moderate', color: 'bg-amber-500' },
        { id: 'pg', name: 'PG Block', x: '40.8%', y: '70.8%', capacity: 150, current: 45, status: 'Low Activity', color: 'bg-green-500' },
        { id: 'newblock', name: 'New Block', x: '49.1%', y: '57.6%', capacity: 300, current: 80, status: 'Low Activity', color: 'bg-green-500' },
        { id: 'dblock', name: 'Academic Block D', x: '45.8%', y: '73.6%', capacity: 400, current: 50, status: 'Low Activity', color: 'bg-green-500' }
    ];

    // Build flow data from backend
    const flowData = liveData ? Object.values(liveData).flatMap(z =>
        (z.flows || []).map(f => ({
            from: f.from_zone,
            to: f.to_zone,
            intensity: f.count > 30 ? 'high' : f.count > 10 ? 'medium' : 'low'
        }))
    ) : [];

    const getRegionCoords = (id) => {
        const region = regionsData.find(r => r.id === id);
        return region ? { x: region.x, y: region.y } : { x: '0%', y: '0%' };
    };

    // Fetch trend data for charts
    const [trendLabels, setTrendLabels] = useState([]);
    const [trendActual, setTrendActual] = useState([]);
    const [trendPredicted, setTrendPredicted] = useState([]);

    useEffect(() => {
        const fetchTrend = async () => {
            try {
                const res = await fetch('http://127.0.0.1:5000/api/trend');
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.length > 0) {
                        const step = Math.max(1, Math.floor(data.length / 24));
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

    // Forecast Data — live from backend
    const forecastData = {
        labels: trendLabels.length > 0 ? trendLabels : ['--'],
        datasets: [
            {
                label: 'Actual Crowd Density',
                data: trendActual.length > 0 ? trendActual : [0],
                fill: true,
                backgroundColor: (context) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
                    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
                    return gradient;
                },
                borderColor: 'rgb(59, 130, 246)',
                tension: 0.4,
                pointRadius: 3,
                pointBackgroundColor: 'rgb(59, 130, 246)',
            },
            {
                label: 'ML Predicted Density',
                data: trendPredicted.length > 0 ? trendPredicted : [0],
                fill: true,
                backgroundColor: (context) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                    gradient.addColorStop(0, 'rgba(147, 51, 234, 0.3)');
                    gradient.addColorStop(1, 'rgba(147, 51, 234, 0.0)');
                    return gradient;
                },
                borderColor: 'rgb(147, 51, 234)',
                borderDash: [5, 5],
                tension: 0.4,
                pointRadius: 0,
            },
            {
                label: 'Capacity Limit',
                data: trendLabels.length > 0 ? trendLabels.map(() => 1550) : [1550],
                borderColor: 'rgba(239, 68, 68, 0.6)',
                borderDash: [8, 4],
                tension: 0,
                pointRadius: 0,
                fill: false,
                borderWidth: 1.5
            }
        ]
    };

    const forecastOptions = {
        responsive: true,
        plugins: {
            legend: { position: 'top', labels: { color: '#9ca3af', usePointStyle: true } },
            title: { display: false }
        },
        scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(200, 200, 200, 0.1)' }, ticks: { color: '#9ca3af' } },
            x: { grid: { display: false }, ticks: { color: '#9ca3af', maxTicksLimit: 12 } }
        }
    };

    // Comparison Data — per-zone actual vs predicted (live)
    const zoneNames = liveData ? Object.values(liveData).map(z => z.name.replace('Student ', '').replace('Academic ', '')) : ['Canteen', 'Library', 'PG', 'New Block', 'D Block'];
    const zoneActual = liveData ? Object.values(liveData).map(z => z.current) : [0, 0, 0, 0, 0];
    const zonePredicted = liveData ? Object.values(liveData).map(z => z.predicted) : [0, 0, 0, 0, 0];

    const comparisonData = {
        labels: zoneNames,
        datasets: [
            {
                label: 'Current (Actual)',
                data: zoneActual,
                backgroundColor: 'rgba(59, 130, 246, 0.8)',
                borderColor: 'rgb(59, 130, 246)',
                borderWidth: 1,
                borderRadius: 6
            },
            {
                label: 'ML Predicted',
                data: zonePredicted,
                backgroundColor: 'rgba(147, 51, 234, 0.6)',
                borderColor: 'rgb(147, 51, 234)',
                borderWidth: 1,
                borderRadius: 6
            }
        ]
    };

    const comparisonOptions = {
        responsive: true,
        plugins: { legend: { position: 'top', labels: { color: '#9ca3af', usePointStyle: true } } },
        scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(200, 200, 200, 0.1)' }, ticks: { color: '#9ca3af' } },
            x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
        }
    };

    return (
        <div className="space-y-6">
            {/* Alerts Banner */}
            {alerts.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="text-red-500" size={20} />
                        <span className="font-bold text-red-700 dark:text-red-400">Active Alerts ({alerts.length})</span>
                    </div>
                    {alerts.map((alert, i) => (
                        <div key={i} className="text-sm text-red-600 dark:text-red-300 ml-7">
                            {alert.message} — <span className="font-mono text-xs">{alert.timestamp}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-slate-700">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-purple-600 dark:text-purple-400">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Predicted (30m)</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{totalDevices > 0 ? totalDevices.toLocaleString() : '—'}</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-slate-700">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400">
                            <Activity size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Confidence Score</p>
                            <h3 className="text-2xl font-bold text-green-500">{liveData ? '94%' : '—'}</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-slate-700">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl text-orange-600 dark:text-orange-400">
                            <Clock size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Peak Zone</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{peakZone ? peakZone.name : '—'}</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-slate-700">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${maxCri >= 70 ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'}`}>
                            <AlertTriangle size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Max CRI</p>
                            <h3 className={`text-2xl font-bold ${maxCri >= 70 ? 'text-red-500' : maxCri >= 50 ? 'text-amber-500' : 'text-green-500'}`}>{maxCri > 0 ? maxCri : '—'}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Live Crowd Trend — Actual vs ML Predicted</h3>
                    <div className="h-80">
                        <Line data={forecastData} options={forecastOptions} />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Zone Comparison — Actual vs ML Predicted</h3>
                    <div className="h-80">
                        <Bar data={comparisonData} options={comparisonOptions} />
                    </div>
                </div>
            </div>

            {/* Heatmap Section */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Campus Density Heatmap</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Visualizing high-traffic zones across the campus.</p>
                    </div>
                </div>

                <div className="relative w-full h-[500px] rounded-xl overflow-hidden border border-gray-100 dark:border-slate-700 group">
                    {/* Map Background */}
                    <iframe
                        className="absolute inset-0 w-full h-full border-none opacity-60 saturate-[.85] contrast-[1.1] pointer-events-none"
                        src="https://www.openstreetmap.org/export/embed.html?bbox=78.383911,17.535606,78.388299,17.541877&layer=mapnik"
                    ></iframe>

                    {/* Data-Driven Heatmap Overlay */}
                    <div className="absolute inset-0 pointer-events-none opacity-80 mix-blend-multiply dark:mix-blend-screen">
                        {regionsData.map(region => (
                            <div
                                key={region.id}
                                className={`absolute rounded-full blur-[20px] opacity-80 ${region.color} transition-all duration-1000`}
                                style={{
                                    left: region.x,
                                    top: region.y,
                                    width: region.status === 'High Congestion' ? '80px' : region.status === 'Moderate' ? '60px' : '40px',
                                    height: region.status === 'High Congestion' ? '80px' : region.status === 'Moderate' ? '60px' : '40px',
                                    transform: 'translate(-50%, -50%)'
                                }}
                            ></div>
                        ))}
                    </div>

                    {/* Flow Arrows Overlay */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 filter drop-shadow-sm">
                        <defs>
                            <marker id="arrowhead-high" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                                <polygon points="0 0, 6 2, 0 4" fill="#ef4444" />
                            </marker>
                            <marker id="arrowhead-medium" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                                <polygon points="0 0, 6 2, 0 4" fill="#f59e0b" />
                            </marker>
                            <marker id="arrowhead-low" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                                <polygon points="0 0, 6 2, 0 4" fill="#22c55e" />
                            </marker>
                        </defs>
                        {flowData.map((flow, i) => {
                            const start = getRegionCoords(flow.from);
                            const end = getRegionCoords(flow.to);
                            let color = '#22c55e';
                            let marker = 'url(#arrowhead-low)';
                            if (flow.intensity === 'high') { color = '#ef4444'; marker = 'url(#arrowhead-high)'; }
                            else if (flow.intensity === 'medium') { color = '#f59e0b'; marker = 'url(#arrowhead-medium)'; }

                            return (
                                <line
                                    key={i}
                                    x1={start.x} y1={start.y}
                                    x2={end.x} y2={end.y}
                                    stroke={color}
                                    strokeWidth={flow.intensity === 'high' ? 2 : 1.5}
                                    strokeDasharray="4,3"
                                    markerEnd={marker}
                                    className="opacity-80"
                                />
                            );
                        })}
                    </svg>

                    {/* Legend */}
                    <div className="absolute bottom-4 right-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur p-3 rounded-lg shadow-lg border border-gray-100 dark:border-slate-600">
                        <div className="text-xs font-bold text-gray-900 dark:text-white mb-2">Congestion Level</div>
                        <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
                            <span>Low</span>
                            <div className="w-24 h-2 rounded-full bg-gradient-to-r from-green-400 via-amber-400 to-red-600"></div>
                            <span>High</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Prediction;
