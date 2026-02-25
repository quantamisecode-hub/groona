import React, { useState, useEffect, useRef } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  FolderKanban, 
  CheckSquare, 
  User, 
  FileText,
  Loader2,
  X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function GlobalSearchBar({ currentUser }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState({
    projects: [],
    tasks: [],
    users: [],
    documents: [],
  });
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const resultsRef = useRef(null);

  const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id 
    ? currentUser.active_tenant_id 
    : currentUser?.tenant_id;

  // Focus search on Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchRef.current && 
        !searchRef.current.contains(event.target) &&
        resultsRef.current &&
        !resultsRef.current.contains(event.target)
      ) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search function
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults({ projects: [], tasks: [], users: [], documents: [] });
      setShowResults(false);
      return;
    }
    setShowResults(true);

    const searchTimeout = setTimeout(async () => {
      if (!effectiveTenantId) return;
      
      setSearching(true);
      try {
        const searchQuery = query.toLowerCase();

        // Search projects
        const allProjects = await groonabackend.entities.Project.filter({ tenant_id: effectiveTenantId });
        const matchedProjects = allProjects
          .filter(p => 
            p.name?.toLowerCase().includes(searchQuery) || 
            p.description?.toLowerCase().includes(searchQuery)
          )
          .slice(0, 5);

        // Search tasks
        const allTasks = await groonabackend.entities.Task.filter({ tenant_id: effectiveTenantId });
        const matchedTasks = allTasks
          .filter(t => 
            t.title?.toLowerCase().includes(searchQuery) || 
            t.description?.toLowerCase().includes(searchQuery)
          )
          .slice(0, 5);

        // Search users
        const allUsers = await groonabackend.entities.User.list();
        const matchedUsers = allUsers
          .filter(u => 
            u.tenant_id === effectiveTenantId &&
            !u.is_super_admin &&
            (u.full_name?.toLowerCase().includes(searchQuery) || 
             u.email?.toLowerCase().includes(searchQuery))
          )
          .slice(0, 5);

        // Search documents
        try {
          const allDocuments = await groonabackend.entities.Document.filter({ tenant_id: effectiveTenantId });
          const matchedDocuments = allDocuments
            .filter(d => 
              d.title?.toLowerCase().includes(searchQuery) || 
              d.content?.toLowerCase().includes(searchQuery)
            )
            .slice(0, 5);
          
          setResults({
            projects: matchedProjects,
            tasks: matchedTasks,
            users: matchedUsers,
            documents: matchedDocuments,
          });
        } catch {
          // Documents might not exist
          setResults({
            projects: matchedProjects,
            tasks: matchedTasks,
            users: matchedUsers,
            documents: [],
          });
        }
      } catch (error) {
        console.error('[GlobalSearch] Search error:', error);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [query, effectiveTenantId]);

  const handleSelect = (type, item) => {
    setShowResults(false);
    setQuery("");
    
    switch (type) {
      case 'project':
        navigate(createPageUrl(`ProjectDetail?id=${item.id}`));
        break;
      case 'task':
        navigate(createPageUrl(`ProjectDetail?id=${item.project_id}`));
        break;
      case 'user':
        navigate(createPageUrl('Team'));
        break;
      case 'document':
        navigate(createPageUrl('Collaboration'));
        break;
    }
  };

  const statusColors = {
    todo: "bg-slate-500",
    in_progress: "bg-blue-500",
    review: "bg-amber-500",
    completed: "bg-emerald-500",
  };

  const priorityColors = {
    low: "bg-blue-500",
    medium: "bg-amber-500",
    high: "bg-orange-500",
    urgent: "bg-red-500",
  };

  const totalResults = results.projects.length + results.tasks.length + 
                       results.users.length + results.documents.length;

  return (
    <div className="relative w-full sm:w-64" ref={searchRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          type="text"
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          className="pl-9 pr-8 w-full"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setShowResults(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showResults && query.length >= 2 && (
        <Card 
          ref={resultsRef}
          className="absolute top-full left-0 right-0 mt-1 z-50 max-h-[400px] overflow-y-auto shadow-lg"
        >
          <CardContent className="p-2">
            {searching && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            )}

            {!searching && totalResults === 0 && (
              <div className="py-6 text-center text-sm text-slate-500">
                No results found for "{query}"
              </div>
            )}

            {!searching && results.projects.length > 0 && (
              <div className="mb-2">
                <div className="text-xs font-semibold text-slate-500 px-2 py-1.5">Projects</div>
                {results.projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => handleSelect('project', project)}
                    className="w-full flex items-center gap-2 px-2 py-2 hover:bg-slate-50 rounded text-left"
                  >
                    <FolderKanban className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{project.name}</div>
                      {project.description && (
                        <div className="text-xs text-slate-500 truncate">
                          {project.description}
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className="ml-2 text-xs flex-shrink-0">
                      {project.status}
                    </Badge>
                  </button>
                ))}
              </div>
            )}

            {!searching && results.tasks.length > 0 && (
              <div className="mb-2">
                <div className="text-xs font-semibold text-slate-500 px-2 py-1.5">Tasks</div>
                {results.tasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => handleSelect('task', task)}
                    className="w-full flex items-center gap-2 px-2 py-2 hover:bg-slate-50 rounded text-left"
                  >
                    <CheckSquare className="h-4 w-4 text-purple-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{task.title}</div>
                      {task.description && (
                        <div className="text-xs text-slate-500 truncate">
                          {task.description}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                      <div className={cn("h-2 w-2 rounded-full", statusColors[task.status] || "bg-slate-400")} />
                      <div className={cn("h-2 w-2 rounded-full", priorityColors[task.priority] || "bg-slate-400")} />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!searching && results.users.length > 0 && (
              <div className="mb-2">
                <div className="text-xs font-semibold text-slate-500 px-2 py-1.5">Team Members</div>
                {results.users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleSelect('user', user)}
                    className="w-full flex items-center gap-2 px-2 py-2 hover:bg-slate-50 rounded text-left"
                  >
                    <User className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{user.full_name}</div>
                      <div className="text-xs text-slate-500 truncate">{user.email}</div>
                    </div>
                    {user.role === 'admin' && (
                      <Badge variant="outline" className="ml-2 text-xs flex-shrink-0">
                        Admin
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            )}

            {!searching && results.documents.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-500 px-2 py-1.5">Documents</div>
                {results.documents.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => handleSelect('document', doc)}
                    className="w-full flex items-center gap-2 px-2 py-2 hover:bg-slate-50 rounded text-left"
                  >
                    <FileText className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{doc.title}</div>
                      <div className="text-xs text-slate-500 truncate">
                        {doc.category || 'General'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

