'use client';

import React from 'react';
import Sidebar from '@/components/Sidebar';
import { Settings as SettingsIcon, Bell, Shield, User } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="flex h-screen bg-zinc-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-3xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-zinc-900">Settings</h1>
            <p className="text-zinc-500">Configure your application preferences.</p>
          </header>

          <div className="space-y-6">
            <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-zinc-100 flex items-center gap-3">
                <User className="w-5 h-5 text-zinc-400" />
                <h2 className="font-bold text-zinc-900">Profile Settings</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Display Name</label>
                  <input type="text" className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" defaultValue="Admin User" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Email Address</label>
                  <input type="email" className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" defaultValue="admin@example.com" />
                </div>
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-zinc-100 flex items-center gap-3">
                <Bell className="w-5 h-5 text-zinc-400" />
                <h2 className="font-bold text-zinc-900">Notifications</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-zinc-900">Push Notifications</div>
                    <div className="text-sm text-zinc-500">Receive alerts for new messages</div>
                  </div>
                  <div className="w-12 h-6 bg-emerald-500 rounded-full relative cursor-pointer">
                    <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
