import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Loader2,
  Settings,
  Key,
  Eye,
  EyeOff,
  ArrowLeft,
  Sparkles,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AppLayout } from '@/components/layout';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';
import { userAISettingsService } from '@/lib/services';
import type { AIProvider } from '@/types';

const aiSettingsSchema = z.object({
  anthropic_api_key: z.string().optional(),
  openai_api_key: z.string().optional(),
  gemini_api_key: z.string().optional(),
  default_provider: z.enum(['anthropic', 'openai', 'gemini', 'auto']),
  auto_mode_enabled: z.boolean(),
});

type AISettingsForm = z.infer<typeof aiSettingsSchema>;

const PROVIDER_INFO = {
  anthropic: {
    name: 'Anthropic Claude',
    description: 'Claude 모델 사용 (코드, 분석에 강점)',
    icon: '🟣',
    keyPrefix: 'sk-ant-',
    docsUrl: 'https://console.anthropic.com/account/keys',
  },
  openai: {
    name: 'OpenAI GPT',
    description: 'GPT-4o 모델 사용 (다목적, 창의성)',
    icon: '🟢',
    keyPrefix: 'sk-',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  gemini: {
    name: 'Google Gemini',
    description: 'Gemini Pro 모델 사용 (멀티모달)',
    icon: '🔵',
    keyPrefix: 'AI',
    docsUrl: 'https://makersuite.google.com/app/apikey',
  },
};

export function AISettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [existingSettings, setExistingSettings] = useState<AISettingsForm | null>(null);

  const form = useForm<AISettingsForm>({
    resolver: zodResolver(aiSettingsSchema),
    defaultValues: {
      anthropic_api_key: '',
      openai_api_key: '',
      gemini_api_key: '',
      default_provider: 'auto',
      auto_mode_enabled: true,
    },
  });

  // Load existing settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await userAISettingsService.getSettings();

        if (data) {
          setExistingSettings(data);
          form.reset({
            anthropic_api_key: data.anthropic_api_key || '',
            openai_api_key: data.openai_api_key || '',
            gemini_api_key: data.gemini_api_key || '',
            default_provider: data.default_provider || 'auto',
            auto_mode_enabled: data.auto_mode_enabled ?? true,
          });
        }
      } catch (error) {
        console.error('Failed to load AI settings:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [form]);

  const onSubmit = async (data: AISettingsForm) => {
    setIsSaving(true);
    try {
      await userAISettingsService.upsertSettings({
        anthropic_api_key: data.anthropic_api_key || undefined,
        openai_api_key: data.openai_api_key || undefined,
        gemini_api_key: data.gemini_api_key || undefined,
        default_provider: data.default_provider,
        auto_mode_enabled: data.auto_mode_enabled,
      });

      toast.success('AI 설정이 저장되었습니다');
      setExistingSettings(data);
    } catch (error) {
      console.error('Failed to save AI settings:', error);
      toast.error('설정 저장에 실패했습니다');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleShowKey = (provider: string) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  const hasAnyKey = form.watch('anthropic_api_key') || 
                    form.watch('openai_api_key') || 
                    form.watch('gemini_api_key');

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="w-full p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Settings className="h-6 w-6" />
              AI 설정
            </h1>
            <p className="text-slate-400">
              AI 모델 API 키 및 설정을 관리합니다
            </p>
          </div>
        </div>

        {/* Info Alert */}
        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertDescription>
            API 키가 없어도 기본 Lovable AI를 사용할 수 있습니다. 
            자신의 API 키를 등록하면 더 많은 토큰과 빠른 응답을 받을 수 있습니다.
          </AlertDescription>
        </Alert>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* API Keys */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  API 키 설정
                </CardTitle>
                <CardDescription>
                  각 AI 제공자의 API 키를 입력하세요. 키는 암호화되어 저장됩니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {(Object.entries(PROVIDER_INFO) as [keyof typeof PROVIDER_INFO, typeof PROVIDER_INFO.anthropic][]).map(([provider, info]) => (
                  <FormField
                    key={provider}
                    control={form.control}
                    name={`${provider}_api_key` as keyof AISettingsForm}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <span>{info.icon}</span>
                          {info.name}
                          {field.value && (
                            <Check className="h-4 w-4 text-green-500" />
                          )}
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showKeys[provider] ? 'text' : 'password'}
                              placeholder={`${info.keyPrefix}...`}
                              {...field}
                              value={field.value as string || ''}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full"
                              onClick={() => toggleShowKey(provider)}
                            >
                              {showKeys[provider] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormDescription className="flex items-center justify-between">
                          <span>{info.description}</span>
                          <a 
                            href={info.docsUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-xs"
                          >
                            키 발급받기 →
                          </a>
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </CardContent>
            </Card>

            {/* Default Provider */}
            <Card>
              <CardHeader>
                <CardTitle>기본 설정</CardTitle>
                <CardDescription>
                  AI 채팅에서 사용할 기본 모델을 선택합니다
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="default_provider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>기본 AI 모델</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="모델 선택" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="auto">
                            <span className="flex items-center gap-2">
                              ✨ 자동 선택
                            </span>
                          </SelectItem>
                          <SelectItem value="anthropic" disabled={!form.watch('anthropic_api_key')}>
                            <span className="flex items-center gap-2">
                              🟣 Claude {!form.watch('anthropic_api_key') && '(키 필요)'}
                            </span>
                          </SelectItem>
                          <SelectItem value="openai" disabled={!form.watch('openai_api_key')}>
                            <span className="flex items-center gap-2">
                              🟢 GPT {!form.watch('openai_api_key') && '(키 필요)'}
                            </span>
                          </SelectItem>
                          <SelectItem value="gemini" disabled={!form.watch('gemini_api_key')}>
                            <span className="flex items-center gap-2">
                              🔵 Gemini {!form.watch('gemini_api_key') && '(키 필요)'}
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        자동 선택은 대화 내용에 따라 최적의 모델을 선택합니다
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="auto_mode_enabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">자동 모드</FormLabel>
                        <FormDescription>
                          대화 내용을 분석하여 최적의 AI 모델을 자동으로 선택합니다
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={!hasAnyKey}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                취소
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  '설정 저장'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </AppLayout>
  );
}
