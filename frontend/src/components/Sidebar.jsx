import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Map, FileBarChart, Layers, AlertTriangle, Settings, Moon, Sun, Wifi, LogOut, User as UserIcon } from 'lucide-react';

const Sidebar = ({ theme, toggleTheme }) => {
    const location = useLocation();
    const navigate = useNavigate();

    let user = { email: 'guest@vnrvjiet.in' };
    try {
        const userStr = localStorage.getItem('user');
        if (userStr && userStr !== "undefined") {
            const parsed = JSON.parse(userStr);
            user = typeof parsed === 'object' ? parsed : { email: parsed };
        }
    } catch (e) {
        console.error("Auth parse error", e);
    }

    const userEmail = (user.email || '').toLowerCase();
    const isAdmin = userEmail === 'admin@vnrvjiet.in';
    const displayName = isAdmin ? 'Administrator' : 'Student Account';

    const handleLogout = () => {
        localStorage.removeItem('user');
        navigate('/');
    };

    return (
        <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 transition-colors duration-300">
            <div className="h-16 flex items-center px-6 border-b border-slate-800">
                <div className="flex items-center gap-3 text-white">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                        <Wifi size={18} />
                    </div>
                    <div>
                        <div className="font-bold text-lg leading-tight">{localStorage.getItem('appTitle') || 'CrowdSense'}</div>
                        <div className="text-xs text-slate-400 font-medium">Campus Analytics</div>
                    </div>
                </div>
            </div>

            <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">Main Menu</div>

                <NavLink to="/dashboard" className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                    <Layers size={18} />
                    <span>Overview</span>
                </NavLink>

                <NavLink to="/prediction" className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                    <FileBarChart size={18} />
                    <span>Reports</span>
                </NavLink>

                <div className="h-px bg-slate-800 my-4 mx-2"></div>

                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">Management</div>

                <NavLink to="/events" className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                    <AlertTriangle size={18} />
                    <span>Event Management</span>
                </NavLink>
                <NavLink to="/settings" className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                    <Settings size={18} />
                    <span>Settings</span>
                </NavLink>
                <div onClick={toggleTheme} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all duration-200 cursor-pointer mt-4">
                    {theme === 'dark' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
                    <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                </div>
            </nav>

            <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-400">
                                <UserIcon size={20} />
                            </div>
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-slate-900 rounded-full"></span>
                        </div>
                        <div className="overflow-hidden">
                            <div className="text-sm font-semibold text-white truncate">{displayName}</div>
                            <div className="text-[10px] text-slate-500 truncate lowercase">{user.email}</div>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                        title="Logout"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
