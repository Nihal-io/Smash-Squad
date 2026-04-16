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
    <div className="relative flex min-h-screen flex-col bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800">
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-6">
        <Card className="w-full max-w-md rounded-xl border-0 shadow-xl bg-white dark:bg-slate-950">
          <CardHeader className="text-center space-y-4 pb-2 pt-8 px-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white dark:bg-slate-900 ring-1 ring-indigo-100 dark:ring-slate-800">
              <Zap className="h-8 w-8 text-indigo-600 dark:text-indigo-400" strokeWidth={2.25} />
            </div>
            <div>
              <CardTitle className="text-3xl font-semibold tracking-tight">FestFlow</CardTitle>
              <CardDescription className="mt-3 text-base text-muted-foreground">
                AI-powered volunteer coordination
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
                  className="h-11 bg-background focus-visible:ring-indigo-500 dark:focus-visible:ring-indigo-400"
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
                  className="h-11 bg-background focus-visible:ring-indigo-500 dark:focus-visible:ring-indigo-400"
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
                className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
              >
                Register as a volunteer
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      <footer className="relative z-10 pb-8 text-center">
        <p className="text-sm text-indigo-200">Built for TechFest 2026</p>
      </footer>
    </div>
  );
}
