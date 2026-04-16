import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);

  // Protect dashboard routes — redirect to login if no session
  const isDashboard =
    request.nextUrl.pathname.startsWith('/coordinator') ||
    request.nextUrl.pathname.startsWith('/admin') ||
    request.nextUrl.pathname.startsWith('/volunteer');

  // Skip protection for the public volunteer registration page
  const isPublicVolunteer = request.nextUrl.pathname === '/volunteer/register';

  if (isDashboard && !isPublicVolunteer) {
    const hasSession = !!user;

    // In dev mode, allow access without session (dev role switcher + header fallback)
    if (!hasSession && process.env.NODE_ENV === 'production') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
