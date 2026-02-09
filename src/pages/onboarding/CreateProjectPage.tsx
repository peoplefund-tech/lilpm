import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, FolderKanban, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { useTeamStore } from '@/stores/teamStore';
import { toast } from 'sonner';

const projectSchema = z.object({
  name: z.string().min(2, 'Project name must be at least 2 characters'),
  description: z.string().optional(),
});

type ProjectForm = z.infer<typeof projectSchema>;

const PROJECT_ICONS = ['📦', '🚀', '💡', '🎯', '⚡', '🔧', '📱', '🌐', '🎨', '📊'];
const PROJECT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'
];

export function CreateProjectPage() {
  const navigate = useNavigate();
  const { createProject, currentTeam } = useTeamStore();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState('📦');
  const [selectedColor, setSelectedColor] = useState('#6366f1');

  const form = useForm<ProjectForm>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const onSubmit = async (data: ProjectForm) => {
    if (!currentTeam) {
      toast.error('Please create a team first');
      navigate('/onboarding/create-team');
      return;
    }

    setIsLoading(true);
    try {
      await createProject({
        name: data.name,
        description: data.description,
        icon: selectedIcon,
        color: selectedColor,
        status: 'in_progress',
      });
      toast.success('Project created successfully!');
      // Navigate to AI setup
      navigate('/onboarding/ai-setup');
    } catch (error) {
      console.error('Failed to create project:', error);
      toast.error('Failed to create project. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d0f] px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-medium">✓</div>
            <span className="text-sm text-slate-400">Team</span>
          </div>
          <div className="w-8 h-px bg-emerald-500" />
          <div className="flex items-center gap-1">
            <div className="w-8 h-8 rounded-full bg-violet-500 text-white flex items-center justify-center text-sm font-medium">2</div>
            <span className="text-sm font-medium text-white">Project</span>
          </div>
          <div className="w-8 h-px bg-white/10" />
          <div className="flex items-center gap-1">
            <div className="w-8 h-8 rounded-full bg-[#1a1a1f] text-slate-500 flex items-center justify-center text-sm border border-white/10">3</div>
            <span className="text-sm text-slate-500">AI Setup</span>
          </div>
        </div>

        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 mb-6">
            <FolderKanban className="h-8 w-8 text-violet-400" />
          </div>
          <h1 className="text-2xl font-semibold text-white">Create your first project</h1>
          <p className="text-slate-400 mt-2">
            Projects help you organize and track your work
          </p>
        </div>

        {/* Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Icon & Color Selection */}
            <div className="space-y-3">
              <FormLabel>Project icon & color</FormLabel>
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
                  style={{ backgroundColor: selectedColor + '20' }}
                >
                  {selectedIcon}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {PROJECT_ICONS.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setSelectedIcon(icon)}
                        className={`w-8 h-8 rounded-md flex items-center justify-center text-lg hover:bg-accent transition-colors ${selectedIcon === icon ? 'bg-accent ring-2 ring-primary' : ''
                          }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {PROJECT_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className={`w-6 h-6 rounded-full transition-transform ${selectedColor === color ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110' : ''
                          }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="My Awesome Project"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What's this project about?"
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/onboarding/create-team')}
                className="flex-1"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>

        {/* Skip for now */}
        <div className="text-center">
          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => navigate('/onboarding/ai-setup')}
          >
            Skip for now
          </Button>
        </div>
      </div>
    </div>
  );
}
