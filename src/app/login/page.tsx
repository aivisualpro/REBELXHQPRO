'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Lock, Mail, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const result = await signIn('credentials', {
                redirect: false,
                email,
                password,
            });

            if (result?.error) {
                setError(result.error);
            } else {
                // Fetch session to get profileId for redirect
                const sessionRes = await fetch('/api/auth/session');
                const sess = await sessionRes.json();
                const profileId = sess?.user?.profileId;
                if (profileId) {
                    router.push(`/profile/${profileId}`);
                } else {
                    router.push('/profile');
                }
                router.refresh();
            }
        } catch (err) {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-black relative overflow-hidden font-inter">
            {/* Background elements for premium feel */}
            <div className="absolute top-0 left-0 w-full h-full">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/10 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10 w-full max-w-[400px] px-6">
                <div className="text-center mb-10">
                    <div className="inline-block p-4 rounded-2xl bg-white/5 border border-white/10 mb-6 backdrop-blur-xl">
                        <Image
                            src="https://res.cloudinary.com/dwkq4s4rg/image/upload/v1766349100/rebelx-headquarters/assets/rebelx_logo_new.png"
                            alt="RebelX"
                            width={100}
                            height={40}
                            priority
                            loading="eager"
                            style={{ height: 'auto' }}
                            className="h-10 w-auto object-contain"
                        />
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-widest uppercase mb-2">Login</h1>
                    <p className="text-[11px] text-gray-500 uppercase tracking-[0.3em] font-bold">HQ Unified ERP System</p>
                </div>

                <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-8 rounded-3xl shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-black text-gray-400 tracking-wider ml-1">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your email"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50 transition-all placeholder:text-gray-600"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-black text-gray-400 tracking-wider ml-1">Secret Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50 transition-all placeholder:text-gray-600"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center space-x-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-[11px] font-bold uppercase tracking-tight">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary hover:opacity-90 text-primary-foreground font-black uppercase text-xs tracking-widest py-4 rounded-2xl shadow-xl shadow-primary/10 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center space-x-2 cursor-pointer"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Authenticating...</span>
                                </>
                            ) : (
                                <span>Access System</span>
                            )}
                        </button>
                    </form>

                    <div className="mt-6">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-white/10" />
                            </div>
                            <div className="relative flex justify-center text-[10px] uppercase font-bold">
                                <span className="bg-[#111] px-4 text-gray-500 tracking-widest">Or Access With</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => signIn('google', { callbackUrl: '/profile' })}
                            className="mt-6 w-full bg-white text-black hover:bg-gray-200 font-bold text-xs tracking-wider py-4 rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center space-x-3 cursor-pointer border border-transparent"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                                <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                />
                                <path
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    fill="#EA4335"
                                />
                            </svg>
                            <span>Google Auth</span>
                        </button>
                    </div>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-[9px] text-gray-600 uppercase font-black tracking-widest">
                        Restricted Access System v1.0
                    </p>
                </div>
            </div>
        </div>
    );
}
