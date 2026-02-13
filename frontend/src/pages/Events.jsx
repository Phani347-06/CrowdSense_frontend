import React, { useState, useEffect } from 'react';
import { Send, Users, ShieldAlert, Calendar, History, Copy, Zap } from 'lucide-react';

const N8N_WORKFLOW = {
    "name": "CrowdSense Email Automation",
    "nodes": [
        {
            "parameters": {
                "path": "crowd-alert",
                "httpMethod": "POST",
                "responseMode": "onReceived"
            },
            "id": "1",
            "name": "Webhook",
            "type": "n8n-nodes-base.webhook",
            "typeVersion": 1,
            "position": [300, 300]
        },
        {
            "parameters": {
                "conditions": {
                    "number": [
                        {
                            "value1": "={{$json[\"predicted_density\"]}}",
                            "operation": "larger",
                            "value2": 90
                        }
                    ]
                }
            },
            "id": "2",
            "name": "Check Overcrowding",
            "type": "n8n-nodes-base.if",
            "typeVersion": 1,
            "position": [500, 300]
        },
        {
            "parameters": {
                "fromEmail": "alerts@crowdsense.ai",
                "toEmail": "={{$json[\"recipient_email\"]}}",
                "subject": "⚠️ CrowdSense Alert: {{$json[\"issue\"]}}",
                "text": "Hello,\n\nThis is an automated alert from CrowdSense.\n\nIssue: {{$json[\"issue\"]}}\nLocation: {{$json[\"location\"]}}\nEvent: {{$json[\"event\"] || 'General'}}\n\nStats:\n- Risk Level: {{$json[\"level\"]}}\n- Current People: {{$json[\"current\"]}}\n- Max Capacity: {{$json[\"capacity\"]}}\n\nPlease coordinate with campus security immediately.\n\nTimestamp: {{$json[\"timestamp\"]}}"
            },
            "id": "3",
            "name": "Send Email",
            "type": "n8n-nodes-base.gmail",
            "typeVersion": 1,
            "position": [700, 250]
        }
    ],
    "connections": {
        "Webhook": { "main": [[{ "node": "Check Overcrowding", "type": "main", "index": 0 }]] },
        "Check Overcrowding": { "main": [[{ "node": "Send Email", "type": "main", "index": 0 }]] }
    }
};

