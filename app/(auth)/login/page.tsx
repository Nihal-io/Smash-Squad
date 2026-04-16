'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Zap } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        toast.error(error.message);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Login failed');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const role = profile?.role ?? 'volunteer';

      toast.success(`Logged in as ${role}`);

      if (role === 'coordinator' || role === 'admin') {
        router.push('/coordinator');
      } else {
        router.push('/volunteer');
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-600/85 via-violet-600/75 to-purple-900/90"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(255,255,255,0.18),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(15,23,42,0.5),transparent)]"
        aria-hidden
      />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-6">
        <Card className="w-full max-w-md border-0 shadow-xl shadow-indigo-950/25 bg-white/95 backdrop-blur-sm dark:bg-slate-950/95">
          <CardHeader className="text-center space-y-4 pb-2 pt-8 px-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30">
              <Zap className="h-8 w-8" strokeWidth={2.25} />
            </div>
            <div>
              <CardTitle className="text-3xl font-semibold tracking-tight">FestFlow</CardTitle>
              <CardDescription className="mt-3 text-base text-muted-foreground">
                Coordinate volunteers, tasks, and shifts in one calm workspace — built for high-trust events.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-8 pt-2 pb-8">
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="coord@festflow.dev"
                  className="h-11 bg-background"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 bg-background"
                  required
                />
              </div>
              <Button type="submit" className="w-full h-11 text-base font-medium shadow-md" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <div className="mt-8 text-center">
              <a
                href="/volunteer/register"
                className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
              >
                Register as a volunteer
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      <footer className="relative z-10 pb-6 text-center">
        <p className="text-sm text-white/70">Built for TechFest 2026 — volunteer coordination by FestFlow</p>
      </footer>
    </div>
  );
}
