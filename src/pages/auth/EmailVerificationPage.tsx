import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, Loader2, RefreshCw, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';

export function EmailVerificationPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user, isEmailVerified, resendVerificationEmail, logout } = useAuthStore();
    const [isResending, setIsResending] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);

    // If email is verified, redirect to team creation
    React.useEffect(() => {
        if (isEmailVerified) {
            navigate('/onboarding/create-team', { replace: true });
        }
    }, [isEmailVerified, navigate]);

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
        await logout();
        navigate('/login', { replace: true });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
            <div className="w-full max-w-md space-y-8 text-center">
                {/* Icon */}
                <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-primary/10 mx-auto">
                    <Mail className="h-10 w-10 text-primary" />
                </div>

                {/* Title */}
                <div>
                    <h1 className="text-2xl font-semibold">
                        {t('auth.verifyEmail', '이메일을 인증해주세요')}
                    </h1>
                    <p className="text-muted-foreground mt-3 leading-relaxed">
                        {t('auth.verificationInstructions', `다음 이메일 주소로 인증 링크를 보냈습니다:`)}
                    </p>
                    <p className="text-lg font-medium mt-2 text-primary">
                        {user?.email}
                    </p>
                </div>

                {/* Instructions */}
                <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground space-y-2">
                    <p>{t('auth.checkInbox', '받은편지함을 확인하고 인증 링크를 클릭해주세요.')}</p>
                    <p>{t('auth.checkSpam', '이메일이 보이지 않으면 스팸 폴더를 확인해주세요.')}</p>
                </div>

                {/* Resend Button */}
                <div className="space-y-3">
                    {resendSuccess ? (
                        <div className="flex items-center justify-center gap-2 text-green-600">
                            <CheckCircle className="h-5 w-5" />
                            <span>{t('auth.emailSent', '이메일을 발송했습니다')}</span>
                        </div>
                    ) : (
                        <Button
                            variant="outline"
                            className="w-full gap-2"
                            onClick={handleResend}
                            disabled={isResending}
                        >
                            {isResending ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {t('auth.sending', '전송 중...')}
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="h-4 w-4" />
                                    {t('auth.resendEmail', '인증 이메일 다시 보내기')}
                                </>
                            )}
                        </Button>
                    )}

                    <Button
                        variant="ghost"
                        className="w-full text-muted-foreground"
                        onClick={handleLogout}
                    >
                        {t('auth.useAnotherEmail', '다른 이메일로 가입하기')}
                    </Button>
                </div>

                {/* Help text */}
                <p className="text-xs text-muted-foreground">
                    {t('auth.verificationHelp', '인증이 완료되면 자동으로 다음 단계로 이동합니다.')}
                </p>
            </div>
        </div>
    );
}
