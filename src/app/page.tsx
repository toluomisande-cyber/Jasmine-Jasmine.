import dynamicImport from 'next/dynamic';

export const dynamic = 'force-dynamic';

const ChatWorkspace = dynamicImport(
  () => import('../components/ChatWorkspace').then((mod) => mod.ChatWorkspace),
  { ssr: false }
);

export default function HomePage() {
  return <ChatWorkspace />;
}
