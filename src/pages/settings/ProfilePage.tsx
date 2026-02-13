import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Camera, User, Lock, Mail, Save, Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/authStore';
import { useTeamStore } from '@/stores/teamStore';
import { useIssueStore } from '@/stores';
import { activityService } from '@/lib/services';
import { apiClient } from '@/lib/api/client';
import { ProfileStats, ProfileActivityChart, ProfileActivityHistory } from '@/components/profile';
import type { Issue } from '@/types';
import type { ActivityWithUser } from '@/types/database';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(6, 'Password must be at least 6 characters'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Password must be at least 6 characters'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export function ProfilePage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user, updateUser } = useAuthStore();
  const { currentTeam } = useTeamStore();
  const { issues, loadIssues } = useIssueStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [activities, setActivities] = useState<ActivityWithUser[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);

  // Issues are already in the correct format from the store
  const mappedIssues = issues;

  const loadActivities = useCallback(async () => {
    if (!issues.length) return;
    
    setIsLoadingActivities(true);
    try {
      const activitiesPromises = issues.slice(0, 20).map(issue => 
        activityService.getActivities(issue.id)
      );
      const allActivitiesData = await Promise.all(activitiesPromises);
      const flatActivities = allActivitiesData
        .flat()
        .filter(a => a.user_id === user?.id)
        .sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      setActivities(flatActivities);
    } catch (error) {
      console.error('Failed to load activities:', error);
    } finally {
      setIsLoadingActivities(false);
    }
  }, [issues, user?.id]);

  useEffect(() => {
    if (currentTeam) {
      loadIssues(currentTeam.id);
    }
  }, [currentTeam, loadIssues]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: t('profile.invalidFileType'),
        description: t('profile.selectImage'),
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t('profile.fileTooLarge'),
        description: t('profile.maxSize'),
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingAvatar(true);

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', file);

      // Use fetchRaw to bypass JSON stringification for FormData
      const response = await apiClient.fetchRaw('/upload/avatar', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const { avatarUrl } = await response.json();

      // Update user profile with new avatar URL
      const res = await apiClient.put('/auth/me', { avatarUrl });
      if (res.error) throw new Error(res.error);

      updateUser({ avatarUrl });

      toast({
        title: t('profile.avatarUpdated'),
        description: t('profile.avatarUpdatedDesc'),
      });
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast({
        title: t('common.error'),
        description: t('profile.avatarError'),
        variant: 'destructive',
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const onProfileSubmit = async (data: ProfileFormData) => {
    setIsUpdatingProfile(true);

    try {
      const res = await apiClient.put('/auth/me', {
        name: data.name,
        email: data.email,
      });

      if (res.error) throw new Error(res.error);

      updateUser({ name: data.name, email: data.email });

      toast({
        title: t('profile.profileUpdated'),
        description: t('profile.profileUpdatedDesc'),
      });
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('profile.updateError'),
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const onPasswordSubmit = async (data: PasswordFormData) => {
    setIsUpdatingPassword(true);

    try {
      const res = await apiClient.post('/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });

      if (res.error) throw new Error(res.error);

      passwordForm.reset();

      toast({
        title: t('profile.passwordUpdated'),
        description: t('profile.passwordUpdatedDesc'),
      });
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('profile.passwordError'),
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <AppLayout>
      <div className="container max-w-5xl px-4 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t('profile.title')}</h1>
          <p className="text-sm text-slate-400">{t('profile.description')}</p>
        </div>

        {/* Stats Overview */}
        <ProfileStats issues={mappedIssues} userId={user?.id} />

        {/* Activity Chart - Hidden on mobile for performance */}
        <div className="hidden sm:block">
          <ProfileActivityChart issues={mappedIssues} userId={user?.id} />
        </div>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          {/* Left Column - Profile Settings */}
          <div className="space-y-6">
            {/* Avatar Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {t('profile.avatar')}
                </CardTitle>
                <CardDescription>{t('profile.avatarDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                  <div className="relative group">
                    <Avatar className="h-20 w-20 sm:h-24 sm:w-24 cursor-pointer" onClick={handleAvatarClick}>
                      <AvatarImage src={user?.avatarUrl} alt={user?.name} />
                      <AvatarFallback className="text-xl sm:text-2xl">
                        {user?.name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div 
                      className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      onClick={handleAvatarClick}
                    >
                      {isUploadingAvatar ? (
                        <Loader2 className="h-6 w-6 text-white animate-spin" />
                      ) : (
                        <Camera className="h-6 w-6 text-white" />
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </div>
                  <div className="space-y-1 text-center sm:text-left">
                    <p className="text-sm font-medium">{t('profile.uploadAvatar')}</p>
                    <p className="text-xs text-slate-400">{t('profile.avatarRequirements')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Profile Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  {t('profile.personalInfo')}
                </CardTitle>
                <CardDescription>{t('profile.personalInfoDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                    <FormField
                      control={profileForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('auth.name')}</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('auth.email')}</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={isUpdatingProfile}>
                      {isUpdatingProfile ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t('common.loading')}
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          {t('common.save')}
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Password Change */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  {t('profile.changePassword')}
                </CardTitle>
                <CardDescription>{t('profile.changePasswordDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                    <FormField
                      control={passwordForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('profile.currentPassword')}</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('profile.newPassword')}</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={passwordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('profile.confirmPassword')}</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={isUpdatingPassword}>
                      {isUpdatingPassword ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t('common.loading')}
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4" />
                          {t('profile.updatePassword')}
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Activity */}
          <div>
            <ProfileActivityHistory 
              activities={activities} 
              isLoading={isLoadingActivities} 
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
