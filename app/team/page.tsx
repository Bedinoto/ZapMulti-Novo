'use client';

import React from 'react';
import Sidebar from '@/components/Sidebar';

export default function TeamPage() {
  return (
    <div className="flex h-screen bg-zinc-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-5xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-zinc-900">Team Management</h1>
            <p className="text-zinc-500">Manage your agents and their permissions.</p>
          </header>
          
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Agent</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {[
                  { name: 'Admin User', email: 'admin@example.com', role: 'Administrator', status: 'Active' },
                  { name: 'Support Agent 1', email: 'agent1@example.com', role: 'Agent', status: 'Active' },
                  { name: 'Support Agent 2', email: 'agent2@example.com', role: 'Agent', status: 'Offline' },
                ].map((agent) => (
                  <tr key={agent.email} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-zinc-900">{agent.name}</div>
                      <div className="text-sm text-zinc-500">{agent.email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-600">{agent.role}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        agent.status === 'Active' ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                      )}>
                        {agent.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-emerald-600 font-medium cursor-pointer hover:underline">
                      Edit
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
