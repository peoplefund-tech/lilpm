import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  ArrowLeft,
  Settings,
  Globe,
  Check,
  Palette,
  Sun,
  Moon,
  Monitor,
  Bell,
  Shield,
  Bot,
  Plug,
  Brain,
  Github,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AppLayout } from '@/components/layout';
import { useLanguageStore, Language } from '@/stores/languageStore';
import { useThemeStore, Theme } from '@/stores/themeStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const LANGUAGES: { code: Language; name: string; nativeName: string; flag: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
];

const THEMES: { code: Theme; name: string; icon: React.ElementType }[] = [
  { code: 'light', name: 'light', icon: Sun },
  { code: 'dark', name: 'dark', icon: Moon },
  { code: 'system', name: 'system', icon: Monitor },
];

export function GeneralSettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguageStore();
  const { theme, setTheme } = useThemeStore();

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    toast.success(t('settings.saved'));
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    toast.success(t('settings.saved'));
  };

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
              {t('settings.title')}
            </h1>
            <p className="text-muted-foreground">
              {t('settings.general')}
            </p>
          </div>
        </div>

        {/* Language Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {t('settings.language')}
            </CardTitle>
            <CardDescription>
              {t('settings.languageDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-lg border transition-colors",
                    "hover:bg-accent hover:border-primary/50",
                    language === lang.code && "border-primary bg-primary/5"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{lang.flag}</span>
                    <div className="text-left">
                      <p className="font-medium">{lang.nativeName}</p>
                      <p className="text-sm text-muted-foreground">{lang.name}</p>
                    </div>
                  </div>
                  {language === lang.code && (
                    <Check className="h-5 w-5 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Theme Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              {t('settings.theme')}
            </CardTitle>
            <CardDescription>
              {t('settings.themeDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {THEMES.map((themeOption) => {
                const Icon = themeOption.icon;
                return (
                  <button
                    key={themeOption.code}
                    onClick={() => handleThemeChange(themeOption.code)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors",
                      "hover:bg-accent hover:border-primary/50",
                      theme === themeOption.code && "border-primary bg-primary/5"
                    )}
                  >
                    <Icon className={cn(
                      "h-6 w-6",
                      theme === themeOption.code ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span className="text-sm font-medium">
                      {t(`settings.${themeOption.name}`)}
                    </span>
                    {theme === themeOption.code && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Navigation to other settings */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/settings/notifications')}
            className="flex items-center justify-between w-full p-4 rounded-lg border hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div className="text-left">
                <p className="font-medium">{t('settings.notifications')}</p>
                <p className="text-sm text-muted-foreground">{t('settings.notificationsShortDesc')}</p>
              </div>
            </div>
            <ArrowLeft className="h-4 w-4 rotate-180" />
          </button>

          <button
            onClick={() => navigate('/settings/security')}
            className="flex items-center justify-between w-full p-4 rounded-lg border hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div className="text-left">
                <p className="font-medium">{t('settings.security')}</p>
                <p className="text-sm text-muted-foreground">{t('settings.securityShortDesc')}</p>
              </div>
            </div>
            <ArrowLeft className="h-4 w-4 rotate-180" />
          </button>

          <button
            onClick={() => navigate('/settings/ai')}
            className="flex items-center justify-between w-full p-4 rounded-lg border hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-3">
              <Bot className="h-5 w-5 text-muted-foreground" />
              <div className="text-left">
                <p className="font-medium">{t('settings.ai')}</p>
                <p className="text-sm text-muted-foreground">{t('settings.apiKeys')}</p>
              </div>
            </div>
            <ArrowLeft className="h-4 w-4 rotate-180" />
          </button>

          <button
            onClick={() => navigate('/settings/mcp')}
            className="flex items-center justify-between w-full p-4 rounded-lg border hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-3">
              <Plug className="h-5 w-5 text-muted-foreground" />
              <div className="text-left">
                <p className="font-medium">{t('settings.mcp', 'MCP Connections')}</p>
                <p className="text-sm text-muted-foreground">{t('settings.mcpShortDesc', 'Manage external service connections')}</p>
              </div>
            </div>
            <ArrowLeft className="h-4 w-4 rotate-180" />
          </button>

          <button
            onClick={() => navigate('/settings/llm')}
            className="flex items-center justify-between w-full p-4 rounded-lg border hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-3">
              <Brain className="h-5 w-5 text-muted-foreground" />
              <div className="text-left">
                <p className="font-medium">{t('settings.llm', 'LLM Models')}</p>
                <p className="text-sm text-muted-foreground">{t('settings.llmShortDesc', 'Register AI models and auto-mixing')}</p>
              </div>
            </div>
            <ArrowLeft className="h-4 w-4 rotate-180" />
          </button>

          <button
            onClick={() => navigate('/settings/github')}
            className="flex items-center justify-between w-full p-4 rounded-lg border hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-3">
              <Github className="h-5 w-5 text-muted-foreground" />
              <div className="text-left">
                <p className="font-medium">{t('settings.github', 'GitHub Integration')}</p>
                <p className="text-sm text-muted-foreground">{t('settings.githubShortDesc', 'Auto-link commits/PRs with issues')}</p>
              </div>
            </div>
            <ArrowLeft className="h-4 w-4 rotate-180" />
          </button>

          <button
            onClick={() => navigate('/settings/slack')}
            className="flex items-center justify-between w-full p-4 rounded-lg border hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              <div className="text-left">
                <p className="font-medium">{t('settings.slack', 'Slack Integration')}</p>
                <p className="text-sm text-muted-foreground">{t('settings.slackShortDesc', 'Notifications and MCP connection')}</p>
              </div>
            </div>
            <ArrowLeft className="h-4 w-4 rotate-180" />
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
