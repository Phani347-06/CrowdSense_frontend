import React from 'react';
import { Search, Download, Circle } from 'lucide-react';

const Header = ({ setSearchQuery }) => {
    const [inputValue, setInputValue] = React.useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log("Header: Submitting Search ->", inputValue);
        setSearchQuery(inputValue);
    };

    return (
        <header className="h-20 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between px-8 transition-colors duration-300 shadow-sm z-20">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest">
                    <Circle className="w-2 h-2 text-green-500 fill-current" />
                    <span>Live Campus Network</span>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <form onSubmit={handleSubmit} className="relative group flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search regions & press Enter..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            className="pl-10 pr-4 py-2.5 w-64 md:w-80 rounded-xl bg-gray-50 dark:bg-slate-800 border border-transparent focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400"
                        />
                    </div>
                    <button type="submit" className="hidden md:block px-4 py-2.5 bg-blue-600 text-white text-xs font-black rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">
                        SEARCH
                    </button>
                </form>
                <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-sm font-semibold text-gray-600 dark:text-gray-300 transition-colors shadow-sm">
                    <Download className="w-4 h-4" />
                    <span>Export</span>
                </button>
            </div>
        </header>
    );
};

export default Header;
