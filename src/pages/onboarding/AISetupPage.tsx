import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Check,
  ExternalLink,
  Brain,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useMCPStore } from '@/stores/mcpStore';
import { useTeamStore } from '@/stores/teamStore';
import { LLM_PROVIDERS, type LLMProvider } from '@/types/mcp';
import { toast } from 'sonner';

const MAIN_PROVIDERS: LLMProvider[] = ['anthropic', 'openai', 'gemini'];

export function AISetupPage() {
  const navigate = useNavigate();
  const {
    providerApiKeys,
    setProviderApiKey,
    initializePresetModels,
    setOnboardingCompleted
  } = useMCPStore();
  const { currentTeam, loadTeams, selectTeam } = useTeamStore();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleShowKey = (provider: string) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  const handleKeyChange = (provider: LLMProvider, value: string) => {
    setProviderApiKey(provider, value);
    // Clear error when user starts typing
    if (error) setError(null);
  };

  const hasAtLeastOneKey = MAIN_PROVIDERS.some(p => providerApiKeys[p]?.length > 0);

  // Navigate to dashboard after ensuring team data is loaded
  const navigateToDashboard = async () => {
    if (currentTeam) {
      // Re-select team to ensure members and projects are loaded
      await selectTeam(currentTeam.id);
    } else {
      // Reload teams to get fresh data
      await loadTeams();
    }
    navigate('/dashboard', { replace: true });
  };

  const handleComplete = async () => {
    // Validate at least one API key is entered
    if (!hasAtLeastOneKey) {
      setError('Please enter at least one API key to continue with AI features.');
      return;
    }

    setIsLoading(true);
    try {
      initializePresetModels();
      setOnboardingCompleted(true);
      toast.success('Setup complete! Welcome to Lil PM');
      await navigateToDashboard();
    } catch (error) {
      console.error('Failed to complete setup:', error);
      toast.error('Failed to complete setup');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    setIsLoading(true);
    try {
      initializePresetModels();
      setOnboardingCompleted(true);
      await navigateToDashboard();
    } catch (error) {
      console.error('Failed to skip setup:', error);
      toast.error('Failed to complete setup');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d0f] px-4 py-8">
      <div className="w-full max-w-lg space-y-8">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-medium">✓</div>
            <span className="text-sm text-slate-400">Team</span>
          </div>
          <div className="w-8 h-px bg-emerald-500" />
          <div className="flex items-center gap-1">
            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-medium">✓</div>
            <span className="text-sm text-slate-400">Project</span>
          </div>
          <div className="w-8 h-px bg-emerald-500" />
          <div className="flex items-center gap-1">
            <div className="w-8 h-8 rounded-full bg-violet-500 text-white flex items-center justify-center text-sm font-medium">3</div>
            <span className="text-sm font-medium text-white">AI Setup</span>
          </div>
        </div>

        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/20 mb-6">
            <Sparkles className="h-8 w-8 text-violet-400" />
          </div>
          <h1 className="text-2xl font-semibold text-white">Power up with AI</h1>
          <p className="text-slate-400 mt-2">
            Connect your AI providers to unlock Lil PM AI assistant
          </p>
        </div>

        {/* AI Features Preview */}
        <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-purple-500/5 rounded-xl">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 mb-4">
              <Brain className="h-5 w-5 text-violet-500 mt-0.5" />
              <div>
                <h3 className="font-medium">What Lil PM AI can do:</h3>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                  <li>• Generate PRDs and feature specifications</li>
                  <li>• Auto-create development tickets from discussions</li>
                  <li>• Analyze project progress and suggest improvements</li>
                  <li>• Answer questions about your codebase and issues</li>
                </ul>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="h-4 w-4 text-amber-500" />
              <span>Uses your own API keys - you control the costs</span>
            </div>
          </CardContent>
        </Card>

        {/* API Key Inputs */}
        <div className="space-y-4">
          <Label className="text-base">Enter your API keys</Label>

          {MAIN_PROVIDERS.map((provider) => {
            const config = LLM_PROVIDERS[provider];
            const hasKey = providerApiKeys[provider]?.length > 0;

            return (
              <div key={provider} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{config.icon}</span>
                    <span className="font-medium">{config.name}</span>
                    {hasKey && (
                      <Badge variant="default" className="bg-green-500/20 text-green-500 text-xs">
                        <Check className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    )}
                  </div>
                  <a
                    href={config.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                  >
                    Get API key
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="relative">
                  <Input
                    type={showKeys[provider] ? 'text' : 'password'}
                    placeholder={config.apiKeyPlaceholder}
                    value={providerApiKeys[provider] || ''}
                    onChange={(e) => handleKeyChange(provider, e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => toggleShowKey(provider)}
                  >
                    {showKeys[provider] ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
            );
          })}

          <p className="text-xs text-muted-foreground">
            Your API keys are stored locally and never sent to our servers.
            You can add more providers later in Settings → LLM Models.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/onboarding/create-project')}
            className="flex-1"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={handleComplete}
            className="flex-1"
            disabled={isLoading}
          >
            Continue with AI
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {/* Skip link - always visible */}
        <div className="text-center">
          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={handleSkip}
          >
            I'll set this up later
          </Button>
        </div>
      </div>
    </div>
  );
}

