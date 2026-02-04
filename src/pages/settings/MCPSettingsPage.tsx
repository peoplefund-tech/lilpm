import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  Plus,
  Settings2,
  Plug,
  Search,
  Check,
  X,
  ExternalLink,
  Globe,
  Mail,
  FolderOpen,
  Calendar,
  FileText,
  Code,
  Palette,
  BarChart3,
  Megaphone,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppLayout } from '@/components/layout';
import { useMCPStore } from '@/stores/mcpStore';
import { toast } from 'sonner';
import type { MCPConnector, MCPCategory } from '@/types/mcp';

const CATEGORY_ICONS: Record<MCPCategory, React.ReactNode> = {
  search: <Globe className="h-4 w-4" />,
  communication: <MessageSquare className="h-4 w-4" />,
  productivity: <FileText className="h-4 w-4" />,
  development: <Code className="h-4 w-4" />,
  analytics: <BarChart3 className="h-4 w-4" />,
  marketing: <Megaphone className="h-4 w-4" />,
  design: <Palette className="h-4 w-4" />,
};

const CATEGORY_LABELS: Record<MCPCategory, string> = {
  search: 'Search',
  communication: 'Communication',
  productivity: 'Productivity',
  development: 'Development',
  analytics: 'Analytics',
  marketing: 'Marketing',
  design: 'Design',
};

