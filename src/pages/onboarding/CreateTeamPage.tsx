import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Users, ArrowRight, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';

const teamSchema = z.object({
  name: z.string().min(2, 'Team name must be at least 2 characters'),
  slug: z.string()
    .min(2, 'URL must be at least 2 characters')
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens allowed'),
  issuePrefix: z.string()
    .min(2, 'Prefix must be at least 2 characters')
    .max(5, 'Prefix can be at most 5 characters')
    .regex(/^[A-Z]+$/, 'Only uppercase letters allowed'),
});

type TeamForm = z.infer<typeof teamSchema>;

export function CreateTeamPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<TeamForm>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: '',
      slug: '',
      issuePrefix: '',
    },
  });

  // Auto-generate slug from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    form.setValue('name', name);

    // Generate slug
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    form.setValue('slug', slug);

    // Generate issue prefix (first 3 letters uppercase)
    const prefix = name
      .replace(/[^a-zA-Z]/g, '')
      .substring(0, 3)
      .toUpperCase();

    if (prefix.length >= 2) {
      form.setValue('issuePrefix', prefix);
    }
  };

  const { createTeam } = useTeamStore();

  const onSubmit = async (data: TeamForm) => {
    if (!user) {
      toast.error('Please log in first.');
      navigate('/login');
      return;
    }

    setIsLoading(true);
    try {
      // Use teamStore.createTeam which updates the store and sets currentTeam
      await createTeam(data.name, data.slug, data.issuePrefix);
      toast.success('Team created successfully!');
      // Navigate to project creation
      navigate('/onboarding/create-project');
    } catch (error: any) {
      console.error('Failed to create team:', error);
      const message = error?.message || '';
      const errorCode = error?.code || '';

      if (message.includes('verify your email')) {
        toast.error('Please check your email and verify your account first.');
      } else if (message.includes('unique constraint') || message.includes('duplicate') || errorCode === '23505') {
        toast.error('A team with this name or URL already exists. Please choose a different team name.');
      } else if (message.includes('slug')) {
        toast.error('This team URL is already taken. Please choose a different URL.');
      } else {
        toast.error(message || 'Failed to create team. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">1</div>
            <span className="text-sm font-medium">Team</span>
          </div>
          <div className="w-8 h-px bg-border" />
          <div className="flex items-center gap-1">
            <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm">2</div>
            <span className="text-sm text-muted-foreground">Project</span>
          </div>
          <div className="w-8 h-px bg-border" />
          <div className="flex items-center gap-1">
            <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm">3</div>
            <span className="text-sm text-muted-foreground">AI Setup</span>
          </div>
        </div>

        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-6">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold">Create your team</h1>
          <p className="text-muted-foreground mt-2">
            Set up a workspace to manage your projects and issues
          </p>
        </div>

        {/* Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Acme Inc."
                      {...field}
                      onChange={handleNameChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team URL</FormLabel>
                  <FormControl>
                    <div className="flex items-center">
                      <span className="text-sm text-muted-foreground mr-2">
                        lilpm.app/
                      </span>
                      <Input
                        placeholder="acme"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Your team's unique URL. Can be changed later.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="issuePrefix"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Issue prefix</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="ACM"
                      maxLength={5}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Used for issue IDs (e.g., ACM-123)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isLoading}>
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
          </form>
        </Form>
      </div>
    </div>
  );
}

