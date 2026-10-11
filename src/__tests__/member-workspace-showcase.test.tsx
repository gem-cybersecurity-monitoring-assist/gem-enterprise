import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MemberWorkspaceShowcase } from '@/components/community/MemberWorkspaceShowcase';

describe('enterprise member workspace navigation', () => {
  it('showcases the actual member journeys without inventing activity', () => {
    const html = renderToStaticMarkup(<MemberWorkspaceShowcase />);
    expect(html).toContain('Ask questions, join discussions, develop ideas, and share recommendations.');
    expect(html).toContain('Private access');
    expect(html).toContain('ChatGPT sign-in');
    expect(html).toContain('does not automatically grant membership or specialist AI access');
    expect(html).not.toContain('<iframe');
  });
  it('opens each private journey through explicit safe navigation', () => {
    const html = renderToStaticMarkup(<MemberWorkspaceShowcase />);
    for (const path of ['/community', '/community/ai', '/community/members']) {
      expect(html).toContain(`href="https://gem-community-operations.p6kwdvjbpp.chatgpt.site${path}"`);
    }
    expect(html.match(/target="_blank"/g)).toHaveLength(3);
    expect(html.match(/rel="noopener noreferrer"/g)).toHaveLength(3);
    expect(html.match(/opens in a new tab/g)).toHaveLength(3);
  });
});

// Exercise the actual enterprise entry points without framework navigation context.
import { vi } from 'vitest';
vi.mock('next/link', () => ({ default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a> }));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('@/components/hub/HubShell', () => ({ HubShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
import PublicCommunity from '@/app/community/page';
import PortalCommunity from '@/app/app/community/page';
import CommunityHubLayout from '@/app/community-hub/layout';

describe('community entry-point placement', () => {
  it.each([
    ['public Community', <PublicCommunity key="public" />],
    ['client Community', <PortalCommunity key="portal" />],
    ['community hub', <CommunityHubLayout key="hub"><p>Existing preview content</p></CommunityHubLayout>],
  ])('exposes the workspace from %s', (_name, element) => {
    const html = renderToStaticMarkup(element);
    expect(html).toContain('aria-label="GEM member workspace"');
    expect(html).toContain('href="https://gem-community-operations.p6kwdvjbpp.chatgpt.site/community"');
  });
  it('preserves the preview notice while identifying the separate workspace', () => {
    const html = renderToStaticMarkup(<CommunityHubLayout><p>Existing preview content</p></CommunityHubLayout>);
    expect(html).toContain('Controlled preview:');
    expect(html).toContain('preview pages below');
    expect(html).toContain('Existing preview content');
  });
});
