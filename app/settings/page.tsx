'use client';

import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Bell, 
  Lock, 
  User, 
  Globe, 
  Smartphone,
  MessageSquare,
  Save,
  CheckCircle2,
  Play
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    soundEnabled: true,
    pushEnabled: true,
    autoAssign: false
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const savedSettings = localStorage.getItem('chat_settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  const handleToggle = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    setIsSaving(true);
    localStorage.setItem('chat_settings', JSON.stringify(settings));
    
    // Request notification permission if push is enabled
    if (settings.pushEnabled && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }

    // Test sound if enabled to unlock audio context
    if (settings.soundEnabled) {
      const audio = new Audio('https://www.soundjay.com/buttons/sounds/button-20.mp3');
      audio.play().catch(e => console.log('Audio play blocked:', e));
    }

    setTimeout(() => {
      setIsSaving(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }, 800);
  };

  const menuItems = [
    { 
      id: 'soundEnabled', 
      icon: Bell, 
      label: 'Notificações Sonoras', 
      desc: 'Tocar som ao receber novas mensagens',
      action: (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            const audio = new Audio('https://www.soundjay.com/buttons/sounds/button-20.mp3');
            audio.play().catch(err => alert('Clique na página primeiro para permitir o som.'));
          }}
          className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-emerald-600 transition-colors"
          title="Testar Som"
        >
          <Play className="w-4 h-4" />
        </button>
      )
    },
    { id: 'pushEnabled', icon: Smartphone, label: 'Notificações Push', desc: 'Receber alertas no navegador' },
    { id: 'autoAssign', icon: Globe, label: 'Auto-atribuição', desc: 'Atribuir conversas novas automaticamente' },
  ];

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-8 max-w-4xl">
          <div className="mb-8 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">Configurações</h1>
              <p className="text-zinc-500 mt-1">Personalize sua experiência e gerencie sua conta</p>
            </div>
            <AnimatePresence>
              {showSuccess && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl border border-emerald-100 flex items-center gap-2 text-sm font-medium"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Configurações salvas!
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-zinc-50">
                <h2 className="font-bold text-zinc-900 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-emerald-600" />
                  Preferências de Chat
                </h2>
              </div>
              <div className="p-6 space-y-4">
                {menuItems.map((item) => {
                  const isActive = settings[item.id as keyof typeof settings];
                  return (
                    <div key={item.id} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center text-zinc-400">
                          <item.icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-900">{item.label}</p>
                          <p className="text-xs text-zinc-500">{item.desc}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {item.action}
                        <div 
                          role="button"
                          tabIndex={0}
                          onClick={() => handleToggle(item.id as keyof typeof settings)}
                          onKeyDown={(e) => e.key === 'Enter' && handleToggle(item.id as keyof typeof settings)}
                          className={cn(
                            "w-12 h-6 rounded-full transition-all relative cursor-pointer",
                            isActive ? "bg-emerald-600" : "bg-zinc-200"
                          )}
                        >
                          <div className={cn(
                            "w-4 h-4 bg-white rounded-full absolute top-1 transition-all",
                            isActive ? "right-1" : "left-1"
                          )} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end">
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 bg-emerald-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
