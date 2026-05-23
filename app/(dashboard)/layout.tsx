import { createSupabaseServerClient } from '@/lib/server/client';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { RealtimeProvider } from '@/components/realtime-provider';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  // Tenta metadados, depois busca do perfil
  let clinicaId = user.user_metadata?.clinica_id;

  if (!clinicaId) {
    const { data: perfil } = await supabase
      .from('profiles')
      .select('clinica_id')
      .eq('id', user.id)
      .single();
    clinicaId = perfil?.clinica_id;
  }

  return (
    <RealtimeProvider clinicaId={clinicaId}>
      <div className="min-h-screen bg-background flex">
        <Sidebar user={user} />
        <div className="flex-1 flex flex-col lg:pl-72">
          <Header user={user} />
          <main className="flex-1 p-4 lg:p-8 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </RealtimeProvider>
  );
}