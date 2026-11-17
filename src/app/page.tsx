import dynamicImport from 'next/dynamic';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '../auth';

export const dynamic = 'force-dynamic';

const ChatWorkspace = dynamicImport(
  () => import('../components/ChatWorkspace').then((mod) => mod.ChatWorkspace),
  { ssr: false }
);

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/login');
  }
  return <ChatWorkspace />;
}
