import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout';
import { LilyChat } from '@/components/lily';

export function LilyPage() {
  const [searchParams] = useSearchParams();

  // Read project context from URL params for AI-assisted creation
  const projectContext = searchParams.get('context') === 'project' ? {
    projectId: searchParams.get('projectId') || undefined,
    projectName: searchParams.get('projectName') || undefined,
    type: searchParams.get('type') as 'issue' | 'prd' | undefined,
  } : undefined;

  return (
    <AppLayout>
      <LilyChat projectContext={projectContext} />
    </AppLayout>
  );
}
