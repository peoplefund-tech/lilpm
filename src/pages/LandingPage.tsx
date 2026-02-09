import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ProductDemoShowcase } from '@/components/landing';
import {
  ArrowRight,
  Zap,
  GitBranch,
  BarChart3,
  Users,
  Sparkles,
  CheckCircle2,
  ArrowUpRight,
  Bot,
  FileText,
  Kanban,
} from 'lucide-react';

export function LandingPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Subtle Background - Reduced glow */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-500/8 rounded-full blur-[120px]" />
      </div>

      {/* Navigation - Full width */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="px-6 lg:px-12 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/30 transition-shadow">
              <span className="text-lg font-bold text-white">L</span>
            </div>
            <span className="text-xl font-semibold">Lil PM</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t('landing.features')}
            </a>
            <a href="#ai" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t('landing.ai')}
            </a>
            <a href="#demo" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Demo
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                {t('auth.login')}
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 shadow-md shadow-violet-500/20 border-0">
                {t('landing.getStartedFree')}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section - Full width */}
      <section className="pt-32 pb-12 px-6 lg:px-12">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-500 text-sm mb-8">
            <Sparkles className="h-4 w-4" />
            <span className="font-medium">{t('landing.aiPowered')}</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
            <span className="text-foreground">
              {t('landing.heroTitle1')}
            </span>
            <br />
            <span className="bg-gradient-to-r from-violet-500 to-purple-600 bg-clip-text text-transparent">
              {t('landing.heroTitle2')}
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            {t('landing.heroDescription')}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link to="/signup">
              <Button size="lg" className="h-14 px-8 text-base bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-violet-500/20 border-0 group">
                {t('landing.getStartedFree')}
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
            <a href="#demo">
              <Button variant="outline" size="lg" className="h-14 px-8 text-base border-border/50 hover:bg-muted/50">
                {t('landing.watchDemo')}
              </Button>
            </a>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            {[
              { icon: CheckCircle2, text: t('landing.freeToStart') },
              { icon: CheckCircle2, text: t('landing.noCardRequired') },
              { icon: CheckCircle2, text: t('landing.proTrial') },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/30 border border-border/30">
                <item.icon className="h-4 w-4 text-emerald-500" />
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product Demo Showcase - Full width, larger */}
      <section className="px-4 lg:px-8 pb-20" id="demo">
        <div className="max-w-[1400px] mx-auto">
          <ProductDemoShowcase />

          {/* Stats Grid - Full width */}
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { value: '2 min', label: 'PRD Generation', icon: FileText },
              { value: '100%', label: 'Auto Ticket Creation', icon: Kanban },
              { value: 'AI', label: 'ChatGPT, Claude, Gemini', icon: Bot },
              { value: 'Free', label: 'Start Now', icon: Zap },
            ].map((stat, i) => (
              <div key={i} className="text-center p-4 rounded-xl bg-card/50 border border-border/50 hover:border-violet-500/30 transition-colors group cursor-default">
                <stat.icon className="h-5 w-5 mx-auto mb-2 text-violet-500 group-hover:scale-110 transition-transform" />
                <div className="text-xl font-bold text-violet-500">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section - Full width */}
      <section id="features" className="py-20 px-6 lg:px-12 bg-muted/20">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 text-violet-500 text-xs font-medium mb-4">
              <Zap className="h-3.5 w-3.5" />
              Features
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {t('landing.featuresTitle')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('landing.featuresDescription')}
            </p>
          </div>

          {/* Feature Cards - Single violet accent color */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              icon={<Zap className="h-5 w-5" />}
              title={t('landing.feature1Title')}
              description={t('landing.feature1Desc')}
            />
            <FeatureCard
              icon={<GitBranch className="h-5 w-5" />}
              title={t('landing.feature2Title')}
              description={t('landing.feature2Desc')}
            />
            <FeatureCard
              icon={<BarChart3 className="h-5 w-5" />}
              title={t('landing.feature3Title')}
              description={t('landing.feature3Desc')}
            />
            <FeatureCard
              icon={<Users className="h-5 w-5" />}
              title={t('landing.feature4Title')}
              description={t('landing.feature4Desc')}
            />
            <FeatureCard
              icon={<Sparkles className="h-5 w-5" />}
              title={t('landing.feature5Title')}
              description={t('landing.feature5Desc')}
            />
            <FeatureCard
              icon={<ArrowUpRight className="h-5 w-5" />}
              title={t('landing.feature6Title')}
              description={t('landing.feature6Desc')}
            />
          </div>
        </div>
      </section>

      {/* AI Section - Full width */}
      <section id="ai" className="py-20 px-6 lg:px-12">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 text-violet-500 text-xs font-medium mb-6">
                <Bot className="h-3.5 w-3.5" />
                Lil PM AI
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6 leading-tight">
                {t('landing.aiTitle1')}
                <br />
                <span className="text-violet-500">
                  {t('landing.aiTitle2')}
                </span>
              </h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                {t('landing.aiDescription')}
              </p>

              <ul className="space-y-4">
                {[
                  t('landing.aiFeature1'),
                  t('landing.aiFeature2'),
                  t('landing.aiFeature3'),
                  t('landing.aiFeature4'),
                ].map((text, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="h-5 w-5 rounded-full bg-violet-500 flex items-center justify-center">
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-foreground/80">{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative">
              <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/50">
                  <div className="h-10 w-10 rounded-xl bg-violet-500 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <span className="font-semibold">Lily</span>
                    <p className="text-xs text-muted-foreground">AI Project Assistant</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5 text-xs text-emerald-500">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Online
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex-shrink-0 flex items-center justify-center text-xs font-medium">JD</div>
                    <div className="bg-muted/50 rounded-2xl rounded-bl-sm px-4 py-3 text-sm">
                      {t('landing.chatExample1')}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-violet-500 flex-shrink-0 flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    <div className="bg-violet-500/10 rounded-2xl rounded-bl-sm px-4 py-3 text-sm border border-violet-500/20">
                      {t('landing.chatExample2')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 lg:px-12 bg-muted/20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            {t('landing.ctaTitle')}
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
            {t('landing.ctaDescription')}
          </p>
          <Link to="/signup">
            <Button size="lg" className="h-14 px-10 text-base bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-violet-500/20 border-0 group">
              {t('landing.getStartedFree')}
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 lg:px-12 border-t border-border/50">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-violet-500 flex items-center justify-center">
                <span className="text-base font-bold text-white">L</span>
              </div>
              <span className="text-lg font-semibold">Lil PM</span>
            </Link>

            <div className="flex items-center gap-8 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">{t('landing.terms')}</a>
              <a href="#" className="hover:text-foreground transition-colors">{t('landing.privacy')}</a>
              <a href="#" className="hover:text-foreground transition-colors">{t('landing.contact')}</a>
            </div>

            <p className="text-sm text-muted-foreground">
              © 2025 Lil PM. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Feature Card - Single violet accent color
function FeatureCard({ icon, title, description }: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group rounded-xl border border-border/50 bg-card/50 p-5 hover:border-violet-500/30 hover:bg-card/80 transition-all duration-200 cursor-default">
      <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-500 group-hover:bg-violet-500 group-hover:text-white transition-colors mb-4">
        {icon}
      </div>
      <h3 className="text-base font-semibold mb-1.5">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
  );
}
