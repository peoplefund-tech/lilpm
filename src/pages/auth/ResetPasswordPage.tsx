import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Lock, CheckCircle2, Eye, EyeOff } from 'lucide-react';
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

export function ResetPasswordPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isValidSession, setIsValidSession] = useState<boolean | null>(null);

    useEffect(() => {
        const checkToken = () => {
            // Get reset token from URL query params (?token=xxx)
            const urlParams = new URLSearchParams(window.location.search);
            const resetToken = urlParams.get('token');

            if (!resetToken) {
                navigate('/reset-password/expired');
                return;
            }

            setIsValidSession(true);
        };

        checkToken();
    }, [navigate]);

    const schema = z.object({
        password: z
            .string()
            .min(8, t('auth.passwordMinLength', 'Password must be at least 8 characters'))
            .regex(/[A-Z]/, t('auth.passwordUppercase', 'Password must contain at least one uppercase letter'))
            .regex(/[a-z]/, t('auth.passwordLowercase', 'Password must contain at least one lowercase letter'))
            .regex(/[0-9]/, t('auth.passwordNumber', 'Password must contain at least one number')),
        confirmPassword: z.string(),
    }).refine((data) => data.password === data.confirmPassword, {
        message: t('auth.passwordsDoNotMatch', "Passwords don't match"),
        path: ['confirmPassword'],
    });

    type FormData = z.infer<typeof schema>;

    const form = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            password: '',
            confirmPassword: '',
        },
    });

    const onSubmit = async (data: FormData) => {
        setIsLoading(true);
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const resetToken = urlParams.get('token');

            if (!resetToken) {
                navigate('/reset-password/expired');
                return;
            }

            const res = await apiClient.post<{ message: string }>('/auth/reset-password', {
                token: resetToken,
                password: data.password,
            });

            if (res.error) throw new Error(res.error);

            setIsSuccess(true);
            toast.success(t('auth.passwordResetSuccess', 'Password reset successfully'));
            setTimeout(() => navigate('/login'), 3000);
        } catch (error: any) {
            if (error.message?.includes('expired')) {
                navigate('/reset-password/expired');
            } else {
                toast.error(error.message || t('auth.passwordResetError', 'Failed to reset password'));
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (isValidSession === null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0d0d0f]">
                <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
            </div>
        );
    }

    if (isSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0d0d0f] px-4">
                <div className="w-full max-w-md">
                    <div className="bg-[#1a1a1f] border border-white/10 rounded-2xl p-8 shadow-2xl text-center space-y-6">
                        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                        </div>
                        <h1 className="text-2xl font-semibold text-white">{t('auth.passwordReset', 'Password reset!')}</h1>
                        <p className="text-slate-400">
                            {t('auth.passwordResetSuccessDesc', 'Your password has been reset successfully. You will be redirected to login.')}
                        </p>
                        <Link to="/login">
                            <Button className="w-full bg-violet-500 hover:bg-violet-400 text-white h-11 rounded-xl">
                                {t('auth.login', 'Log in')}
                            </Button>
                        </Link>
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
                            <Lock className="h-7 w-7 text-violet-400" />
                        </div>
                        <h1 className="text-2xl font-semibold text-white">{t('auth.resetPassword', 'Reset password')}</h1>
                        <p className="text-slate-400 mt-2">
                            {t('auth.resetPasswordDesc', 'Enter your new password below')}
                        </p>
                    </div>

                    {/* Form */}
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-slate-300">{t('auth.newPassword', 'New password')}</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Input
                                                    type={showPassword ? 'text' : 'password'}
                                                    placeholder="••••••••"
                                                    autoComplete="new-password"
                                                    className="bg-[#121215] border-white/10 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20 h-11 rounded-xl pr-10"
                                                    {...field}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="absolute right-0 top-0 h-full px-3 text-slate-500 hover:text-white"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                >
                                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </Button>
                                            </div>
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
                                        <FormLabel className="text-slate-300">{t('auth.confirmPassword', 'Confirm password')}</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Input
                                                    type={showConfirmPassword ? 'text' : 'password'}
                                                    placeholder="••••••••"
                                                    autoComplete="new-password"
                                                    className="bg-[#121215] border-white/10 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20 h-11 rounded-xl pr-10"
                                                    {...field}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="absolute right-0 top-0 h-full px-3 text-slate-500 hover:text-white"
                                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                >
                                                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        </FormControl>
                                        <FormMessage className="text-red-400" />
                                    </FormItem>
                                )}
                            />

                            {/* Password requirements */}
                            <div className="text-xs text-slate-500 space-y-1 bg-[#121215] rounded-xl p-4 border border-white/5">
                                <p className="text-slate-400">{t('auth.passwordRequirements', 'Password must:')}</p>
                                <ul className="list-disc list-inside pl-2 space-y-0.5">
                                    <li>{t('auth.min8chars', 'Be at least 8 characters')}</li>
                                    <li>{t('auth.hasUppercase', 'Contain an uppercase letter')}</li>
                                    <li>{t('auth.hasLowercase', 'Contain a lowercase letter')}</li>
                                    <li>{t('auth.hasNumber', 'Contain a number')}</li>
                                </ul>
                            </div>

                            <Button
                                type="submit"
                                className="w-full bg-violet-500 hover:bg-violet-400 text-white h-11 rounded-xl font-medium"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {t('common.resetting', 'Resetting...')}
                                    </>
                                ) : (
                                    t('auth.resetPassword', 'Reset password')
                                )}
                            </Button>
                        </form>
                    </Form>
                </div>
            </div>
        </div>
    );
}