export function MCPSettingsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MCPCategory | 'all'>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingConnector, setEditingConnector] = useState<MCPConnector | null>(null);
  
  const { 
    connectors, 
    toggleConnector, 
    addConnector,
    updateConnector,
    removeConnector,
    initializePresetConnectors 
  } = useMCPStore();

  // Initialize preset connectors on mount
  useEffect(() => {
    initializePresetConnectors();
  }, [initializePresetConnectors]);

  // New connector form state
  const [newConnector, setNewConnector] = useState({
    name: '',
    description: '',
    icon: '🔌',
    category: 'productivity' as MCPCategory,
    configType: 'manual' as const,
    apiEndpoint: '',
    apiKey: '',
  });
  
  // JSON config state
  const [jsonConfig, setJsonConfig] = useState('');
  const [addMode, setAddMode] = useState<'manual' | 'json'>('manual');

  const filteredConnectors = connectors.filter((connector) => {
    const matchesSearch = connector.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         connector.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || connector.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleToggle = (id: string, name: string, enabled: boolean) => {
    toggleConnector(id);
    toast.success(enabled ? `${name} disconnected` : `${name} connected`);
  };

  const handleAddConnector = () => {
    if (addMode === 'json') {
      // Parse JSON config
      try {
        const config = JSON.parse(jsonConfig);
        if (config.mcpServers) {
          // Parse MCP server config format
          Object.entries(config.mcpServers).forEach(([name, serverConfig]: [string, any]) => {
            const endpoint = serverConfig.args?.find((arg: string) => arg.startsWith('http'));
            const authHeader = serverConfig.args?.find((arg: string, i: number, arr: string[]) => 
              arr[i - 1] === '--header' && arg.startsWith('Authorization')
            );
            const apiKey = authHeader?.replace('Authorization: Bearer ', '') || '';
            
            addConnector({
              name,
              description: `Custom MCP: ${serverConfig.command} ${(serverConfig.args || []).slice(0, 2).join(' ')}`,
              icon: '🔌',
              category: 'development',
              configType: 'manual',
              apiEndpoint: endpoint || '',
              apiKey,
              mcpConfig: serverConfig,
              enabled: false,
            });
          });
          toast.success('MCP servers added from JSON config');
        } else {
          toast.error('Invalid JSON format. Expected mcpServers object.');
          return;
        }
      } catch (e) {
        toast.error('Invalid JSON format');
        return;
      }
      setJsonConfig('');
    } else {
      if (!newConnector.name.trim()) {
        toast.error('Please enter a connector name');
        return;
      }
      
      addConnector({
        ...newConnector,
        enabled: false,
      });
      toast.success('New connector added');
    }
    
    setIsAddDialogOpen(false);
    setNewConnector({
      name: '',
      description: '',
      icon: '🔌',
      category: 'productivity',
      configType: 'manual',
      apiEndpoint: '',
      apiKey: '',
    });
    setAddMode('manual');
  };

  const handleSaveEdit = () => {
    if (!editingConnector) return;
    
    updateConnector(editingConnector.id, editingConnector);
    toast.success('Connector updated');
    setEditingConnector(null);
  };

  const handleDelete = (id: string, name: string) => {
    removeConnector(id);
    toast.success(`${name} deleted`);
  };

  const enabledCount = connectors.filter((c) => c.enabled).length;

  return (
    <AppLayout>
      <div className="w-full p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-semibold flex items-center gap-2">
              <Plug className="h-5 w-5 md:h-6 md:w-6" />
              MCP Connection Management
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage external service connections for Lil PM AI
            </p>
          </div>
          <Badge variant="secondary" className="self-start sm:self-auto">
            {enabledCount} enabled
          </Badge>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search connectors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as MCPCategory | 'all')}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  <span className="flex items-center gap-2">
                    {CATEGORY_ICONS[key as MCPCategory]}
                    {label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Add Connector
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New MCP Connector</DialogTitle>
                <DialogDescription>
                  Add a new MCP connector manually or paste JSON configuration
                </DialogDescription>
              </DialogHeader>
              
              <Tabs value={addMode} onValueChange={(v) => setAddMode(v as 'manual' | 'json')} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="manual">Manual</TabsTrigger>
                  <TabsTrigger value="json">JSON Config</TabsTrigger>
                </TabsList>
                
                <TabsContent value="manual" className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      placeholder="Connector name"
                      value={newConnector.name}
                      onChange={(e) => setNewConnector({ ...newConnector, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      placeholder="Connector description"
                      value={newConnector.description}
                      onChange={(e) => setNewConnector({ ...newConnector, description: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Icon (emoji)</Label>
                    <Input
                      placeholder="🔌"
                      value={newConnector.icon}
                      onChange={(e) => setNewConnector({ ...newConnector, icon: e.target.value })}
                      className="w-20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={newConnector.category}
                      onValueChange={(v) => setNewConnector({ ...newConnector, category: v as MCPCategory })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>API Endpoint (optional)</Label>
                    <Input
                      placeholder="https://api.example.com/mcp"
                      value={newConnector.apiEndpoint}
                      onChange={(e) => setNewConnector({ ...newConnector, apiEndpoint: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>API Key (optional)</Label>
                    <Input
                      type="password"
                      placeholder="sk-..."
                      value={newConnector.apiKey}
                      onChange={(e) => setNewConnector({ ...newConnector, apiKey: e.target.value })}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="json" className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>MCP Configuration (JSON)</Label>
                    <textarea
                      className="w-full h-48 p-3 font-mono text-xs bg-muted rounded-md border resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder={`{
  "mcpServers": {
    "lily-workspace": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://example.com/mcp/sse",
        "--header",
        "Authorization: Bearer YOUR_TOKEN"
      ]
    }
  }
}`}
                      value={jsonConfig}
                      onChange={(e) => setJsonConfig(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Paste your MCP server configuration in JSON format. 
                      The mcpServers object will be parsed to create connectors.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddConnector}>
                  Add
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Connectors Grid */}
        <Tabs defaultValue="grid" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="grid">Grid</TabsTrigger>
            <TabsTrigger value="list">List</TabsTrigger>
          </TabsList>
          
          <TabsContent value="grid">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredConnectors.map((connector) => (
                <Card 
                  key={connector.id} 
                  className={`relative transition-all ${connector.enabled ? 'ring-2 ring-primary/50' : ''}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{connector.icon}</span>
                        <div>
                          <CardTitle className="text-base">{connector.name}</CardTitle>
                          <Badge variant="outline" className="mt-1 text-xs">
                            {CATEGORY_LABELS[connector.category]}
                          </Badge>
                        </div>
                      </div>
                      <Switch
                        checked={connector.enabled}
                        onCheckedChange={() => handleToggle(connector.id, connector.name, connector.enabled)}
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-xs line-clamp-2">
                      {connector.description}
                    </CardDescription>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge variant={connector.configType === 'automatic' ? 'default' : 'secondary'} className="text-xs">
                        {connector.configType === 'automatic' ? 'Auto Connect' : 'Manual Setup'}
                      </Badge>
                      {connector.configType === 'manual' && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs"
                          onClick={() => setEditingConnector(connector)}
                        >
                          <Settings2 className="h-3 w-3 mr-1" />
                          Configure
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="list">
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {filteredConnectors.map((connector) => (
                    <div 
                      key={connector.id} 
                      className="flex items-center justify-between p-4 hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{connector.icon}</span>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {connector.name}
                            <Badge variant="outline" className="text-xs">
                              {CATEGORY_LABELS[connector.category]}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{connector.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {connector.configType === 'manual' && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setEditingConnector(connector)}
                          >
                            <Settings2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Switch
                          checked={connector.enabled}
                          onCheckedChange={() => handleToggle(connector.id, connector.name, connector.enabled)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Empty state */}
        {filteredConnectors.length === 0 && (
          <div className="text-center py-12">
            <Plug className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No connectors found</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Try a different search or add a new connector
            </p>
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editingConnector} onOpenChange={() => setEditingConnector(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Connector Settings</DialogTitle>
              <DialogDescription>
                Configure {editingConnector?.name} connector
              </DialogDescription>
            </DialogHeader>
            {editingConnector && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={editingConnector.name}
                    onChange={(e) => setEditingConnector({ ...editingConnector, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>API Endpoint</Label>
                  <Input
                    placeholder="https://api.example.com/mcp"
                    value={editingConnector.apiEndpoint || ''}
                    onChange={(e) => setEditingConnector({ ...editingConnector, apiEndpoint: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    placeholder="sk-..."
                    value={editingConnector.apiKey || ''}
                    onChange={(e) => setEditingConnector({ ...editingConnector, apiKey: e.target.value })}
                  />
                </div>
              </div>
            )}
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button 
                variant="destructive" 
                className="w-full sm:w-auto"
                onClick={() => {
                  if (editingConnector) {
                    handleDelete(editingConnector.id, editingConnector.name);
                    setEditingConnector(null);
                  }
                }}
              >
                Delete
              </Button>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" onClick={() => setEditingConnector(null)} className="flex-1 sm:flex-initial">
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit} className="flex-1 sm:flex-initial">
                  Save
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
