import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  FileText,
  FolderKanban,
  Users,
  Clock,
  Star,
  Trash2,
  Filter,
  Plus,
} from 'lucide-react';
import { useTeamStore } from '@/stores/teamStore';
import { issueService } from '@/lib/services/issueService';
import { projectService } from '@/lib/services/projectService';
import type { IssueWithRelations } from '@/types/database';
import type { Project } from '@/types/database';

interface SearchResult {
  id: string;
  type: 'issue' | 'project' | 'member' | 'action';
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  status?: string;
  priority?: string;
}

interface SavedFilter {
  id: string;
  name: string;
  query: string;
  filters: Record<string, any>;
  createdAt: string;
}

const SEARCH_HISTORY_KEY = 'lily-search-history';
const SAVED_FILTERS_KEY = 'lily-saved-filters';
const MAX_HISTORY = 10;

export function GlobalSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentTeam } = useTeamStore();
  
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);

  // Load history and saved filters from localStorage
  useEffect(() => {
    const history = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (history) {
      setSearchHistory(JSON.parse(history));
    }
    
    const filters = localStorage.getItem(SAVED_FILTERS_KEY);
    if (filters) {
      setSavedFilters(JSON.parse(filters));
    }
  }, []);

  // Listen for keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || !currentTeam) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const searchResults: SearchResult[] = [];
      const searchQuery = query.toLowerCase();
      
      // Search issues - run independently
      try {
        const issues = await issueService.getIssues(currentTeam.id, { search: query });
        issues.slice(0, 5).forEach((issue: IssueWithRelations) => {
          searchResults.push({
            id: issue.id,
            type: 'issue',
            title: issue.title,
            subtitle: issue.identifier,
            status: issue.status,
            priority: issue.priority,
          });
        });
      } catch (error) {
        console.error('Issue search error:', error);
      }

      // Search projects - run independently
      try {
        const projects = await projectService.getProjects(currentTeam.id);
        projects
          .filter((p: Project) => 
            p.name.toLowerCase().includes(searchQuery) ||
            (p.description && p.description.toLowerCase().includes(searchQuery))
          )
          .slice(0, 3)
          .forEach((project: Project) => {
            searchResults.push({
              id: project.id,
              type: 'project',
              title: project.name,
              subtitle: project.description || undefined,
            });
          });
      } catch (error) {
        console.error('Project search error:', error);
      }

      // Search PRDs - run independently
      try {
        const { supabase } = await import('@/lib/supabase');
        const escapedQuery = query.replace(/[%_\\]/g, '\\$&');
        const { data: prds } = await supabase
          .from('prd_documents')
          .select('*')
          .eq('team_id', currentTeam.id)
          .or(`title.ilike.%${escapedQuery}%,overview.ilike.%${escapedQuery}%`)
          .limit(3);
        
        (prds || []).forEach((prd: any) => {
          searchResults.push({
            id: prd.id,
            type: 'project', // Use project type for PRD
            title: `📄 ${prd.title}`,
            subtitle: prd.overview?.slice(0, 50) || 'PRD Document',
          });
        });
      } catch (error) {
        console.error('PRD search error:', error);
      }

      setResults(searchResults);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, currentTeam]);

  const addToHistory = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    setSearchHistory((prev) => {
      const filtered = prev.filter((h) => h !== searchQuery);
      const newHistory = [searchQuery, ...filtered].slice(0, MAX_HISTORY);
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
      return newHistory;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  }, []);

  const saveFilter = useCallback((name: string) => {
    if (!query.trim()) return;
    
    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      name,
      query,
      filters: {},
      createdAt: new Date().toISOString(),
    };
    
    setSavedFilters((prev) => {
      const updated = [...prev, newFilter];
      localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, [query]);

  const deleteSavedFilter = useCallback((filterId: string) => {
    setSavedFilters((prev) => {
      const updated = prev.filter((f) => f.id !== filterId);
      localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleSelect = (result: SearchResult) => {
    addToHistory(query);
    setOpen(false);
    setQuery('');
    
    switch (result.type) {
      case 'issue':
        navigate(`/issue/${result.id}`);
        break;
      case 'project':
        // Check if it's a PRD (title starts with 📄)
        if (result.title.startsWith('📄')) {
          navigate(`/prd/${result.id}`);
        } else {
          navigate(`/project/${result.id}`);
        }
        break;
      case 'action':
        // Handle quick actions
        break;
    }
  };

  const handleHistorySelect = (historyQuery: string) => {
    setQuery(historyQuery);
  };

  const handleFilterSelect = (filter: SavedFilter) => {
    setQuery(filter.query);
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'done': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'in_review': return 'bg-purple-500';
      case 'todo': return 'bg-gray-400';
      default: return 'bg-gray-300';
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-500';
      case 'high': return 'text-orange-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-blue-500';
      default: return 'text-gray-400';
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-muted/50 hover:bg-muted rounded-md border border-border transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">{t('search.placeholder')}</span>
        <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
          placeholder={t('search.placeholder')}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {isSearching ? t('common.loading') : t('search.noResults')}
          </CommandEmpty>

          {/* Search Results */}
          {results.length > 0 && (
            <>
              <CommandGroup heading={t('search.results')}>
                {results.map((result) => (
                  <CommandItem
                    key={`${result.type}-${result.id}`}
                    onSelect={() => handleSelect(result)}
                    className="flex items-center gap-3"
                  >
                    {result.type === 'issue' && (
                      <>
                        <div className={`h-2 w-2 rounded-full ${getStatusColor(result.status)}`} />
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </>
                    )}
                    {result.type === 'project' && (
                      <FolderKanban className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{result.title}</p>
                      {result.subtitle && (
                        <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                      )}
                    </div>
                    {result.priority && (
                      <span className={`text-xs ${getPriorityColor(result.priority)}`}>
                        {t(`priority.${result.priority}`)}
                      </span>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {t(`search.type.${result.type}`)}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {/* Quick Actions - only show when no query */}
          {!query && (
            <>
              <CommandGroup heading={t('search.quickActions')}>
                <CommandItem onSelect={() => { setOpen(false); navigate('/issues'); }}>
                  <FileText className="h-4 w-4 mr-2" />
                  {t('nav.allIssues')}
                </CommandItem>
                <CommandItem onSelect={() => { setOpen(false); navigate('/projects'); }}>
                  <FolderKanban className="h-4 w-4 mr-2" />
                  {t('nav.projects')}
                </CommandItem>
                <CommandItem onSelect={() => { setOpen(false); navigate('/team/members'); }}>
                  <Users className="h-4 w-4 mr-2" />
                  {t('nav.teamMembers')}
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {/* Saved Filters */}
          {savedFilters.length > 0 && !query && (
            <>
              <CommandGroup heading={t('search.savedFilters')}>
                {savedFilters.map((filter) => (
                  <CommandItem
                    key={filter.id}
                    onSelect={() => handleFilterSelect(filter)}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span>{filter.name}</span>
                      <span className="text-xs text-muted-foreground">"{filter.query}"</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSavedFilter(filter.id);
                      }}
                      className="p-1 hover:bg-destructive/10 rounded"
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {/* Search History */}
          {searchHistory.length > 0 && !query && (
            <CommandGroup heading={t('search.recentSearches')}>
              {searchHistory.slice(0, 5).map((historyItem, index) => (
                <CommandItem
                  key={index}
                  onSelect={() => handleHistorySelect(historyItem)}
                >
                  <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                  {historyItem}
                </CommandItem>
              ))}
              {searchHistory.length > 0 && (
                <CommandItem
                  onSelect={clearHistory}
                  className="text-muted-foreground"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('search.clearHistory')}
                </CommandItem>
              )}
            </CommandGroup>
          )}

          {/* Save Current Filter */}
          {query && results.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    const name = prompt(t('search.filterName'));
                    if (name) {
                      saveFilter(name);
                    }
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('search.saveAsFilter')}
                </CommandItem>
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
