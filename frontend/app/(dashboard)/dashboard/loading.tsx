"use client";

import { motion } from "framer-motion";

export default function Loading() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] w-full p-8 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-3xl border border-slate-200 dark:border-slate-800 my-8">
            <div className="relative">
                {/* Main large spinner */}
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    className="w-20 h-20 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-indigo-600 dark:border-t-indigo-500 shadow-xl"
                />

                {/* Inner reverse spinner */}
                <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-2 rounded-full border-4 border-transparent border-t-emerald-500 dark:border-t-emerald-400 opacity-80"
                />

                {/* Center pulse dot */}
                <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="absolute inset-0 m-auto w-3 h-3 bg-indigo-600 dark:bg-indigo-400 rounded-full shadow-glow"
                />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-6 text-center"
            >
                <h3 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                    Preparing your dashboard
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto animate-pulse">
                    Fetching the latest data for you...
                </p>
            </motion.div>

            {/* Progress bar simulation */}
            <div className="mt-8 w-48 h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                    animate={{ x: [-192, 192] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    className="w-full h-full bg-gradient-to-r from-indigo-500 via-emerald-500 to-indigo-500"
                />
            </div>

            <style jsx>{`
        .shadow-glow {
          box-shadow: 0 0 10px rgba(79, 70, 229, 0.6);
        }
      `}</style>
        </div>
    );
}
