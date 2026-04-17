'use client';

import { useState, type ReactNode } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { toast } from 'sonner';

const schema = z.object({
  full_name: z.string().min(1, 'Name required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
  skills: z.string().min(1, 'Add at least one skill'),
  availability: z
    .array(
      z.object({
        start: z.string().min(1, 'Start time required'),
        end: z.string().min(1, 'End time required'),
      })
    )
    .min(1, 'Add at least one availability window'),
});

type FormData = z.infer<typeof schema>;

export default function VolunteerRegisterPage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [credentials, setCredentials] = useState({ email: '', password: '' });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: '',
      email: '',
      phone: '',
      skills: '',
      availability: [{ start: '', end: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'availability',
  });

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      const skills = data.skills
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      const availability = data.availability.map((w) => ({
        start: new Date(w.start).toISOString(),
        end: new Date(w.end).toISOString(),
      }));

      const res = await fetch('/api/volunteers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: data.full_name,
          email: data.email,
          phone: data.phone || undefined,
          skills,
          availability,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || 'Registration failed');
        return;
      }

      const email = typeof result.email === 'string' ? result.email : data.email;
      const password = typeof result.password === 'string' ? result.password : '';

      setCredentials({ email, password });
      toast.success('Registration submitted! Awaiting approval. You can now log in.');
      setSubmitted(true);
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const shell = (inner: ReactNode) => (
    <div className="relative flex min-h-screen flex-col bg-slate-950">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.22)_0%,_rgba(15,23,42,0)_45%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(15,23,42,0.2),rgba(15,23,42,0.92))]"
        aria-hidden
      />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-6">{inner}</div>
      <footer className="relative z-10 pb-8 text-center">
        <p className="text-sm text-indigo-300/80">Built for TechFest 2026</p>
      </footer>
    </div>
  );

  if (submitted) {
    return shell(
      <Card className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/95 shadow-xl shadow-black/30">
        <CardHeader>
          <CardTitle className="text-white">Registration Received</CardTitle>
          <CardDescription className="text-slate-400">
            Your application is pending coordinator approval.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border border-slate-700 bg-slate-950/80 p-3 text-sm text-slate-200">
            <p className="font-medium mb-1 text-white">Your login credentials:</p>
            <p>
              Email: <code>{credentials.email}</code>
            </p>
            <p>
              Password: <code>{credentials.password}</code>
            </p>
          </div>
          <Button asChild className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
            <a href="/login">Go to Login</a>
          </Button>
          <p className="text-center text-xs text-slate-400">
            Need to submit another volunteer?{' '}
            <a href="/volunteer/register" className="underline underline-offset-4 hover:text-white">
              Register again
            </a>
          </p>
        </CardContent>
      </Card>
    );
  }

  return shell(
    <Card className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900/95 shadow-xl shadow-black/30">
      <CardHeader>
        <CardTitle className="text-white">Volunteer Registration</CardTitle>
        <CardDescription className="text-slate-400">Sign up to volunteer at our upcoming fest</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="full_name" className="text-slate-300">Full Name</Label>
            <Input
              id="full_name"
              {...register('full_name')}
              className="border-slate-700 bg-slate-950/90 text-slate-100 placeholder:text-slate-500 focus-visible:ring-indigo-500"
            />
            {errors.full_name && (
              <p className="text-sm text-red-500 mt-1">{errors.full_name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="email" className="text-slate-300">Email</Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
              className="border-slate-700 bg-slate-950/90 text-slate-100 placeholder:text-slate-500 focus-visible:ring-indigo-500"
            />
            {errors.email && (
              <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="phone" className="text-slate-300">Phone (optional)</Label>
            <Input id="phone" {...register('phone')} className="border-slate-700 bg-slate-950/90 text-slate-100 placeholder:text-slate-500 focus-visible:ring-indigo-500" />
          </div>

          <div>
            <Label htmlFor="skills" className="text-slate-300">Skills (comma separated)</Label>
            <Input
              id="skills"
              placeholder="electrical, logistics, photography"
              {...register('skills')}
              className="border-slate-700 bg-slate-950/90 text-slate-100 placeholder:text-slate-500 focus-visible:ring-indigo-500"
            />
            {errors.skills && (
              <p className="text-sm text-red-500 mt-1">{errors.skills.message}</p>
            )}
          </div>

          <div>
            <Label className="text-slate-300">Availability Windows</Label>
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-2 mt-2 items-end">
                <div className="flex-1">
                  <Label className="text-xs text-slate-400">Start</Label>
                  <Input
                    type="datetime-local"
                    {...register(`availability.${index}.start`)}
                    className="border-slate-700 bg-slate-950/90 text-slate-100 placeholder:text-slate-500 focus-visible:ring-indigo-500"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-slate-400">End</Label>
                  <Input
                    type="datetime-local"
                    {...register(`availability.${index}.end`)}
                    className="border-slate-700 bg-slate-950/90 text-slate-100 placeholder:text-slate-500 focus-visible:ring-indigo-500"
                  />
                </div>
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(index)}
                  >
                    x
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => append({ start: '', end: '' })}
            >
              + Add window
            </Button>
            {errors.availability && (
              <p className="text-sm text-red-500 mt-1">
                {errors.availability.message || errors.availability.root?.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Register as Volunteer'}
          </Button>
          <p className="text-center text-sm text-slate-400">
            Already registered?{' '}
            <a href="/login" className="underline underline-offset-4 hover:text-white">
              Sign in
            </a>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
