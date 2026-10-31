import { NextResponse } from 'next/server';
import agentCard from '@/../public/.well-known/agent.json';

export const dynamic = 'force-static';

export async function GET() {
  return NextResponse.json(agentCard, {
    status: 200,
    headers: {
      'Content-Type': 'application/agent-card+json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
