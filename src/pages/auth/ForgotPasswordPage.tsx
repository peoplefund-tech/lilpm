import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, ArrowLeft, Mail, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';

export function ForgotPasswordPage() {
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState(false);
    const [isEmailSent, setIsEmailSent] = useState(false);
    const [sentEmail, setSentEmail] = useState('');

    const schema = z.object({
        email: z.string().email(t('auth.invalidEmail')),
    });

    type FormData = z.infer<typeof schema>;

    const form = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            email: '',
        },
    });

    const onSubmit = async (data: FormData) => {
        setIsLoading(true);
        try {
            const res = await apiClient.post<{ message: string }>('/auth/forgot-password', {
                email: data.email,
            });

            if (res.error) {
                throw new Error(res.error);
            }

            setSentEmail(data.email);
            setIsEmailSent(true);
            toast.success(t('auth.resetEmailSent', 'Reset email sent'));
        } catch (error: any) {
            toast.error(error.message || t('auth.resetEmailError', 'Failed to send reset email'));
        } finally {
            setIsLoading(false);
        }
    };

    if (isEmailSent) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0d0d0f] px-4">
                <div className="w-full max-w-md">
                    <div className="bg-[#1a1a1f] border border-white/10 rounded-2xl p-8 shadow-2xl text-center space-y-6">
                        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                        </div>
                        <h1 className="text-2xl font-semibold text-white">{t('auth.checkYourEmail', 'Check your email')}</h1>
                        <p className="text-slate-400">
                            {t('auth.resetEmailSentTo', "We've sent a password reset link to")}
                            <br />
                            <span className="font-medium text-white">{sentEmail}</span>
                        </p>
                        <p className="text-sm text-slate-500">
                            {t('auth.resetLinkExpiry', 'The link will expire in 30 minutes.')}
                        </p>
                        <div className="pt-4 space-y-3">
                            <Button
                                variant="outline"
                                className="w-full bg-[#121215] border-white/10 text-slate-300 hover:bg-white/5 hover:text-white h-11 rounded-xl"
                                onClick={() => {
                                    setIsEmailSent(false);
                                    form.reset();
                                }}
                            >
                                {t('auth.tryDifferentEmail', 'Try a different email')}
                            </Button>
                            <Link to="/login" className="block">
                                <Button variant="ghost" className="w-full gap-2 text-slate-400 hover:text-white hover:bg-white/5">
                                    <ArrowLeft className="h-4 w-4" />
                                    {t('auth.backToLogin', 'Back to login')}
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0d0d0f] px-4">
            <div className="w-full max-w-md">
                <div className="bg-[#1a1a1f] border border-white/10 rounded-2xl p-8 shadow-2xl space-y-6">
                    {/* Header */}
                    <div className="text-center">
                        <div className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-violet-500/10 border border-violet-500/20 mb-4">
                            <Mail className="h-7 w-7 text-violet-400" />
                        </div>
                        <h1 className="text-2xl font-semibold text-white">{t('auth.forgotPassword', 'Forgot password?')}</h1>
                        <p className="text-slate-400 mt-2">
                            {t('auth.forgotPasswordDesc', "Enter your email and we'll send you a reset link")}
                        </p>
                    </div>

                    {/* Form */}
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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

                            <Button
                                type="submit"
                                className="w-full bg-violet-500 hover:bg-violet-400 text-white h-11 rounded-xl font-medium"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {t('common.sending', 'Sending...')}
                                    </>
                                ) : (
                                    t('auth.sendResetLink', 'Send reset link')
                                )}
                            </Button>
                        </form>
                    </Form>
                </div>

                {/* Back to login */}
                <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-300 mt-6">
                    <ArrowLeft className="h-4 w-4" />
                    {t('auth.backToLogin', 'Back to login')}
                </Link>
            </div>
        </div>
    );
}
