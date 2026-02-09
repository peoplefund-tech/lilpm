import React from 'react';
import {
  AlertTriangle,
  Ban,
  Link2,
  Copy,
  ArrowRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useIntegrationStore } from '@/stores/integrationStore';
import type { IssueRelationType } from '@/types/integrations';

interface Issue {
  id: string;
  identifier: string;
  title: string;
}

interface IssueRelationsProps {
  issueId: string;
  issues: Issue[];
  currentUserId: string;
}

const RELATION_LABELS: Record<IssueRelationType, { label: string; icon: React.ReactNode; color: string }> = {
  blocks: { 
    label: '차단함', 
    icon: <Ban className="h-3 w-3" />, 
    color: 'text-red-500' 
  },
  blocked_by: { 
    label: '차단됨', 
    icon: <AlertTriangle className="h-3 w-3" />, 
    color: 'text-orange-500' 
  },
  relates_to: { 
    label: '관련됨', 
    icon: <Link2 className="h-3 w-3" />, 
    color: 'text-blue-500' 
  },
  duplicates: { 
    label: '중복', 
    icon: <Copy className="h-3 w-3" />, 
    color: 'text-yellow-500' 
  },
  parent_of: { 
    label: '상위 이슈', 
    icon: <ArrowRight className="h-3 w-3 rotate-[-90deg]" />, 
    color: 'text-purple-500' 
  },
  child_of: { 
    label: '하위 이슈', 
    icon: <ArrowRight className="h-3 w-3 rotate-90" />, 
    color: 'text-purple-500' 
  },
};

export function IssueRelations({ issueId, issues, currentUserId }: IssueRelationsProps) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [selectedIssue, setSelectedIssue] = React.useState('');
  const [relationType, setRelationType] = React.useState<IssueRelationType>('relates_to');

  const { relations, addRelation, removeRelation, getRelationsForIssue } = useIntegrationStore();

  const issueRelations = getRelationsForIssue(issueId);

  const handleAddRelation = () => {
    if (!selectedIssue) return;
    
    addRelation(issueId, selectedIssue, relationType, currentUserId);
    setIsDialogOpen(false);
    setSelectedIssue('');
    setRelationType('relates_to');
  };

  const getRelatedIssue = (relation: typeof issueRelations[0]) => {
    const relatedId = relation.issue_id === issueId ? relation.related_issue_id : relation.issue_id;
    return issues.find(i => i.id === relatedId);
  };

  const getDisplayRelationType = (relation: typeof issueRelations[0]): IssueRelationType => {
    if (relation.issue_id === issueId) {
      return relation.relation_type;
    }
    // Flip the relation type for the other side
    switch (relation.relation_type) {
      case 'blocks': return 'blocked_by';
      case 'blocked_by': return 'blocks';
      case 'parent_of': return 'child_of';
      case 'child_of': return 'parent_of';
      default: return relation.relation_type;
    }
  };

  const availableIssues = issues.filter(i => 
    i.id !== issueId && 
    !issueRelations.some(r => 
      (r.issue_id === i.id || r.related_issue_id === i.id)
    )
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">이슈 관계</h4>
        <Button variant="ghost" size="sm" onClick={() => setIsDialogOpen(true)}>
          <Link2 className="h-4 w-4 mr-1" />
          추가
        </Button>
      </div>

      {issueRelations.length === 0 ? (
        <p className="text-sm text-muted-foreground">관계된 이슈가 없습니다</p>
      ) : (
        <div className="space-y-2">
          {issueRelations.map((relation) => {
            const relatedIssue = getRelatedIssue(relation);
            const displayType = getDisplayRelationType(relation);
            const typeInfo = RELATION_LABELS[displayType];
            
            if (!relatedIssue) return null;

            return (
              <div 
                key={relation.id} 
                className="flex items-center gap-2 p-2 bg-muted/50 rounded-md group"
              >
                <Badge variant="outline" className={`text-xs ${typeInfo.color}`}>
                  {typeInfo.icon}
                  <span className="ml-1">{typeInfo.label}</span>
                </Badge>
                <span className="text-sm font-mono text-muted-foreground">
                  {relatedIssue.identifier}
                </span>
                <span className="text-sm truncate flex-1">
                  {relatedIssue.title}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                  onClick={() => removeRelation(relation.id)}
                >
                  ×
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이슈 관계 추가</DialogTitle>
            <DialogDescription>
              다른 이슈와의 관계를 설정합니다
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">관계 유형</label>
              <Select value={relationType} onValueChange={(v) => setRelationType(v as IssueRelationType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RELATION_LABELS).map(([key, { label, icon }]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        {icon}
                        {label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">관련 이슈</label>
              <Select value={selectedIssue} onValueChange={setSelectedIssue}>
                <SelectTrigger>
                  <SelectValue placeholder="이슈 선택" />
                </SelectTrigger>
                <SelectContent>
                  {availableIssues.map((issue) => (
                    <SelectItem key={issue.id} value={issue.id}>
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-muted-foreground">{issue.identifier}</span>
                        <span className="truncate">{issue.title}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleAddRelation} disabled={!selectedIssue}>
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
