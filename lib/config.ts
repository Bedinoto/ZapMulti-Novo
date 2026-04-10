export const API_URL = (typeof window !== 'undefined' && (window.location.hostname.includes('render.com') || window.location.hostname.includes('localhost'))) 
  ? '' 
  : (process.env.NEXT_PUBLIC_API_URL || '');
