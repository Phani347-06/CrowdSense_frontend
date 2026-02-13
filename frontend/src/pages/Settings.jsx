import React, { useState } from 'react';
import { User, Bell, Lock, Globe, Monitor, Shield, Save } from 'lucide-react';

const Settings = () => {
    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(false);

    // User State
    const [user, setUser] = useState(() => {
        try {
            const u = localStorage.getItem('user');
            return u ? (typeof JSON.parse(u) === 'object' ? JSON.parse(u) : { email: JSON.parse(u) }) : { email: 'guest@vnrvjiet.in', name: 'Guest User' };
        } catch (e) { return { email: 'guest@vnrvjiet.in' }; }
    });

    const [appTitle, setAppTitle] = useState(localStorage.getItem('appTitle') || 'CrowdSense');

    const handleSaveTitle = () => {
        localStorage.setItem('appTitle', appTitle);
        alert("Dashboard title updated!");
        window.location.reload();
    };

    const handleResetSystem = () => {
        if (window.confirm("Are you sure you want to reset the dashboard title to default?")) {
            localStorage.removeItem('appTitle');
            setAppTitle('CrowdSense');
            window.location.reload();
        }
    };

    const handleSaveProfile = (e) => {
        e.preventDefault();
        setLoading(true);
        // Simulate API call
        setTimeout(() => {
            localStorage.setItem('user', JSON.stringify(user));
            setLoading(false);
            alert("Profile updated!");
        }, 800);
    };

    return (
        <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Settings</h2>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden flex flex-col md:flex-row min-h-[600px]">
                {/* Sidebar Navigation */}
                <div className="w-full md:w-64 bg-slate-50 dark:bg-slate-900/50 border-r border-gray-100 dark:border-slate-700 p-4">
                    <nav className="space-y-1">
                        <button
                            onClick={() => setActiveTab('profile')}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'profile' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                        >
                            <User size={18} /> Profile
                        </button>
                        <button
                            onClick={() => setActiveTab('notifications')}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'notifications' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                        >
                            <Bell size={18} /> Notifications
                        </button>
                        <button
                            onClick={() => setActiveTab('security')}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'security' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                        >
                            <Lock size={18} /> Security
                        </button>
                        <button
                            onClick={() => setActiveTab('display')}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'display' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                        >
                            <Monitor size={18} /> Display
                        </button>
                        <button
                            onClick={() => setActiveTab('system')}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'system' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                        >
                            <Shield size={18} /> System
                        </button>
                    </nav>
                </div>

                {/* Content Area */}
                <div className="flex-1 p-6 md:p-8">
                    {activeTab === 'profile' && (
                        <form onSubmit={handleSaveProfile} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Profile Information</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Update your account's profile information and email address.</p>
                            </div>

                            <div className="flex items-center gap-6">
                                <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-2xl font-bold text-blue-600 dark:text-blue-300 border-4 border-white dark:border-slate-700 shadow-sm">
                                    {user.email?.[0]?.toUpperCase() || 'U'}
                                </div>
                                <div>
                                    <h4 className="font-medium text-gray-900 dark:text-white">{user.email}</h4>
                                    <p className="text-xs text-gray-500">Administrator</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">First Name</label>
                                    <input
                                        type="text"
                                        value={user.name?.split(' ')[0] || ''}
                                        onChange={(e) => setUser({ ...user, name: `${e.target.value} ${user.name?.split(' ')[1] || ''}` })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Last Name</label>
                                    <input
                                        type="text"
                                        value={user.name?.split(' ')[1] || ''}
                                        onChange={(e) => setUser({ ...user, name: `${user.name?.split(' ')[0] || ''} ${e.target.value}` })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email Address</label>
                                    <input
                                        type="email"
                                        value={user.email}
                                        readOnly
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">Email cannot be changed directly.</p>
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end">
                                <button type="submit" disabled={loading} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30 disabled:opacity-50">
                                    <Save size={18} /> {loading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    )}

                    {activeTab === 'notifications' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Notification Preferences</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Manage how you receive notifications and alerts.</p>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/30 rounded-xl">
                                    <div>
                                        <div className="font-medium text-gray-900 dark:text-white">Email Notifications</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">Receive daily summaries and critical alerts via email.</div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" defaultChecked />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/30 rounded-xl">
                                    <div>
                                        <div className="font-medium text-gray-900 dark:text-white">Push Notifications</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">Receive real-time alerts on your browser.</div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" defaultChecked />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Security Settings</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Manage your password and security questions.</p>
                            </div>

                            <div className="grid grid-cols-1 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Current Password</label>
                                    <input type="password" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">New Password</label>
                                    <input type="password" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none" />
                                </div>
                                <div className="pt-2">
                                    <button className="px-6 py-2.5 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-medium hover:bg-slate-900 dark:hover:bg-slate-600 transition-colors">Update Password</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'display' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Display Settings</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Customize the interface appearance.</p>
                            </div>

                            <div className="grid grid-cols-1 gap-6">
                                <div className="p-4 bg-white dark:bg-slate-700/30 rounded-xl border border-gray-100 dark:border-slate-700">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Dashboard Title</label>
                                    <div className="flex gap-3">
                                        <input
                                            type="text"
                                            value={appTitle}
                                            onChange={(e) => setAppTitle(e.target.value)}
                                            className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                            placeholder="Enter custom title..."
                                        />
                                        <button
                                            onClick={handleSaveTitle}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                                        >
                                            Apply
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">Changes will reload the page.</p>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/30 rounded-xl border border-gray-100 dark:border-slate-700">
                                    <div>
                                        <div className="font-medium text-gray-900 dark:text-white">Dark Mode</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">Toggle dark/light theme interface</div>
                                    </div>
                                    <button
                                        onClick={() => document.documentElement.classList.toggle('dark')}
                                        className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg text-sm font-medium hover:opacity-80 transition-all"
                                    >
                                        Toggle Theme
                                    </button>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/30 rounded-xl border border-gray-100 dark:border-slate-700 opacity-60">
                                    <div>
                                        <div className="font-medium text-gray-900 dark:text-white">Compact Mode</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">Reduce padding and font sizes (Coming Soon)</div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-not-allowed">
                                        <input type="checkbox" className="sr-only peer" disabled />
                                        <div className="w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-700"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'system' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">System Diagnostics</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Monitor backend connections and services.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 rounded-xl flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center text-green-600">
                                        <Monitor size={20} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-gray-900 dark:text-white">Backend API</div>
                                        <div className="text-xs text-green-600 dark:text-green-400">Connected (127.0.0.1:5000)</div>
                                    </div>
                                </div>
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-xl flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600">
                                        <Save size={20} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-gray-900 dark:text-white">Database</div>
                                        <div className="text-xs text-blue-600 dark:text-blue-400">MongoDB Active</div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30">
                                <h4 className="text-red-800 dark:text-red-200 font-medium mb-2">Danger Zone</h4>
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-red-600/80 dark:text-red-300/60">Reset the dashboard title to its original default.</p>
                                    <button
                                        onClick={handleResetSystem}
                                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                                    >
                                        Reset Title
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
};

export default Settings;
