import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Key, Loader2, ExternalLink, Check, AlertTriangle } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface ApiKeyRequiredModalProps {
    open: boolean;
    onKeysSaved: () => void;
    onClose: () => void;
    saveApiKey: (provider: 'anthropic' | 'openai' | 'gemini', key: string) => Promise<void>;
}

const PROVIDER_INFO = {
    anthropic: {
        name: 'Anthropic Claude',
        description: 'Claude 모델 (코드, 분석에 강점)',
        icon: '🟣',
        keyPrefix: 'sk-ant-',
        docsUrl: 'https://console.anthropic.com/account/keys',
    },
    openai: {
        name: 'OpenAI GPT-4',
        description: 'GPT-4o 모델 (범용 AI)',
        icon: '🟢',
        keyPrefix: 'sk-',
        docsUrl: 'https://platform.openai.com/api-keys',
    },
    gemini: {
        name: 'Google Gemini',
        description: 'Gemini Pro 모델 (멀티모달)',
        icon: '🔵',
        keyPrefix: 'AI',
        docsUrl: 'https://makersuite.google.com/app/apikey',
    },
};

type Provider = keyof typeof PROVIDER_INFO;

export function ApiKeyRequiredModal({ open, onKeysSaved, onClose, saveApiKey }: ApiKeyRequiredModalProps) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<Provider>('anthropic');
    const [apiKey, setApiKey] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!apiKey.trim()) {
            toast.error(t('settings.pleaseEnterApiKey', 'API 키를 입력해주세요'));
            return;
        }

        setIsSaving(true);
        try {
            await saveApiKey(activeTab, apiKey.trim());
            toast.success(t('settings.apiKeySaved', 'API 키가 저장되었습니다'));
            onKeysSaved();
        } catch (error) {
            toast.error(t('settings.apiKeySaveError', 'API 키 저장에 실패했습니다'));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
            <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                        </div>
                        <div>
                            <DialogTitle>{t('lily.apiKeyRequired', 'API 키가 필요합니다')}</DialogTitle>
                            <DialogDescription>
                                {t('lily.apiKeyRequiredDesc', '릴리 AI를 사용하려면 최소 하나의 AI 서비스 API 키가 필요합니다.')}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as Provider); setApiKey(''); }}>
                    <TabsList className="grid grid-cols-3 w-full">
                        {(Object.keys(PROVIDER_INFO) as Provider[]).map((provider) => (
                            <TabsTrigger key={provider} value={provider} className="gap-1">
                                <span>{PROVIDER_INFO[provider].icon}</span>
                                <span className="hidden sm:inline">{provider === 'anthropic' ? 'Claude' : provider === 'openai' ? 'GPT-4' : 'Gemini'}</span>
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {(Object.keys(PROVIDER_INFO) as Provider[]).map((provider) => (
                        <TabsContent key={provider} value={provider} className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor={`${provider}-key`}>{PROVIDER_INFO[provider].name} API Key</Label>
                                    <a
                                        href={PROVIDER_INFO[provider].docsUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-primary hover:underline flex items-center gap-1"
                                    >
                                        키 발급받기
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                </div>
                                <Input
                                    id={`${provider}-key`}
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder={`${PROVIDER_INFO[provider].keyPrefix}...`}
                                    className="font-mono text-sm"
                                />
                                <p className="text-xs text-muted-foreground">
                                    {PROVIDER_INFO[provider].description}
                                </p>
                            </div>
                        </TabsContent>
                    ))}
                </Tabs>

                <div className="flex justify-between gap-2 mt-4">
                    <Button variant="ghost" onClick={onClose}>
                        나중에
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving || !apiKey.trim()}>
                        {isSaving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                저장 중...
                            </>
                        ) : (
                            <>
                                <Check className="mr-2 h-4 w-4" />
                                저장하고 시작하기
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
