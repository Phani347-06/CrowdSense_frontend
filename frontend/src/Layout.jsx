import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';

const Layout = () => {
    const [theme, setTheme] = useState('light');
    const [searchQuery, setSearchQuery] = useState('');
    useEffect(() => {
        console.log("Layout Search State:", searchQuery);
    }, [searchQuery]);

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        document.documentElement.classList.toggle('dark');
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    };

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') || 'light';
        setTheme(savedTheme);
        if (savedTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        document.documentElement.setAttribute('data-theme', savedTheme);
    }, []);

    return (
        <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300">
            <Sidebar theme={theme} toggleTheme={toggleTheme} />
            <div className="flex flex-col flex-1 overflow-hidden relative">
                <Header searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
                <main className="flex-1 overflow-y-auto p-8 relative scroll-smooth">
                    <Outlet context={{ searchQuery, setSearchQuery }} />
                </main>
            </div>
        </div>
    );
};

export default Layout;
