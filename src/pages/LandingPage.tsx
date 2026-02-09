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
  Timer,
} from 'lucide-react';

export function LandingPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 -left-40 w-80 h-80 bg-violet-500/20 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-blue-500/15 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-purple-500/15 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Navigation - Floating Glassmorphism */}
      <nav className="fixed top-4 left-4 right-4 z-50">
        <div className="max-w-6xl mx-auto">
          <div className="bg-background/60 backdrop-blur-xl border border-border/50 rounded-2xl shadow-lg shadow-black/5">
            <div className="px-6 h-16 flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2.5 group">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30 group-hover:shadow-violet-500/50 transition-shadow">
                  <span className="text-lg font-bold text-white">L</span>
                </div>
                <span className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Lil PM</span>
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
                  <Button size="sm" className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-violet-500/25 border-0">
                    {t('landing.getStartedFree')}
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-36 pb-16 px-6">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-500 text-sm mb-8 backdrop-blur-sm">
            <Sparkles className="h-4 w-4" />
            <span className="font-medium">{t('landing.aiPowered')}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
            <span className="bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
              {t('landing.heroTitle1')}
            </span>
            <br />
            <span className="bg-gradient-to-r from-violet-500 via-purple-500 to-violet-600 bg-clip-text text-transparent">
              {t('landing.heroTitle2')}
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            {t('landing.heroDescription')}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link to="/signup">
              <Button size="lg" className="h-14 px-8 text-base bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 shadow-xl shadow-violet-500/30 border-0 group">
                {t('landing.getStartedFree')}
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
            <a href="#demo">
              <Button variant="outline" size="lg" className="h-14 px-8 text-base border-border/50 bg-background/50 backdrop-blur-sm hover:bg-muted/50">
                {t('landing.watchDemo')}
              </Button>
            </a>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            {[
              { icon: CheckCircle2, text: t('landing.freeToStart') },
              { icon: CheckCircle2, text: t('landing.noCardRequired') },
              { icon: CheckCircle2, text: t('landing.proTrial') },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/30 backdrop-blur-sm border border-border/30">
                <item.icon className="h-4 w-4 text-emerald-500" />
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product Demo Showcase */}
      <section className="px-6 pb-20" id="demo">
        <div className="max-w-5xl mx-auto">
          <ProductDemoShowcase />

          {/* Stats Grid */}
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { value: '2 min', label: 'PRD Generation', icon: FileText },
              { value: '100%', label: 'Auto Ticket Creation', icon: Kanban },
              { value: 'AI', label: 'ChatGPT, Claude, Gemini', icon: Bot },
              { value: 'Free', label: 'Start Now', icon: Zap },
            ].map((stat, i) => (
              <div key={i} className="text-center p-5 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-violet-500/30 transition-colors group cursor-default">
                <stat.icon className="h-5 w-5 mx-auto mb-2 text-violet-500 group-hover:scale-110 transition-transform" />
                <div className="text-2xl font-bold bg-gradient-to-r from-violet-500 to-purple-600 bg-clip-text text-transparent">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-muted/30 to-transparent" />
        <div className="max-w-6xl mx-auto relative">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 text-violet-500 text-xs font-medium mb-4">
              <Zap className="h-3.5 w-3.5" />
              Features
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                {t('landing.featuresTitle')}
              </span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('landing.featuresDescription')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            <FeatureCard
              icon={<Zap className="h-6 w-6" />}
              title={t('landing.feature1Title')}
              description={t('landing.feature1Desc')}
              gradient="from-amber-500 to-orange-500"
            />
            <FeatureCard
              icon={<GitBranch className="h-6 w-6" />}
              title={t('landing.feature2Title')}
              description={t('landing.feature2Desc')}
              gradient="from-blue-500 to-cyan-500"
            />
            <FeatureCard
              icon={<BarChart3 className="h-6 w-6" />}
              title={t('landing.feature3Title')}
              description={t('landing.feature3Desc')}
              gradient="from-emerald-500 to-green-500"
            />
            <FeatureCard
              icon={<Users className="h-6 w-6" />}
              title={t('landing.feature4Title')}
              description={t('landing.feature4Desc')}
              gradient="from-pink-500 to-rose-500"
            />
            <FeatureCard
              icon={<Sparkles className="h-6 w-6" />}
              title={t('landing.feature5Title')}
              description={t('landing.feature5Desc')}
              gradient="from-violet-500 to-purple-500"
            />
            <FeatureCard
              icon={<ArrowUpRight className="h-6 w-6" />}
              title={t('landing.feature6Title')}
              description={t('landing.feature6Desc')}
              gradient="from-indigo-500 to-blue-500"
            />
          </div>
        </div>
      </section>

      {/* AI Section */}
      <section id="ai" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 text-violet-500 text-xs font-medium mb-6">
                <Bot className="h-3.5 w-3.5" />
                Lil PM AI
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
                <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {t('landing.aiTitle1')}
                </span>
                <br />
                <span className="bg-gradient-to-r from-violet-500 to-purple-600 bg-clip-text text-transparent">
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
                  <li key={i} className="flex items-center gap-3 group">
                    <div className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/40 transition-shadow">
                      <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-foreground/80">{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative">
              {/* Glow effect */}
              <div className="absolute -inset-4 bg-gradient-to-r from-violet-500/20 to-purple-500/20 rounded-3xl blur-2xl" />

              <div className="relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl p-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/50">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
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
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex-shrink-0 flex items-center justify-center text-xs text-white font-medium">JD</div>
                    <div className="bg-muted/50 backdrop-blur-sm rounded-2xl rounded-bl-sm px-4 py-3 text-sm">
                      {t('landing.chatExample1')}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex-shrink-0 flex items-center justify-center shadow-md">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    <div className="bg-violet-500/10 backdrop-blur-sm rounded-2xl rounded-bl-sm px-4 py-3 text-sm border border-violet-500/20">
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
      <section className="py-24 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-500/5 to-transparent" />
        <div className="max-w-4xl mx-auto text-center relative">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              {t('landing.ctaTitle')}
            </span>
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
            {t('landing.ctaDescription')}
          </p>
          <Link to="/signup">
            <Button size="lg" className="h-14 px-10 text-base bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 shadow-xl shadow-violet-500/30 border-0 group">
              {t('landing.getStartedFree')}
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border/50">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
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

function FeatureCard({ icon, title, description, gradient }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <div className="group rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 hover:border-violet-500/30 hover:bg-card/80 transition-all duration-300 cursor-default">
      <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg group-hover:scale-105 transition-transform mb-5`}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
  );
}