const Events = () => {
    const [regions, setRegions] = useState([
        { id: 'lib', name: 'Main Library', current: 0, capacity: 500, status: 'Normal', cri: 20, predicted: 45, surge: 5 },
        { id: 'canteen', name: 'Student Canteen', current: 0, capacity: 200, status: 'Normal', cri: 10, predicted: 120, surge: 2 },
        { id: 'newblock', name: 'New Block', current: 0, capacity: 300, status: 'Normal', cri: 35, predicted: 80, surge: 15 },
        { id: 'pg', name: 'PG Block', current: 0, capacity: 150, status: 'Normal', cri: 5, predicted: 50, surge: 0 },
        { id: 'dblock', name: 'D Block', current: 0, capacity: 400, status: 'Normal', cri: 15, predicted: 40, surge: 3 }
    ]);

    const [capacityOverrides, setCapacityOverrides] = useState({});
    const [alertHistory, setAlertHistory] = useState([]);
    const [registrations, setRegistrations] = useState([]);
    const [myEvents, setMyEvents] = useState([]);

    // Auth State
    let user = { email: 'guest@vnrvjiet.in' };
    try {
        const userStr = localStorage.getItem('user');
        if (userStr && userStr !== "undefined") {
            const parsed = JSON.parse(userStr);
            // Handle both object {email: '...'} and just string '...'
            user = typeof parsed === 'object' ? parsed : { email: parsed };
        }
    } catch (e) {
        console.error("Auth parse error", e);
    }

    // Normalize for case-insensitive check
    const userEmail = (user.email || '').toLowerCase();
    const isAdmin = userEmail === 'admin@vnrvjiet.in';
    console.log("Current User:", userEmail, "IsAdmin:", isAdmin);

    // Form States
    const [alertForm, setAlertForm] = useState({ title: '', message: '', level: 'WARNING', zone_id: 'lib' });
    const [regForm, setRegForm] = useState({ event_name: '', zone_id: 'lib', contact_email: user.email });
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });

    // Sync email when user logs in
    useEffect(() => {
        if (user?.email) {
            setRegForm(prev => ({ ...prev, contact_email: user.email }));
        }
    }, [user.email]);

    // Fetch live data & history
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [liveRes, histRes, regRes, myRes] = await Promise.all([
                    fetch('http://127.0.0.1:5000/api/live'),
                    isAdmin ? fetch('http://127.0.0.1:5000/api/alerts/history') : Promise.resolve(null),
                    isAdmin ? fetch('http://127.0.0.1:5000/api/events/registrations') : Promise.resolve(null),
                    !isAdmin ? fetch(`http://127.0.0.1:5000/api/events/my-registrations/${user.email}`) : Promise.resolve(null)
                ]);

                if (liveRes.ok) {
                    const result = await liveRes.json();
                    const data = result.zones || result;
                    if (data && Object.keys(data).length > 0) {
                        setRegions(prev => prev.map(region => {
                            const incoming = data[region.id];
                            return incoming ? {
                                ...region,
                                current: incoming.current,
                                capacity: capacityOverrides[region.id] || incoming.capacity,
                                status: incoming.risk_level,
                                cri: incoming.cri,
                                predicted: incoming.predicted,
                                surge: incoming.surge
                            } : region;
                        }));
                    }
                }

                if (histRes && histRes.ok) {
                    const history = await histRes.json();
                    setAlertHistory(history);
                }

                if (regRes && regRes.ok) {
                    const regs = await regRes.json();
                    setRegistrations(regs);
                }

                if (myRes && myRes.ok) {
                    const my = await myRes.json();
                    setMyEvents(my);
                }
            } catch (error) {
                console.log("Fetch error:", error);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 4000);
        return () => clearInterval(interval);
    }, [capacityOverrides, isAdmin, user.email]);

    const handleSendAlert = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('http://127.0.0.1:5000/api/alerts/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(alertForm)
            });
            if (res.ok) {
                setMsg({ type: 'success', text: 'Alert broadcasted successfully!' });
                setAlertForm({ ...alertForm, title: '', message: '' });
            }
        } catch (e) { setMsg({ type: 'error', text: 'Failed to send alert' }); }
        setLoading(false);
    };





    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('http://127.0.0.1:5000/api/events/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...regForm,
                    email: user.email
                })
            });
            if (res.ok) setMsg({ type: 'success', text: 'Registration submitted! Awaiting admin approval.' });
        } catch (e) { setMsg({ type: 'error', text: 'Registration failed' }); }
        setLoading(false);
    };

    const handleUpdateStatus = async (email, eventName, status) => {
        try {
            const res = await fetch('http://127.0.0.1:5000/api/events/update-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, event_name: eventName, status })
            });
            if (res.ok) {
                setMsg({ type: 'success', text: `Registration ${status.toLowerCase()}!` });
                // Re-fetch handled by effect interval
            }
        } catch (e) { console.error("Status update error", e); }
    };

    const handleUpdateCapacity = async (zone_id, newCap) => {
        // Optimistic update
        setRegions(prev => prev.map(r => r.id === zone_id ? { ...r, capacity: parseInt(newCap) } : r));

        try {
            await fetch('http://127.0.0.1:5000/api/zones/capacity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ zone_id, capacity: parseInt(newCap) })
            });
        } catch (e) {
            console.error("Failed to update capacity", e);
        }
    };

    return (
        <div className="space-y-8 max-w-[1600px] mx-auto pb-20">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                        {isAdmin ? 'Crisis Control Center' : 'Event Participation'}
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        {isAdmin ? 'Manage campus risk and view participant registrations.' : 'Browse and register for upcoming campus events and workshops.'}
                    </p>
                </div>
                {msg.text && (
                    <div className={`px-4 py-2 rounded-xl text-sm font-bold animate-bounce ${msg.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                        {msg.text}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Side: Actions */}
                <div className="lg:col-span-4 space-y-8">
                    {isAdmin ? (
                        <>
                            {/* Admin: Send Alert */}
                            <div className="bg-white dark:bg-slate-800 rounded-[32px] p-8 border border-gray-100 dark:border-slate-700 shadow-sm">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/20 text-red-600 flex items-center justify-center">
                                        <Send size={20} />
                                    </div>
                                    <h3 className="text-lg font-black text-gray-900 dark:text-white">Broadcast Alert</h3>
                                </div>
                                <form onSubmit={handleSendAlert} className="space-y-4">
                                    <input
                                        placeholder="Alert Title"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 outline-none focus:border-red-500"
                                        value={alertForm.title} onChange={e => setAlertForm({ ...alertForm, title: e.target.value })} required
                                    />
                                    <textarea
                                        placeholder="Emergency message..." rows="2"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 outline-none focus:border-red-500"
                                        value={alertForm.message} onChange={e => setAlertForm({ ...alertForm, message: e.target.value })} required
                                    />
                                    <div className="grid grid-cols-2 gap-3">
                                        <select
                                            className="px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 outline-none text-sm font-bold"
                                            value={alertForm.zone_id} onChange={e => setAlertForm({ ...alertForm, zone_id: e.target.value })}
                                        >
                                            {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                        </select>
                                        <select
                                            className="px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 outline-none text-sm font-bold"
                                            value={alertForm.level} onChange={e => setAlertForm({ ...alertForm, level: e.target.value })}
                                        >
                                            <option value="INFO">Info</option>
                                            <option value="WARNING">Warning</option>
                                            <option value="CRITICAL">Critical</option>
                                        </select>
                                    </div>
                                    <button
                                        type="submit" disabled={loading}
                                        className="w-full py-4 bg-red-600 text-white rounded-2xl font-black shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                                    >
                                        <ShieldAlert size={18} /> BROADCAST
                                    </button>
                                </form>
                            </div>

                            {/* Admin: Participant List */}
                            <div className="bg-white dark:bg-slate-800 rounded-[32px] p-8 border border-gray-100 dark:border-slate-700 shadow-sm max-h-[400px] overflow-hidden flex flex-col">
                                <div className="flex items-center gap-3 mb-6 shrink-0">
                                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
                                        <Users size={20} />
                                    </div>
                                    <h3 className="text-lg font-black text-gray-900 dark:text-white">Participants</h3>
                                </div>
                                <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                                    {registrations.length === 0 ? (
                                        <p className="text-center text-gray-400 py-10 text-sm italic">No registrations yet</p>
                                    ) : (
                                        registrations.map((r, i) => (
                                            <div key={i} className="p-3 rounded-xl border border-gray-50 dark:border-slate-700/50 bg-gray-50/50 dark:bg-slate-900/30">
                                                <div className="flex justify-between items-start">
                                                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase">{r.event_name}</span>
                                                    <span className="text-[10px] text-gray-400 font-mono">{new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <p className="text-sm font-black text-gray-800 dark:text-gray-200 truncate">{r.user_email}</p>
                                                <div className="flex justify-between items-center mt-2">
                                                    <p className="text-[10px] text-gray-500 font-bold uppercase">Zone: {r.zone_id}</p>
                                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${r.status === 'APPROVED' ? 'bg-green-100 text-green-600' : r.status === 'REJECTED' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                                        {r.status || 'PENDING'}
                                                    </span>
                                                </div>
                                                {r.status === 'PENDING' && (
                                                    <div className="flex gap-2 mt-3">
                                                        <button
                                                            onClick={() => handleUpdateStatus(r.user_email, r.event_name, 'APPROVED')}
                                                            className="flex-1 py-1.5 bg-green-600 text-[10px] text-white font-black rounded-lg hover:bg-green-700 transition-colors"
                                                        >
                                                            APPROVE
                                                        </button>
                                                        <button
                                                            onClick={() => handleUpdateStatus(r.user_email, r.event_name, 'REJECTED')}
                                                            className="flex-1 py-1.5 bg-slate-200 dark:bg-slate-700 text-[10px] text-gray-600 dark:text-gray-300 font-black rounded-lg hover:bg-red-600 hover:text-white transition-all"
                                                        >
                                                            REJECT
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Admin: n8n Automation setup */}
                            <div className="bg-white dark:bg-slate-800 rounded-[32px] p-8 border border-gray-100 dark:border-slate-700 shadow-sm">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/20 text-orange-600 flex items-center justify-center">
                                        <Zap size={20} />
                                    </div>
                                    <h3 className="text-lg font-black text-gray-900 dark:text-white">n8n Automation</h3>
                                </div>
                                <div className="space-y-4">
                                    <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700">
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-bold uppercase mb-2">Webhook Connector</p>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                            <span className="text-xs font-black text-gray-700 dark:text-gray-200">Listening on :5678</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(JSON.stringify(N8N_WORKFLOW, null, 2));
                                            setMsg({ type: 'success', text: 'Workflow JSON copied!' });
                                            setTimeout(() => setMsg({ type: '', text: '' }), 3000);
                                        }}
                                        className="w-full py-4 bg-slate-900 dark:bg-slate-700 text-white rounded-2xl font-black text-xs hover:bg-black transition-all flex items-center justify-center gap-2"
                                    >
                                        <Copy size={16} /> COPY WORKFLOW JSON
                                    </button>
                                    <p className="text-[10px] text-center text-gray-400 italic leading-relaxed">
                                        Imports this workflow into n8n to enable automatic email alerts for approved event organizers when capacity is reached.
                                    </p>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* User: Registration */}
                            <div className="bg-white dark:bg-slate-800 rounded-[32px] p-8 border border-gray-100 dark:border-slate-700 shadow-sm">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
                                        <Calendar size={20} />
                                    </div>
                                    <h3 className="text-lg font-black text-gray-900 dark:text-white">Join Campus Event</h3>
                                </div>
                                <form onSubmit={handleRegister} className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Event Name</label>
                                        <input
                                            placeholder="Workshop/Hackathon/Seminar"
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 outline-none focus:border-blue-500"
                                            value={regForm.event_name} onChange={e => setRegForm({ ...regForm, event_name: e.target.value })} required
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Alert Contact Email</label>
                                        <input
                                            type="email"
                                            placeholder="personal-email@gmail.com"
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 outline-none focus:border-blue-500"
                                            value={regForm.contact_email} onChange={e => setRegForm({ ...regForm, contact_email: e.target.value })} required
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Preferred Location</label>
                                        <select
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 outline-none text-sm font-bold"
                                            value={regForm.zone_id} onChange={e => setRegForm({ ...regForm, zone_id: e.target.value })}
                                        >
                                            {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                        </select>
                                    </div>
                                    <button
                                        type="submit" disabled={loading}
                                        className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all"
                                    >
                                        {loading ? 'PROCESSING...' : 'CONFIRM REGISTRATION'}
                                    </button>
                                    <p className="text-[10px] text-center text-gray-400 mt-4 leading-relaxed">
                                        Alerts will be sent to the contact email provided above in case of any security concerns at your location.
                                    </p>
                                </form>
                            </div>

                            {/* User: My Events History */}
                            <div className="bg-white dark:bg-slate-800 rounded-[32px] p-8 border border-gray-100 dark:border-slate-700 shadow-sm max-h-[400px] overflow-hidden flex flex-col">
                                <div className="flex items-center gap-3 mb-6 shrink-0">
                                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-600 flex items-center justify-center">
                                        <History size={20} />
                                    </div>
                                    <h3 className="text-lg font-black text-gray-900 dark:text-white">My Events</h3>
                                </div>
                                <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                                    {myEvents.length === 0 ? (
                                        <p className="text-center text-gray-400 py-10 text-sm italic">No registrations yet</p>
                                    ) : (
                                        myEvents.map((r, i) => (
                                            <div key={i} className="p-4 rounded-2xl border border-gray-50 dark:border-slate-700/50 bg-gray-50/50 dark:bg-slate-900/30">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">{r.event_name}</span>
                                                    <span className="text-[10px] text-gray-400 font-mono">{new Date(r.timestamp).toLocaleDateString()}</span>
                                                </div>
                                                <p className="text-sm font-black text-gray-800 dark:text-gray-100">Zone: {regions.find(reg => reg.id === r.zone_id)?.name || r.zone_id}</p>
                                                <div className="flex items-center justify-between mt-2">
                                                    <p className="text-[10px] text-gray-500">Alerts to: <span className="font-bold text-gray-700 dark:text-gray-300">{r.contact_email}</span></p>
                                                    {r.status === 'APPROVED' && (
                                                        <span className="flex items-center gap-1 text-[9px] font-black text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                                            ACTIVE
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Right Side: Zone Monitoring */}
                <div className="lg:col-span-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {regions.map((region) => {
                            const load = Math.round((region.current / region.capacity) * 100);
                            const projectedLoad = Math.round((region.predicted / region.capacity) * 100);
                            const isCritical = region.cri >= 70;
                            const isModerate = region.cri >= 50;
                            const statusColor = isCritical ? 'text-red-600 bg-red-50 dark:bg-red-900/20' : isModerate ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' : 'text-green-600 bg-green-50 dark:bg-green-900/20';

                            return (
                                <div key={region.id} className="bg-white dark:bg-slate-800 rounded-[32px] p-6 border border-gray-100 dark:border-slate-700/50 shadow-sm hover:shadow-xl transition-all h-full flex flex-col">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${statusColor}`}>
                                                {region.status}
                                            </span>
                                            <h3 className="text-lg font-black text-gray-900 dark:text-white mt-1">{region.name}</h3>
                                        </div>
                                        <div className={`p-2 rounded-lg ${isCritical ? 'bg-red-500 text-white' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'}`}>
                                            <Users size={16} />
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-4">
                                        <div className="flex items-end justify-between">
                                            <div className="text-3xl font-black text-gray-900 dark:text-white font-mono">{region.current}</div>
                                            <div className="text-xs font-bold text-gray-400 mb-1 tracking-tighter">/ {region.capacity} MAX</div>
                                        </div>

                                        <div className="h-2 bg-gray-100 dark:bg-slate-900 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-1000 ${isCritical ? 'bg-red-500' : isModerate ? 'bg-amber-500' : 'bg-green-500'}`}
                                                style={{ width: `${Math.min(100, load)}%` }}
                                            />
                                        </div>

                                        <div className="pt-2 flex items-center justify-between text-[11px] font-bold">
                                            <span className="text-gray-400">ML PROJECTION</span>
                                            <span className="text-blue-500">{projectedLoad}% LOAD</span>
                                        </div>

                                        {/* Admin: Capacity Adjustment */}
                                        {isAdmin && (
                                            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700/50">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Adjust Max Capacity</span>
                                                    <span className="text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-md">{region.capacity}</span>
                                                </div>
                                                <input
                                                    type="range" min="20" max="2000" step="10"
                                                    value={region.capacity}
                                                    onChange={(e) => handleUpdateCapacity(region.id, e.target.value)}
                                                    className="w-full h-1.5 bg-gray-100 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                                />
                                                <div className="flex justify-between mt-1 px-0.5">
                                                    <span className="text-[8px] font-bold text-gray-400 uppercase">Min: 20</span>
                                                    <span className="text-[8px] font-bold text-gray-400 uppercase">Max: 2000</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div >
    );
};

export default Events;
