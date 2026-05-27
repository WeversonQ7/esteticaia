import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookie = document.cookie
            .split('; ')
            .find((row) => row.startsWith(`${name}=`));
          return cookie ? cookie.split('=')[1] : undefined;
        },
        set(name: string, value: string, options: any) {
          // Configura o domínio para cobrir www e sem www
          const domain = '.esteticaia.app.br';
          let cookieString = `${name}=${value}; path=${options?.path || '/'}; domain=${domain}`;
          
          if (options?.maxAge) cookieString += `; max-age=${options.maxAge}`;
          if (options?.expires) cookieString += `; expires=${options.expires.toUTCString()}`;
          if (options?.sameSite) cookieString += `; samesite=${options.sameSite}`;
          if (options?.secure) cookieString += `; secure`;
          
          document.cookie = cookieString;
        },
        remove(name: string, options: any) {
          const domain = '.esteticaia.app.br';
          document.cookie = `${name}=; path=${options?.path || '/'}; domain=${domain}; max-age=0`;
        },
      },
    }
  );
}