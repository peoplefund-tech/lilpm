import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import type { Issue, IssueStatus, IssuePriority, Project, Label, Profile, Cycle } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { StatusIcon, PriorityIcon, statusLabels, priorityLabels, allStatuses, allPriorities } from '@/features/issues/components/shared/IssueIcons';
import {
  Loader2,
  CalendarIcon,
  X,
  FolderKanban,
  User,
  Tag,
  Target,
  Check,
  Plus,
} from 'lucide-react';
import { useTeamStore } from '@/stores/teamStore';
import { projectService } from '@/lib/services';
import { teamMemberService } from '@/lib/services/teamService';
import { labelService } from '@/lib/services';
import { cycleService } from '@/lib/services/cycleService';
import { issueTemplateService, type IssueTemplate } from '@/lib/services';
import { cn } from '@/lib/utils';

const issueSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  status: z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'blocked', 'done', 'cancelled']),
  priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']),
  project_id: z.string().optional(),
  cycle_id: z.string().optional(),
  assignee_id: z.string().optional(),
  due_date: z.date().optional(),
  estimate: z.number().optional(),
  label_ids: z.array(z.string()).optional(),
});

type IssueFormData = z.infer<typeof issueSchema>;

interface CreateIssueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStatus?: IssueStatus;
  initialProjectId?: string;
  initialCycleId?: string;
  onSubmit: (data: Partial<Issue> & { label_ids?: string[] }) => Promise<void>;
}

