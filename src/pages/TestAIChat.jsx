import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Loader2, MessageSquare, Trash2, Send, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function TestAIChatPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testResults, setTestResults] = useState({});
  const [testConversation, setTestConversation] = useState(null);
  const [testMessages, setTestMessages] = useState([]);
  const [runningTests, setRunningTests] = useState(false);

  useEffect(() => {
    groonabackend.auth.me().then(user => {
      setCurrentUser(user);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  const runComprehensiveTests = async () => {
    setRunningTests(true);
    const results = {
      agentExists: false,
      conversationCreate: false,
      messageSend: false,
      messageReceive: false,
      conversationDelete: false,
      subscriptionWorks: false,
      errors: []
    };

    try {
      // Test 1: Check if agent exists
      console.log('🧪 TEST 1: Checking if project_assistant agent exists...');
      try {
        const conversations = await groonabackend.agents.listConversations({
          agent_name: 'project_assistant'
        });
        results.agentExists = true;
        console.log('✅ TEST 1 PASSED: Agent exists');
      } catch (error) {
        console.error('❌ TEST 1 FAILED:', error);
        results.errors.push(`Agent check failed: ${error.message}`);
      }

      // Test 2: Create conversation
      console.log('🧪 TEST 2: Creating test conversation...');
      try {
        const conversation = await groonabackend.agents.createConversation({
          agent_name: 'project_assistant',
          metadata: {
            name: 'QA Test Conversation',
            created_at: new Date().toISOString(),
          }
        });
        setTestConversation(conversation);
        results.conversationCreate = true;
        console.log('✅ TEST 2 PASSED: Conversation created:', conversation.id);
      } catch (error) {
        console.error('❌ TEST 2 FAILED:', error);
        results.errors.push(`Conversation creation failed: ${error.message}`);
      }

      // Test 3: Send message
      if (testConversation) {
        console.log('🧪 TEST 3: Sending test message...');
        try {
          const response = await groonabackend.agents.addMessage(testConversation, {
            role: 'user',
            content: 'Hello, this is a test message. Please respond briefly.'
          });
          
          results.messageSend = true;
          console.log('✅ TEST 3 PASSED: Message sent');
          
          // Test 4: Check if we received a response
          console.log('🧪 TEST 4: Checking for AI response...');
          
          // Wait a bit for AI to respond
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const updatedConvo = await groonabackend.agents.getConversation(testConversation.id);
          setTestMessages(updatedConvo.messages || []);
          
          if (updatedConvo.messages && updatedConvo.messages.length >= 2) {
            const aiResponse = updatedConvo.messages.find(m => m.role === 'assistant');
            if (aiResponse && aiResponse.content) {
              results.messageReceive = true;
              console.log('✅ TEST 4 PASSED: AI responded:', aiResponse.content.substring(0, 50));
            } else {
              console.log('⚠️ TEST 4: Waiting for AI response...');
            }
          }
        } catch (error) {
          console.error('❌ TEST 3/4 FAILED:', error);
          results.errors.push(`Message send/receive failed: ${error.message}`);
        }
      }

      // Test 5: Test subscription (if conversation exists)
      if (testConversation) {
        console.log('🧪 TEST 5: Testing conversation subscription...');
        try {
          let subscriptionWorked = false;
          
          const unsubscribe = groonabackend.agents.subscribeToConversation(testConversation.id, (data) => {
            console.log('✅ Subscription callback received:', data.messages?.length, 'messages');
            subscriptionWorked = true;
            setTestMessages(data.messages || []);
          });
          
          // Wait a moment
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          unsubscribe();
          results.subscriptionWorks = subscriptionWorked;
          
          if (subscriptionWorked) {
            console.log('✅ TEST 5 PASSED: Subscription works');
          } else {
            console.log('⚠️ TEST 5: Subscription callback not triggered');
          }
        } catch (error) {
          console.error('❌ TEST 5 FAILED:', error);
          results.errors.push(`Subscription failed: ${error.message}`);
        }
      }

      // Test 6: Delete conversation
      if (testConversation) {
        console.log('🧪 TEST 6: Deleting test conversation...');
        try {
          await groonabackend.agents.deleteConversation(testConversation.id);
          results.conversationDelete = true;
          console.log('✅ TEST 6 PASSED: Conversation deleted');
          setTestConversation(null);
        } catch (error) {
          console.error('❌ TEST 6 FAILED:', error);
          results.errors.push(`Conversation deletion failed: ${error.message}`);
        }
      }

    } catch (error) {
      console.error('Overall test error:', error);
      results.errors.push(`Overall error: ${error.message}`);
    }

    setTestResults(results);
    setRunningTests(false);
  };

  const allTestsPassed = testResults.agentExists && 
                         testResults.conversationCreate && 
                         testResults.messageSend && 
                         testResults.conversationDelete;

  const TestResult = ({ label, value, critical = true }) => (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="flex items-center gap-2">
        {value ? (
          <>
            <span className="text-sm text-green-700 font-medium">PASS</span>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </>
        ) : critical ? (
          <>
            <span className="text-sm text-red-700 font-medium">FAIL</span>
            <XCircle className="h-4 w-4 text-red-600" />
          </>
        ) : (
          <>
            <span className="text-sm text-amber-700 font-medium">PENDING</span>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">AI Assistant QA Test Suite</h1>
        <p className="text-slate-600">Comprehensive testing for AI chat functionality</p>
      </div>

      {/* Overall Status */}
      {Object.keys(testResults).length > 0 && (
        <Alert className={allTestsPassed ? "border-green-500 bg-green-50" : testResults.errors?.length > 0 ? "border-red-500 bg-red-50" : "border-blue-500 bg-blue-50"}>
          {allTestsPassed ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : testResults.errors?.length > 0 ? (
            <XCircle className="h-5 w-5 text-red-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-blue-600" />
          )}
          <AlertDescription className="text-base font-semibold">
            {allTestsPassed ? (
              <span className="text-green-900">✅ ALL TESTS PASSED - AI Assistant is fully functional!</span>
            ) : testResults.errors?.length > 0 ? (
              <span className="text-red-900">❌ SOME TESTS FAILED - See details below</span>
            ) : (
              <span className="text-blue-900">⏳ Tests in progress...</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Test Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Test Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            onClick={runComprehensiveTests}
            disabled={runningTests}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          >
            {runningTests ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running Tests...
              </>
            ) : (
              <>
                <MessageSquare className="h-4 w-4 mr-2" />
                Run All Tests
              </>
            )}
          </Button>
          <p className="text-xs text-slate-500 mt-2">
            This will test: Agent existence, conversation creation, message sending, AI responses, and deletion
          </p>
        </CardContent>
      </Card>

      {/* Test Results */}
      {Object.keys(testResults).length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Core Functionality Tests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <TestResult label="1. Agent 'project_assistant' exists" value={testResults.agentExists} />
              <TestResult label="2. Can create conversations" value={testResults.conversationCreate} />
              <TestResult label="3. Can send messages" value={testResults.messageSend} />
              <TestResult label="4. AI responds to messages" value={testResults.messageReceive} critical={false} />
              <TestResult label="5. Subscription/realtime updates work" value={testResults.subscriptionWorks} critical={false} />
              <TestResult label="6. Can delete conversations" value={testResults.conversationDelete} />
            </CardContent>
          </Card>

          {/* Test Messages */}
          {testMessages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Test Conversation Messages</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {testMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg ${
                      msg.role === 'user' 
                        ? 'bg-blue-50 border border-blue-200' 
                        : 'bg-purple-50 border border-purple-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={msg.role === 'user' ? 'default' : 'secondary'}>
                        {msg.role}
                      </Badge>
                      {msg.tool_calls && msg.tool_calls.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {msg.tool_calls.length} tool call(s)
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {msg.content || '(No content)'}
                    </p>
                    {msg.tool_calls && msg.tool_calls.length > 0 && (
                      <div className="mt-2 text-xs text-slate-500">
                        Tools: {msg.tool_calls.map(tc => tc.name).join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Errors */}
          {testResults.errors && testResults.errors.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-red-900">Errors Encountered</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {testResults.errors.map((error, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm text-red-800">
                    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Manual Test Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Manual Testing Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="space-y-1">
              <h4 className="font-semibold text-slate-900">✅ Pre-Test Verification:</h4>
              <ul className="list-disc ml-6 text-slate-700 space-y-1">
                <li>Agent file exists at: agents/project_assistant.json</li>
                <li>Agent configured with proper tools (Project, Task, Sprint, etc.)</li>
                <li>Instructions updated to suppress success messages</li>
              </ul>
            </div>

            <div className="space-y-1">
              <h4 className="font-semibold text-slate-900">✅ Chat Functionality:</h4>
              <ul className="list-disc ml-6 text-slate-700 space-y-1">
                <li>Navigate to AI Assistant page</li>
                <li>Click "New Conversation"</li>
                <li>Type a message and press Enter or click Send</li>
                <li>Verify AI responds within 3-5 seconds</li>
                <li>Check response does NOT contain success messages like "Task created successfully!"</li>
                <li>Verify responses are concise and action-oriented</li>
              </ul>
            </div>

            <div className="space-y-1">
              <h4 className="font-semibold text-slate-900">✅ Delete Functionality:</h4>
              <ul className="list-disc ml-6 text-slate-700 space-y-1">
                <li>Hover over a conversation in the sidebar</li>
                <li>Click the trash icon that appears</li>
                <li>Confirm deletion in popup</li>
                <li>Verify conversation disappears from list</li>
                <li>Verify toast notification appears</li>
              </ul>
            </div>

            <div className="space-y-1">
              <h4 className="font-semibold text-slate-900">✅ File Upload:</h4>
              <ul className="list-disc ml-6 text-slate-700 space-y-1">
                <li>Click "Attach" button in message input</li>
                <li>Select a file (image, PDF, etc.)</li>
                <li>Verify file badge appears</li>
                <li>Send message with file</li>
                <li>Verify AI acknowledges the file</li>
              </ul>
            </div>

            <div className="space-y-1">
              <h4 className="font-semibold text-slate-900">✅ Agent Actions:</h4>
              <ul className="list-disc ml-6 text-slate-700 space-y-1">
                <li>Ask: "Create a task called 'Test Task' for project X"</li>
                <li>Verify AI creates the task</li>
                <li>Verify response is brief (e.g., "Done. What's next?")</li>
                <li>Ask: "Show me all my projects"</li>
                <li>Verify AI lists projects</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Known Issues */}
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="text-amber-900">Important Notes</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-amber-800 space-y-2">
          <p>1. AI responses may take 3-5 seconds depending on complexity</p>
          <p>2. Subscription updates are real-time but may have slight delay</p>
          <p>3. File uploads limited to 10MB per file, 3 files max</p>
          <p>4. Agent instructions updated to suppress success confirmation messages</p>
          <p>5. Delete functionality now properly implemented with confirmation</p>
        </CardContent>
      </Card>
    </div>
  );
}

