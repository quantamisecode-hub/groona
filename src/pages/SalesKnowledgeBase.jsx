import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, Copy, BookOpen } from "lucide-react";
import { toast } from "sonner";

export default function SalesKnowledgeBase() {
  const [search, setSearch] = useState("");
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => groonabackend.auth.me() });

  const { data: snippets = [] } = useQuery({
    queryKey: ['snippets'],
    queryFn: () => groonabackend.entities.ProposalSnippet.list(),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: () => groonabackend.entities.ProposalTemplate.list(),
  });

  const filteredSnippets = snippets.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  const filteredTemplates = templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
          <BookOpen className="h-8 w-8 text-blue-600" />
          Sales Knowledge Base
        </h1>
        <p className="text-slate-600">Reusable content and templates for winning proposals</p>
      </div>

      <div className="flex gap-4 items-center">
        <Input 
          placeholder="Search knowledge base..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      <Tabs defaultValue="snippets">
        <TabsList>
            <TabsTrigger value="snippets">Snippets</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="snippets" className="space-y-4 mt-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSnippets.map(snippet => (
                    <Card key={snippet.id}>
                        <CardHeader className="pb-2">
                            <div className="flex justify-between">
                                <CardTitle className="text-lg">{snippet.name}</CardTitle>
                                <Badge variant="secondary">{snippet.section_type}</Badge>
                            </div>
                            <CardDescription>{snippet.service_type} • Win Score: {snippet.win_rate_score}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-slate-600 line-clamp-3 mb-4">{snippet.body}</p>
                            <Button variant="outline" size="sm" className="w-full" onClick={() => {
                                navigator.clipboard.writeText(snippet.body);
                                toast.success("Snippet copied to clipboard");
                            }}>
                                <Copy className="h-3 w-3 mr-2" /> Copy Content
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4 mt-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map(template => (
                    <Card key={template.id}>
                        <CardHeader>
                            <CardTitle>{template.name}</CardTitle>
                            <CardDescription>{template.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-2 mb-4">
                                <Badge variant="outline">{template.industry}</Badge>
                            </div>
                            <Button className="w-full">Use Template</Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

