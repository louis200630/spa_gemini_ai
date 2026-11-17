import { next } from '@vercel/functions';

// Protect only the two personal-use tools. Health questionnaire stays public.
// The password lives in Vercel project settings, never in public source code.
export const config = {
  matcher: [
    '/image-review/:path*',
    '/recommendation-list/:path*',
    '/recommendation-list.html',
    '/image-review.html'
  ]
};

export default function middleware(request) {
  const password = process.env.PRIVATE_TOOLS_PASSWORD;
  if (!password) {
    return new Response('Private tools are not configured.', {
      status: 503,
      headers: { 'Cache-Control': 'private, no-store', 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  const requiredHeader = 'Basic ' + btoa('owner:' + password);
  const providedHeader = request.headers.get('authorization') || '';
  if (providedHeader !== requiredHeader) {
    return new Response('This is a private workspace. Sign in to continue.', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Private Product Tools", charset="UTF-8"',
        'Cache-Control': 'private, no-store',
        'Content-Type': 'text/plain; charset=utf-8'
      }
    });
  }

  return next({ headers: { 'Cache-Control': 'private, no-store' } });
}
