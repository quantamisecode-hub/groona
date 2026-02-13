import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Code, 
  Upload, 
  Link as LinkIcon, 
  Sparkles, 
  Loader2, 
  AlertTriangle,
  Shield,
  Zap,
  CheckCircle2,
  FileCode,
  Info
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useHasPermission } from "../components/shared/usePermissions";
import { AccessDenied } from "../components/shared/PermissionGuard";

export default function CodeReview() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState("snippet");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  
  // Form states
  const [codeSnippet, setCodeSnippet] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [repoUrl, setRepoUrl] = useState("");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileUrl, setFileUrl] = useState("");
  
  const canUseCodeReview = useHasPermission('can_use_ai_code_review');

  useEffect(() => {
    groonabackend.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const analyzeCode = async (code, source = "snippet") => {
    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const prompt = `You are an expert code reviewer. Analyze the following ${language} code and provide a comprehensive review.

${source === "snippet" ? "CODE SNIPPET:" : source === "file" ? "CODE FILE:" : "REPOSITORY CODE:"}
\`\`\`${language}
${code}
\`\`\`

Please provide a detailed analysis in the following structured format:

## 🐛 Potential Bugs
List any logical errors, off-by-one errors, null pointer exceptions, or other bugs you identify. For each bug:
- Describe the issue
- Explain why it's problematic
- Provide a code fix example

## 🔒 Security Vulnerabilities
Identify security issues such as:
- SQL injection vulnerabilities
- XSS (Cross-Site Scripting) risks
- Authentication/authorization flaws
- Sensitive data exposure
- Insecure dependencies
For each vulnerability, explain the risk and suggest mitigation.

## ⚡ Performance Issues
Point out performance bottlenecks:
- Inefficient algorithms or data structures
- Memory leaks
- Unnecessary computations
- Database query optimizations
Provide optimization suggestions with code examples.

## 🎨 Style & Best Practices
Review code quality:
- Naming conventions
- Code organization and modularity
- Comments and documentation
- Design patterns
- Language-specific best practices

## ✅ What's Good
Highlight positive aspects of the code:
- Good practices already in use
- Well-implemented features
- Clean code sections

## 🚀 Recommendations
Provide actionable recommendations for improvement with priority levels (High/Medium/Low).

Be specific, constructive, and provide code examples where helpful. If the code is generally good, say so!`;

      const result = await groonabackend.integrations.Core.InvokeLLM({
        prompt: prompt,
        add_context_from_internet: false,
      });

      setAnalysisResult({
        code,
        language,
        source,
        result,
        timestamp: new Date().toISOString(),
      });

      toast.success('Code analysis complete!');
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze code. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSnippetReview = () => {
    if (!codeSnippet.trim()) {
      toast.error('Please enter a code snippet');
      return;
    }
    analyzeCode(codeSnippet, "snippet");
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 1MB for now)
    if (file.size > 1024 * 1024) {
      toast.error('File too large. Please upload files under 1MB.');
      return;
    }

    setUploadedFile(file);
    toast.info('Uploading file...');

    try {
      const { file_url } = await groonabackend.integrations.Core.UploadFile({ file });
      setFileUrl(file_url);
      
      // Read file content
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target.result;
        setCodeSnippet(content);
        
        // Detect language from file extension
        const ext = file.name.split('.').pop().toLowerCase();
        const langMap = {
          'js': 'javascript',
          'jsx': 'javascript',
          'ts': 'typescript',
          'tsx': 'typescript',
          'py': 'python',
          'java': 'java',
          'cpp': 'c++',
          'c': 'c',
          'go': 'go',
          'rb': 'ruby',
          'php': 'php',
          'cs': 'c#',
          'swift': 'swift',
          'kt': 'kotlin',
        };
        setLanguage(langMap[ext] || 'javascript');
        
        toast.success('File uploaded successfully');
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload file');
    }
  };

  const handleFileReview = () => {
    if (!codeSnippet.trim()) {
      toast.error('Please upload a code file first');
      return;
    }
    analyzeCode(codeSnippet, "file");
  };

  const handleRepoReview = async () => {
    if (!repoUrl.trim()) {
      toast.error('Please enter a repository URL');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const prompt = `You are an expert code reviewer. Analyze the code repository at: ${repoUrl}

Please provide a comprehensive review covering:

## 📋 Repository Overview
- Project structure and organization
- Technology stack
- Overall code quality impression

## 🐛 Potential Bugs
Identify any logical errors or common pitfalls in the codebase.

## 🔒 Security Vulnerabilities
List security concerns including:
- Authentication/authorization issues
- Data validation problems
- Dependency vulnerabilities
- API security

## ⚡ Performance Considerations
Point out potential performance bottlenecks or optimization opportunities.

## 🎨 Code Quality & Best Practices
Review:
- Code organization and modularity
- Naming conventions
- Documentation quality
- Design patterns usage

## ✅ Strengths
Highlight what's well-implemented.

## 🚀 Recommendations
Provide prioritized recommendations for improvement.

Note: Please fetch the repository information from the internet to provide accurate analysis.`;

      const result = await groonabackend.integrations.Core.InvokeLLM({
        prompt: prompt,
        add_context_from_internet: true,
      });

      setAnalysisResult({
        code: repoUrl,
        language: "repository",
        source: "repository",
        result,
        timestamp: new Date().toISOString(),
      });

      toast.success('Repository analysis complete!');
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze repository. Please check the URL and try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearAnalysis = () => {
    setAnalysisResult(null);
    setCodeSnippet("");
    setRepoUrl("");
    setUploadedFile(null);
    setFileUrl("");
  };

  if (!canUseCodeReview) {
    return (
      <div className="p-6 md:p-8">
        <AccessDenied message="You don't have permission to access AI Code Review. This feature is restricted to administrators." />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2 flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
              <Code className="h-6 w-6 text-white" />
            </div>
            AI Code Review
          </h1>
          <p className="text-slate-600">Analyze code for bugs, security issues, performance problems, and best practices</p>
        </div>
        {analysisResult && (
          <Button variant="outline" onClick={clearAnalysis}>
            New Review
          </Button>
        )}
      </div>

      {/* Info Alert */}
      <Alert className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
        <Info className="h-4 w-4 text-purple-700" />
        <AlertDescription className="text-slate-700">
          <strong>Admin Tool:</strong> This AI-powered code review tool helps developers identify bugs, security vulnerabilities, 
          performance issues, and style inconsistencies. Perfect for code audits and quality assurance.
        </AlertDescription>
      </Alert>

      {!analysisResult ? (
        /* Input Section */
        <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60">
          <CardHeader>
            <CardTitle>Submit Code for Review</CardTitle>
            <CardDescription>Choose how you'd like to submit your code</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="snippet" className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Code Snippet
                </TabsTrigger>
                <TabsTrigger value="file" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Upload File
                </TabsTrigger>
                <TabsTrigger value="repository" className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" />
                  Repository
                </TabsTrigger>
              </TabsList>

              {/* Code Snippet Tab */}
              <TabsContent value="snippet" className="space-y-4">
                <div className="space-y-2">
                  <Label>Programming Language</Label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="typescript">TypeScript</option>
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                    <option value="c++">C++</option>
                    <option value="c#">C#</option>
                    <option value="go">Go</option>
                    <option value="ruby">Ruby</option>
                    <option value="php">PHP</option>
                    <option value="swift">Swift</option>
                    <option value="kotlin">Kotlin</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Code Snippet</Label>
                  <Textarea
                    value={codeSnippet}
                    onChange={(e) => setCodeSnippet(e.target.value)}
                    placeholder="Paste your code here..."
                    rows={15}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500">
                    Paste the code you want to review. Works best with functions, classes, or modules.
                  </p>
                </div>

                <Button
                  onClick={handleSnippetReview}
                  disabled={isAnalyzing || !codeSnippet.trim()}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
                  size="lg"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Analyzing Code...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 mr-2" />
                      Review Code
                    </>
                  )}
                </Button>
              </TabsContent>

              {/* File Upload Tab */}
              <TabsContent value="file" className="space-y-4">
                <div className="space-y-2">
                  <Label>Upload Code File</Label>
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      accept=".js,.jsx,.ts,.tsx,.py,.java,.cpp,.c,.go,.rb,.php,.cs,.swift,.kt"
                      className="hidden"
                      id="code-file-upload"
                    />
                    <label htmlFor="code-file-upload" className="cursor-pointer">
                      <FileCode className="h-12 w-12 mx-auto text-slate-400 mb-3" />
                      <p className="text-slate-700 font-medium mb-1">
                        {uploadedFile ? uploadedFile.name : 'Click to upload code file'}
                      </p>
                      <p className="text-sm text-slate-500">
                        Supports .js, .jsx, .ts, .tsx, .py, .java, .cpp, .c, .go, .rb, .php, .cs, .swift, .kt (Max 1MB)
                      </p>
                    </label>
                  </div>
                </div>

                {uploadedFile && (
                  <>
                    <div className="space-y-2">
                      <Label>File Preview</Label>
                      <Textarea
                        value={codeSnippet}
                        readOnly
                        rows={10}
                        className="font-mono text-sm bg-slate-50"
                      />
                    </div>

                    <Button
                      onClick={handleFileReview}
                      disabled={isAnalyzing || !codeSnippet.trim()}
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
                      size="lg"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Analyzing File...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-5 w-5 mr-2" />
                          Review File
                        </>
                      )}
                    </Button>
                  </>
                )}
              </TabsContent>

              {/* Repository Tab */}
              <TabsContent value="repository" className="space-y-4">
                <Alert className="bg-blue-50 border-blue-200">
                  <Info className="h-4 w-4 text-blue-700" />
                  <AlertDescription className="text-slate-700">
                    <strong>Note:</strong> Repository analysis works best with public repositories. 
                    The AI will fetch information from the internet to provide comprehensive feedback.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label>Repository URL</Label>
                  <Input
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/username/repository"
                    type="url"
                  />
                  <p className="text-xs text-slate-500">
                    Enter the URL of a public GitHub, GitLab, or Bitbucket repository
                  </p>
                </div>

                <Button
                  onClick={handleRepoReview}
                  disabled={isAnalyzing || !repoUrl.trim()}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
                  size="lg"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Analyzing Repository...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 mr-2" />
                      Review Repository
                    </>
                  )}
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      ) : (
        /* Analysis Results */
        <div className="space-y-6">
          {/* Analysis Info Card */}
          <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <h3 className="font-semibold text-slate-900">Analysis Complete</h3>
                  </div>
                  <p className="text-sm text-slate-600">
                    {analysisResult.source === "repository" 
                      ? `Repository: ${analysisResult.code}`
                      : `Language: ${analysisResult.language}`
                    }
                  </p>
                  <p className="text-xs text-slate-500">
                    Reviewed on {new Date(analysisResult.timestamp).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge className="bg-purple-100 text-purple-700">
                    AI-Powered
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results Display */}
          <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                Code Review Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-slate max-w-none">
                <ReactMarkdown
                  components={{
                    h2: ({ children }) => (
                      <h2 className="text-xl font-bold mt-6 mb-3 pb-2 border-b border-slate-200 flex items-center gap-2">
                        {String(children).includes('Bug') && <AlertTriangle className="h-5 w-5 text-red-600" />}
                        {String(children).includes('Security') && <Shield className="h-5 w-5 text-orange-600" />}
                        {String(children).includes('Performance') && <Zap className="h-5 w-5 text-yellow-600" />}
                        {String(children).includes('Style') && <Code className="h-5 w-5 text-blue-600" />}
                        {String(children).includes('Good') && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                        {String(children).includes('Recommendation') && <Sparkles className="h-5 w-5 text-purple-600" />}
                        {children}
                      </h2>
                    ),
                    code: ({ inline, className, children, ...props }) => {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline && match ? (
                        <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 overflow-x-auto my-3">
                          <code className={className} {...props}>{children}</code>
                        </pre>
                      ) : (
                        <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-sm font-mono">
                          {children}
                        </code>
                      );
                    },
                    ul: ({ children }) => (
                      <ul className="my-3 ml-6 list-disc space-y-2">{children}</ul>
                    ),
                    li: ({ children }) => (
                      <li className="text-slate-700">{children}</li>
                    ),
                    p: ({ children }) => (
                      <p className="my-3 text-slate-700 leading-relaxed">{children}</p>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold text-slate-900">{children}</strong>
                    ),
                  }}
                >
                  {analysisResult.result}
                </ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

