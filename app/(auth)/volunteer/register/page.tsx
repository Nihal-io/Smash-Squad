'use client';

import { useState } from 'react';
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

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Registration Received</CardTitle>
            <CardDescription>
              Your application is pending coordinator approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="font-medium mb-1">Your login credentials:</p>
              <p>
                Email: <code>{credentials.email}</code>
              </p>
              <p>
                Password: <code>{credentials.password}</code>
              </p>
            </div>
            <Button asChild className="w-full">
              <a href="/login">Go to Login</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Volunteer Registration</CardTitle>
          <CardDescription>Sign up to volunteer at our upcoming fest</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="full_name">Full Name</Label>
              <Input id="full_name" {...register('full_name')} />
              {errors.full_name && (
                <p className="text-sm text-red-500 mt-1">{errors.full_name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && (
                <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" {...register('phone')} />
            </div>

            <div>
              <Label htmlFor="skills">Skills (comma separated)</Label>
              <Input
                id="skills"
                placeholder="electrical, logistics, photography"
                {...register('skills')}
              />
              {errors.skills && (
                <p className="text-sm text-red-500 mt-1">{errors.skills.message}</p>
              )}
            </div>

            <div>
              <Label>Availability Windows</Label>
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 mt-2 items-end">
                  <div className="flex-1">
                    <Label className="text-xs">Start</Label>
                    <Input
                      type="datetime-local"
                      {...register(`availability.${index}.start`)}
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs">End</Label>
                    <Input
                      type="datetime-local"
                      {...register(`availability.${index}.end`)}
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

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Register as Volunteer'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