export function CreateIssueModal({
  open,
  onOpenChange,
  initialStatus = 'backlog',
  initialProjectId,
  initialCycleId,
  onSubmit,
}: CreateIssueModalProps) {
  const { t } = useTranslation();
  const { currentTeam } = useTeamStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [labelPopoverOpen, setLabelPopoverOpen] = useState(false);
  const [templates, setTemplates] = useState<(IssueTemplate | ReturnType<typeof issueTemplateService.getBuiltInTemplates>[0])[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const form = useForm<IssueFormData>({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      title: '',
      description: '',
      status: initialStatus,
      priority: 'none',
      project_id: initialProjectId || undefined,
      cycle_id: initialCycleId || undefined,
      assignee_id: undefined,
      due_date: undefined,
      estimate: undefined,
      label_ids: [],
    },
  });

  const loadData = useCallback(async () => {
    if (!currentTeam?.id) return;

    try {
      const [projectsData, membersData, labelsData, cyclesData] = await Promise.all([
        projectService.getProjects(currentTeam.id),
        teamMemberService.getMembers(currentTeam.id),
        labelService.getLabels(currentTeam.id),
        cycleService.getCycles(currentTeam.id),
      ]);

      setProjects(projectsData);
      setMembers(membersData.map(m => m.profile));
      setLabels(labelsData);
      setCycles(cyclesData.filter(c => c.status !== 'completed'));

      // Load templates (use built-in as fallback)
      try {
        const teamTemplates = await issueTemplateService.getTemplates(currentTeam.id);
        if (teamTemplates.length > 0) {
          setTemplates(teamTemplates);
        } else {
          setTemplates(issueTemplateService.getBuiltInTemplates());
        }
      } catch {
        setTemplates(issueTemplateService.getBuiltInTemplates());
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  }, [currentTeam?.id]);

  useEffect(() => {
    if (open) {
      loadData();
      setSelectedLabels([]);
      form.reset({
        title: '',
        description: '',
        status: initialStatus,
        priority: 'none',
        project_id: initialProjectId || undefined,
        cycle_id: initialCycleId || undefined,
        assignee_id: undefined,
        due_date: undefined,
        estimate: undefined,
        label_ids: [],
      });
      setSelectedTemplateId(null);
    }
  }, [open, loadData, form, initialStatus, initialProjectId, initialCycleId]);

  const handleSubmit = async (data: IssueFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit({
        ...data,
        due_date: data.due_date ? format(data.due_date, 'yyyy-MM-dd') : undefined,
        label_ids: selectedLabels,
      });
      form.reset();
      setSelectedLabels([]);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create issue:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleLabel = (labelId: string) => {
    setSelectedLabels(prev =>
      prev.includes(labelId)
        ? prev.filter(id => id !== labelId)
        : [...prev, labelId]
    );
  };

  const removeLabel = (labelId: string) => {
    setSelectedLabels(prev => prev.filter(id => id !== labelId));
  };

  const getSelectedLabelsData = () => {
    return labels.filter(l => selectedLabels.includes(l.id));
  };

  const handleTemplateSelect = (templateIdOrName: string) => {
    const template = templates.find(t => ('id' in t ? t.id : t.name) === templateIdOrName);
    if (template) {
      setSelectedTemplateId(templateIdOrName);
      form.setValue('title', template.default_title || '');
      form.setValue('description', template.default_description || '');
      form.setValue('status', (template.default_status || 'backlog') as IssueStatus);
      form.setValue('priority', (template.default_priority || 'none') as IssuePriority);
      if (template.default_estimate) {
        form.setValue('estimate', template.default_estimate);
      }
      if (template.default_labels && template.default_labels.length > 0) {
        // Find matching labels by name
        const matchingLabels = labels.filter(l =>
          template.default_labels.some(tl => tl.toLowerCase() === l.name.toLowerCase())
        );
        setSelectedLabels(matchingLabels.map(l => l.id));
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('issues.newIssue')}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Template Selector */}
            {templates.length > 0 && (
              <div className="flex flex-wrap gap-2 pb-3 border-b">
                {templates.map((template) => {
                  const id = 'id' in template ? template.id : template.name;
                  const isSelected = selectedTemplateId === id;
                  return (
                    <Button
                      key={id}
                      type="button"
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => handleTemplateSelect(id)}
                    >
                      <span>{template.icon}</span>
                      <span>{template.name}</span>
                    </Button>
                  );
                })}
              </div>
            )}

            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('issues.issueTitle')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('issues.issueTitle')}
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('issues.description')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('issues.addDescription')}
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Status & Priority Row */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('issues.status')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {allStatuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            <div className="flex items-center gap-2">
                              <StatusIcon status={status} />
                              <span>{t(`status.${status}`)}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('issues.priority')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {allPriorities.map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            <div className="flex items-center gap-2">
                              <PriorityIcon priority={priority} />
                              <span>{t(`priority.${priority}`)}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Project & Cycle Row */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="project_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <FolderKanban className="h-3.5 w-3.5" />
                      {t('issues.project')}
                    </FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === "__none__" ? undefined : v)}
                      value={field.value || "__none__"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('issues.noProject')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">
                          <span className="text-muted-foreground">{t('issues.noProject')}</span>
                        </SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="h-3 w-3 rounded-sm"
                                style={{ backgroundColor: project.color }}
                              />
                              <span>{project.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cycle_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5" />
                      {t('issues.cycle')}
                    </FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === "__none__" ? undefined : v)}
                      value={field.value || "__none__"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('cycles.noCycles')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">
                          <span className="text-muted-foreground">{t('cycles.noCycles')}</span>
                        </SelectItem>
                        {cycles.map((cycle) => (
                          <SelectItem key={cycle.id} value={cycle.id}>
                            <div className="flex items-center gap-2">
                              {cycle.status === 'active' && (
                                <div className="h-2 w-2 rounded-full bg-green-500" />
                              )}
                              <span>{cycle.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Assignee & Due Date Row */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="assignee_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" />
                      {t('issues.assignee')}
                    </FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === "__none__" ? undefined : v)}
                      value={field.value || "__none__"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('issues.unassigned')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">
                          <span className="text-muted-foreground">{t('issues.unassigned')}</span>
                        </SelectItem>
                        {members.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-5 w-5">
                                <AvatarImage src={member.avatar_url || undefined} />
                                <AvatarFallback className="text-xs">
                                  {member.name?.charAt(0) || member.email.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <span>{member.name || member.email}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {t('issues.dueDate')}
                    </FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>{t('issues.dueDate')}</span>
                            )}
                            {field.value && (
                              <X
                                className="ml-auto h-4 w-4 hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  field.onChange(undefined);
                                }}
                              />
                            )}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Estimate */}
            <FormField
              control={form.control}
              name="estimate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('issues.estimate')}</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === "__none__" ? undefined : parseInt(v))}
                    value={field.value?.toString() || "__none__"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('issues.noEstimate')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">
                        <span className="text-muted-foreground">{t('issues.noEstimate')}</span>
                      </SelectItem>
                      {[1, 2, 3, 5, 8, 13, 21].map((points) => (
                        <SelectItem key={points} value={points.toString()}>
                          {points} {t('issues.points')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Labels */}
            <div className="space-y-2">
              <FormLabel className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                {t('issues.labels')}
              </FormLabel>

              {/* Selected Labels */}
              {selectedLabels.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {getSelectedLabelsData().map((label) => (
                    <Badge
                      key={label.id}
                      variant="secondary"
                      className="gap-1"
                      style={{
                        backgroundColor: `${label.color}20`,
                        borderColor: label.color,
                        color: label.color,
                      }}
                    >
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: label.color }}
                      />
                      {label.name}
                      <X
                        className="h-3 w-3 cursor-pointer hover:opacity-70"
                        onClick={() => removeLabel(label.id)}
                      />
                    </Badge>
                  ))}
                </div>
              )}

              {/* Label Selector */}
              <Popover open={labelPopoverOpen} onOpenChange={setLabelPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 border-dashed"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    {t('issues.addLabel')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder={t('common.search')} />
                    <CommandList>
                      <CommandEmpty>{t('issues.noLabelsFound')}</CommandEmpty>
                      <CommandGroup>
                        {labels.map((label) => {
                          const isSelected = selectedLabels.includes(label.id);
                          return (
                            <CommandItem
                              key={label.id}
                              onSelect={() => toggleLabel(label.id)}
                              className="flex items-center gap-2"
                            >
                              <div
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: label.color }}
                              />
                              <span className="flex-1">{label.name}</span>
                              {isSelected && <Check className="h-4 w-4" />}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('common.loading')}
                  </>
                ) : (
                  t('issues.createIssue')
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
