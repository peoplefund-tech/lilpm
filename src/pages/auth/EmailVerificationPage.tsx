import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, Loader2, RefreshCw, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function EmailVerificationPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user, isEmailVerified, resendVerificationEmail, logout } = useAuthStore();
    const [isResending, setIsResending] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    const returnUrl = searchParams.get('returnUrl');

    useEffect(() => {
        if (isEmailVerified) {
            const redirectTo = returnUrl || '/onboarding/create-team';
            navigate(redirectTo, { replace: true });
        }
    }, [isEmailVerified, navigate, returnUrl]);

    useEffect(() => {
        const checkEmailVerification = async () => {
            try {
                const { data: { user: currentUser } } = await supabase.auth.getUser();
                if (currentUser?.email_confirmed_at) {
                    await supabase.auth.refreshSession();
                }
            } catch (error) {
                console.error('Error checking email verification:', error);
            }
        };

        pollingRef.current = setInterval(checkEmailVerification, 3000);
        checkEmailVerification();

        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
            }
        };
    }, []);

    const handleResend = async () => {
        setIsResending(true);
        setResendSuccess(false);
        try {
            await resendVerificationEmail();
            setResendSuccess(true);
            toast.success(t('auth.verificationEmailSent', '인증 이메일을 다시 보냈습니다'));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t('auth.resendError', '이메일 재전송에 실패했습니다'));
        } finally {
            setIsResending(false);
        }
    };

    const handleLogout = async () => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
        }
        await logout();
        navigate('/login', { replace: true });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0d0d0f] px-4">
            <div className="w-full max-w-md">
                <div className="bg-[#1a1a1f] border border-white/10 rounded-2xl p-8 shadow-2xl text-center space-y-6">
                    {/* Icon */}
                    <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-violet-500/10 border border-violet-500/20">
                        <Mail className="h-10 w-10 text-violet-400" />
                    </div>

                    {/* Title */}
                    <div>
                        <h1 className="text-2xl font-semibold text-white">
                            {t('auth.verifyEmail', 'Verify your email')}
                        </h1>
                        <p className="text-slate-400 mt-3 leading-relaxed">
                            {t('auth.verificationInstructions', 'We sent a verification link to:')}
                        </p>
                        <p className="text-lg font-medium mt-2 text-violet-400">
                            {user?.email}
                        </p>
                    </div>

                    {/* Instructions */}
                    <div className="bg-[#121215] border border-white/5 rounded-xl p-4 text-sm text-slate-400 space-y-2">
                        <p>{t('auth.checkInbox', 'Check your inbox and click the verification link.')}</p>
                        <p>{t('auth.checkSpam', "If you don't see the email, check your spam folder.")}</p>
                    </div>

                    {/* Resend Button */}
                    <div className="space-y-3">
                        {resendSuccess ? (
                            <div className="flex items-center justify-center gap-2 text-emerald-400">
                                <CheckCircle className="h-5 w-5" />
                                <span>{t('auth.emailSent', 'Email sent successfully')}</span>
                            </div>
                        ) : (
                            <Button
                                variant="outline"
                                className="w-full gap-2 bg-[#121215] border-white/10 text-slate-300 hover:bg-white/5 hover:text-white h-11 rounded-xl"
                                onClick={handleResend}
                                disabled={isResending}
                            >
                                {isResending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        {t('auth.sending', 'Sending...')}
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="h-4 w-4" />
                                        {t('auth.resendEmail', 'Resend verification email')}
                                    </>
                                )}
                            </Button>
                        )}

                        <Button
                            variant="ghost"
                            className="w-full text-slate-500 hover:text-slate-300 hover:bg-white/5"
                            onClick={handleLogout}
                        >
                            {t('auth.useAnotherEmail', 'Sign up with a different email')}
                        </Button>
                    </div>

                    {/* Help text */}
                    <p className="text-xs text-slate-500">
                        {t('auth.verificationHelp', 'Once verified, you will be redirected automatically.')}
                    </p>
                </div>
            </div>
        </div>
    );
}
