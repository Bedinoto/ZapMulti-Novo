'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/config';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    fetch(`${API_URL}/api/auth/me`, { credentials: 'include' })
      .then(res => {
        if (res.ok) {
          router.push('/chats');
        } else {
          router.push('/login');
        }
      })
      .catch(() => router.push('/login'));
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen bg-zinc-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
    </div>
  );
}
