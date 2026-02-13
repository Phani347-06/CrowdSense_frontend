
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wifi, Key, Mail, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Login = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isReset, setIsReset] = useState(false);
    const [isRegister, setIsRegister] = useState(false);
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (localStorage.getItem('user')) {
            navigate('/dashboard');
        }
    }, [navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        let endpoint = '/api/auth/login';
        if (isRegister) endpoint = '/api/auth/register';
        if (isReset) endpoint = '/api/auth/reset-password';

        try {
            const response = await fetch(`http://127.0.0.1:5000${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                if (isReset) {
                    setSuccess('Password updated! You can now login.');
                    setIsReset(false);
                } else if (isRegister) {
                    setSuccess('Registration successful! Please login.');
                    setIsRegister(false);
                } else {
                    localStorage.setItem('user', JSON.stringify(data.user || { email }));
                    navigate('/dashboard');
                }
            } else {
                setError(data.error || 'Request failed');
            }
        } catch (err) {
            setError('System error. Check if backend is running.');
        } finally {
            setLoading(false);
        }
    };

    // Animation Variants
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { duration: 0.8, ease: "easeOut" }
        },
        exit: { opacity: 0, transition: { duration: 0.5 } }
    };

    const cardVariants = {
        hidden: { opacity: 0, y: 30, scale: 0.96 },
        visible: {
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
                duration: 0.6,
                ease: [0.22, 1, 0.36, 1] // Modern cubic-bezier
            }
        }
    };

    const inputVariants = {
        rest: { scale: 1, borderColor: "transparent", boxShadow: "none" },
        focus: {
            scale: 1.02,
            borderColor: "#3b82f6",
            boxShadow: "0 0 0 4px rgba(59, 130, 246, 0.1)",
            transition: { duration: 0.2 }
        }
    };

    const buttonVariants = {
        rest: { scale: 1, y: 0 },
        hover: {
            scale: 1.02,
            y: -2,
            boxShadow: "0 10px 25px -5px rgba(37, 99, 235, 0.4)",
            transition: { duration: 0.2 }
        },
        tap: { scale: 0.97 },
        loading: { opacity: 0.8, scale: 0.98 }
    };

    const iconVariants = {
        float: {
            y: [0, -6, 0],
            transition: {
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
            }
        }
    };

    return (
        <AnimatePresence mode='wait'>
            <motion.div
                className="flex items-center justify-center min-h-screen relative overflow-hidden p-4"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
            >
                {/* 1. Animated Gradient Background */}
                <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 animate-gradient-xy"></div>

                {/* 2. Floating Particles (Enhanced) */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                    <motion.div
                        className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-500/20 rounded-full blur-[120px] opacity-30"
                        animate={{
                            x: [0, 50, -30, 0],
                            y: [0, -30, 50, 0],
                            scale: [1, 1.1, 0.9, 1]
                        }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    />
                    <motion.div
                        className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/20 rounded-full blur-[120px] opacity-30"
                        animate={{
                            x: [0, -40, 20, 0],
                            y: [0, 40, -20, 0],
                            scale: [1, 0.9, 1.1, 1]
                        }}
                        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                    />
                </div>

                <motion.div
                    className="bg-white/80 dark:bg-slate-800/90 backdrop-blur-xl p-8 rounded-3xl shadow-2xl w-full max-w-md text-center border border-white/20 dark:border-slate-700/50 relative z-10"
                    variants={cardVariants}
                >
                    {/* 5️⃣ Icon Animation */}
                    <motion.div
                        className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-blue-500/30"
                        variants={iconVariants}
                        animate="float"
                    >
                        <Wifi size={28} />
                    </motion.div>

                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 mb-2">CrowdSense</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 font-medium">
                        {isReset ? 'Set your new password' : isRegister ? 'Create your campus account' : 'Campus Crowd Monitoring System'}
                    </p>

                    <AnimatePresence mode="wait">
                        {error && (
                            <motion.div
                                key="error"
                                initial={{ opacity: 0, y: -10, height: 0 }}
                                animate={{ opacity: 1, y: 0, height: "auto" }}
                                exit={{ opacity: 0, y: -10, height: 0 }}
                                className="mb-6 p-4 bg-red-50/80 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 text-sm font-bold uppercase tracking-tight backdrop-blur-sm"
                            >
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                {error}
                            </motion.div>
                        )}

                        {success && (
                            <motion.div
                                key="success"
                                initial={{ opacity: 0, y: -10, height: 0 }}
                                animate={{ opacity: 1, y: 0, height: "auto" }}
                                exit={{ opacity: 0, y: -10, height: 0 }}
                                className="mb-6 p-4 bg-green-50/80 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 rounded-xl flex items-center gap-3 text-green-600 dark:text-green-400 text-sm font-bold uppercase tracking-tight backdrop-blur-sm"
                            >
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                {success}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form onSubmit={handleSubmit} className="space-y-6 text-left">
                        {/* 3️⃣ Input Field Focus Animation */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 ml-1">College Email</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors duration-300" />
                                <motion.input
                                    type="email"
                                    placeholder="name@vnrvjiet.in"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900/50 text-gray-900 dark:text-white outline-none"
                                    variants={inputVariants}
                                    initial="rest"
                                    whileFocus="focus"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2 ml-1">
                                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{isReset ? 'New Password' : 'Password'}</label>
                                {!isRegister && !isReset && (
                                    <button
                                        type="button"
                                        onClick={() => { setIsReset(true); setError(''); setSuccess(''); }}
                                        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors relative group"
                                    >
                                        Forgot Password?
                                        <span className="absolute -bottom-0.5 left-0 w-0 h-0.5 bg-blue-600 dark:bg-blue-400 transition-all group-hover:w-full"></span>
                                    </button>
                                )}
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors duration-300" />
                                <motion.input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900/50 text-gray-900 dark:text-white outline-none"
                                    variants={inputVariants}
                                    initial="rest"
                                    whileFocus="focus"
                                    required
                                />
                            </div>
                        </div>

                        {/* 4️⃣ Button Animation */}
                        <motion.button
                            type="submit"
                            disabled={loading}
                            className={`w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/25 relative overflow-hidden ${loading ? 'cursor-not-allowed' : ''}`}
                            variants={buttonVariants}
                            initial="rest"
                            whileHover={!loading ? "hover" : "rest"}
                            whileTap={!loading ? "tap" : "rest"}
                            animate={loading ? "loading" : "rest"}
                        >
                            {loading ? (
                                <div className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Processing...</span>
                                </div>
                            ) : (
                                <span>{isReset ? 'Update Password' : isRegister ? 'Create Account' : 'Access Dashboard'}</span>
                            )}
                        </motion.button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-700/50 space-y-4">
                        <button
                            onClick={() => { setIsRegister(!isRegister); setIsReset(false); setError(''); setSuccess(''); }}
                            className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors relative group py-1"
                        >
                            {isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
                            {/* 6️⃣ Smooth Register Link Hover */}
                            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 dark:bg-blue-400 transition-all duration-300 group-hover:w-full"></span>
                        </button>

                        {(isRegister || isReset) && (
                            <motion.button
                                onClick={() => { setIsRegister(false); setIsReset(false); setError(''); setSuccess(''); }}
                                className="text-xs font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 block w-full"
                                whileHover={{ scale: 1.05 }}
                            >
                                ← Back to Login
                            </motion.button>
                        )}

                        <p className="mt-6 text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-bold opacity-60">
                            &copy; 2026 CrowdSense Analytics
                        </p>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default Login;
