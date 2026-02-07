# Database Schema Guidelines

## ⚠️ CRITICAL: Foreign Key Constraints for User References

### The Problem
Supabase deletes users from `auth.users` table directly. If any table has a foreign key pointing to `auth.users` without proper cascade rules, user deletion will FAIL with "Database error deleting user".

### The Solution: ALWAYS use CASCADE or SET NULL

When creating tables with user references, **ALWAYS** include the appropriate delete rule:

```sql
-- If the record should be DELETED when user is deleted:
user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE

-- If the record should REMAIN but lose the user reference:
created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
```

### When to use CASCADE vs SET NULL

| Column Type | Action | Example |
|-------------|--------|---------|
| `user_id` (ownership) | CASCADE | profiles, notifications |
| `created_by` | SET NULL | issues, projects, prds |
| `assigned_to` | SET NULL | issues |
| `invited_by` | SET NULL | team_invites |
| `owner_id` (team owner) | SET NULL | teams |

### Checklist for New Tables

Before creating a migration with user references:

1. [ ] Does the column reference `auth.users(id)`?
2. [ ] Is `ON DELETE CASCADE` or `ON DELETE SET NULL` specified?
3. [ ] Consider: Should this record exist without the user?
   - **YES** → Use `SET NULL`
   - **NO** → Use `CASCADE`

### Existing Tables Reference

| Table | Column | Delete Rule |
|-------|--------|-------------|
| profiles | id | CASCADE |
| teams | owner_id | SET NULL |
| team_members | user_id | CASCADE (via profiles) |
| team_invites | invited_by | SET NULL |
| projects | created_by | SET NULL |
| issues | created_by, assignee_id | SET NULL |
| notifications | user_id | CASCADE |
| activity_logs | user_id | SET NULL |
