import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';

export function SignupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signup, isLoading } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  // Get returnUrl from query params for redirect after signup
  const returnUrl = searchParams.get('returnUrl');
  // Get email from query params for pre-fill (from invite flow)
  const prefilledEmail = searchParams.get('email');

  const signupSchema = z.object({
    name: z.string().min(2, t('auth.nameTooShort')),
    email: z.string().email(t('auth.invalidEmail')),
    password: z.string().min(6, t('auth.passwordTooShort')),
    confirmPassword: z.string(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t('auth.passwordMismatch'),
    path: ['confirmPassword'],
  });

  type SignupForm = z.infer<typeof signupSchema>;

  const form = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      email: prefilledEmail || '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: SignupForm) => {
    try {
      setError(null);
      await signup(data.email, data.password, data.name, returnUrl || undefined);
      toast.success(t('auth.signupSuccess'));
      // Pass returnUrl to email verification page
      const verifyUrl = returnUrl
        ? `/auth/verify-email?returnUrl=${encodeURIComponent(returnUrl)}`
        : '/auth/verify-email';
      navigate(verifyUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.signupError'));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header - matches LandingPage GNB */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to="/welcome" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-lg font-bold text-primary-foreground">L</span>
              </div>
              <span className="text-xl font-semibold">Lil PM</span>
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <Link to="/welcome#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t('landing.features', 'Features')}
            </Link>
            <Link to="/welcome#ai" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t('landing.ai', 'AI')}
            </Link>
            <Link to="/welcome#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t('landing.pricing', 'Pricing')}
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/login">
              <Button variant="ghost" size="sm">{t('auth.login')}</Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="pt-16 min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-8">
          {/* Logo */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary mb-4">
              <span className="text-2xl font-bold text-primary-foreground">L</span>
            </div>
            <h1 className="text-2xl font-semibold">{t('auth.createAccount')}</h1>
            <p className="text-muted-foreground mt-2">
              {t('auth.enterInfoToStart')}
            </p>
          </div>

          {/* Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
              )}

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.name')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('auth.namePlaceholder')}
                        autoComplete="name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.email')}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="name@company.com"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.password')}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.confirmPassword')}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('auth.signingUp')}
                  </>
                ) : (
                  t('auth.signup')
                )}
              </Button>
            </form>
          </Form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                {t('common.or')}
              </span>
            </div>
          </div>

          {/* Social Login */}
          <div className="space-y-2">
            <Button variant="outline" className="w-full" type="button">
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {t('auth.continueWithGoogle')}
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            {t('auth.hasAccount')}{' '}
            <Link
              to={returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : '/login'}
              className="font-medium text-primary hover:underline"
            >
              {t('auth.login')}
            </Link>
          </p>

          {/* Terms */}
          <p className="text-center text-xs text-muted-foreground">
            {t('auth.termsAgreement')}{' '}
            <a href="#" className="underline hover:text-foreground">
              {t('auth.termsOfService')}
            </a>
            {' '}{t('auth.and')}{' '}
            <a href="#" className="underline hover:text-foreground">
              {t('auth.privacyPolicy')}
            </a>
            {t('auth.termsAgreement').includes('동의') ? '에 동의하게 됩니다.' : '.'}
          </p>
        </div>
      </div>
    </div>
  );
}

