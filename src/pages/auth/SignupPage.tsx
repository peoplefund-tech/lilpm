import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Sparkles } from 'lucide-react';
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

  const returnUrl = searchParams.get('returnUrl');
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
      const verifyUrl = returnUrl
        ? `/auth/verify-email?returnUrl=${encodeURIComponent(returnUrl)}`
        : '/auth/verify-email';
      navigate(verifyUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.signupError'));
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d0f]">
      {/* Navigation Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#1a1a1f]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link to="/welcome" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
              <div className="h-9 w-9 rounded-xl bg-violet-500 flex items-center justify-center">
                <span className="text-lg font-bold text-white">L</span>
              </div>
              <span className="text-xl font-semibold text-white">Lil PM</span>
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <Link to="/welcome#features" className="text-sm text-slate-400 hover:text-white transition-colors">
              {t('landing.features', 'Features')}
            </Link>
            <Link to="/welcome#ai" className="text-sm text-slate-400 hover:text-white transition-colors">
              {t('landing.ai', 'AI')}
            </Link>
            <Link to="/welcome#pricing" className="text-sm text-slate-400 hover:text-white transition-colors">
              {t('landing.pricing', 'Pricing')}
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-white/5">
                {t('auth.login')}
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="pt-16 min-h-screen flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-8">
          {/* Card Container */}
          <div className="bg-[#1a1a1f] border border-white/10 rounded-2xl p-8 shadow-2xl">
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-violet-500 mb-4">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
              <h1 className="text-2xl font-semibold text-white">{t('auth.createAccount')}</h1>
              <p className="text-slate-400 mt-2">
                {t('auth.enterInfoToStart')}
              </p>
            </div>

            {/* Form */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {error && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-300">{t('auth.name')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('auth.namePlaceholder')}
                          autoComplete="name"
                          className="bg-[#121215] border-white/10 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20 h-11 rounded-xl"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-300">{t('auth.email')}</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="name@company.com"
                          autoComplete="email"
                          className="bg-[#121215] border-white/10 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20 h-11 rounded-xl"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-300">{t('auth.password')}</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          autoComplete="new-password"
                          className="bg-[#121215] border-white/10 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20 h-11 rounded-xl"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-300">{t('auth.confirmPassword')}</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          autoComplete="new-password"
                          className="bg-[#121215] border-white/10 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20 h-11 rounded-xl"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full bg-violet-500 hover:bg-violet-400 text-white h-11 rounded-xl font-medium mt-2"
                  disabled={isLoading}
                >
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
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#1a1a1f] px-3 text-slate-500">
                  {t('common.or')}
                </span>
              </div>
            </div>

            {/* Social Login */}
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full bg-[#121215] border-white/10 text-slate-300 hover:bg-white/5 hover:text-white h-11 rounded-xl"
                type="button"
              >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
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
          </div>

          <p className="text-center text-sm text-slate-500">
            {t('auth.hasAccount')}{' '}
            <Link
              to={returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : '/login'}
              className="font-medium text-violet-400 hover:text-violet-300"
            >
              {t('auth.login')}
            </Link>
          </p>

          {/* Terms */}
          <p className="text-center text-xs text-slate-500">
            {t('auth.termsAgreement')}{' '}
            <a href="#" className="underline hover:text-slate-300">
              {t('auth.termsOfService')}
            </a>
            {' '}{t('auth.and')}{' '}
            <a href="#" className="underline hover:text-slate-300">
              {t('auth.privacyPolicy')}
            </a>
            {t('auth.termsAgreement').includes('동의') ? '에 동의하게 됩니다.' : '.'}
          </p>
        </div>
      </div>
    </div>
  );
}
