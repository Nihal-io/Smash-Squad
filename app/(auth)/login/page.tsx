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
    <div className="relative flex min-h-screen flex-col bg-slate-950">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.22)_0%,_rgba(15,23,42,0)_45%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(15,23,42,0.2),rgba(15,23,42,0.92))]"
        aria-hidden
      />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-6">
        <Card className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/95 shadow-xl shadow-black/30">
          <CardHeader className="text-center space-y-4 pb-2 pt-8 px-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 ring-1 ring-indigo-900/80">
              <Zap className="h-8 w-8 text-indigo-400" strokeWidth={2.25} />
            </div>
            <div>
              <CardTitle className="text-3xl font-semibold tracking-tight text-white">FestFlow</CardTitle>
              <CardDescription className="mt-3 text-base text-slate-400">
                AI-powered volunteer coordination
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-8 pt-2 pb-8">
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="coord@festflow.dev"
                  className="h-11 border-slate-700 bg-slate-950/90 text-slate-100 placeholder:text-slate-500 focus-visible:ring-indigo-500"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 border-slate-700 bg-slate-950/90 text-slate-100 placeholder:text-slate-500 focus-visible:ring-indigo-500"
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full h-11 text-base font-medium bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={loading}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <div className="mt-8 text-center">
              <a
                href="/volunteer/register"
                className="text-sm text-slate-400 hover:text-white underline underline-offset-4 transition-colors"
              >
                Need an account? Register as a volunteer
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      <footer className="relative z-10 pb-8 text-center">
        <p className="text-sm text-indigo-300/80">Built for TechFest 2026</p>
      </footer>
    </div>
  );
}
