import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  CheckCircle,
  Clock,
  Users,
  Settings,
  Gift,
  ChevronDown,
  ChevronUp,
  Info
} from "lucide-react";


export default function LeaveGuide() {
  const [expandedSection, setExpandedSection] = useState('overview');

  const sections = [
    {
      id: 'overview',
      title: 'System Overview',
      icon: Info,
      color: 'blue',
      content: (
        <div className="space-y-3">
          <p className="text-slate-700">
            The Leave Management System helps you plan and track time off efficiently.
            Here's how it works:
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="p-3 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-1">For Employees</h4>
              <p className="text-sm text-blue-700">Apply for leave, track your balance, and view approval status</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <h4 className="font-semibold text-purple-900 mb-1">For Managers</h4>
              <p className="text-sm text-purple-700">Review requests, check team availability, and manage comp off</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'apply',
      title: 'How to Apply for Leave',
      icon: Calendar,
      color: 'green',
      content: (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-semibold flex-shrink-0">1</div>
            <div>
              <h4 className="font-semibold text-slate-900">Click "Apply Leave"</h4>
              <p className="text-sm text-slate-600">Find the button in the top-right corner or on the Overview tab</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-semibold flex-shrink-0">2</div>
            <div>
              <h4 className="font-semibold text-slate-900">Select Leave Type</h4>
              <p className="text-sm text-slate-600">Choose from available leave types (Casual, Sick, etc.) and check your balance</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-semibold flex-shrink-0">3</div>
            <div>
              <h4 className="font-semibold text-slate-900">Pick Dates & Duration</h4>
              <p className="text-sm text-slate-600">Select start and end dates. Half-day counts as 0.5 days from your balance</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-semibold flex-shrink-0">4</div>
            <div>
              <h4 className="font-semibold text-slate-900">Provide Reason & Submit</h4>
              <p className="text-sm text-slate-600">Briefly explain your leave reason and submit for approval</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'balance',
      title: 'Understanding Your Leave Balance',
      icon: Clock,
      color: 'yellow',
      content: (
        <div className="space-y-3">
          <p className="text-slate-700">Your leave balance shows three key numbers:</p>
          <div className="space-y-2">
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-blue-900">Allocated</span>
                <span className="text-lg font-bold text-blue-600">12</span>
              </div>
              <p className="text-sm text-blue-700">Total days you get per year (configured by admin)</p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-red-900">Used</span>
                <span className="text-lg font-bold text-red-600">5</span>
              </div>
              <p className="text-sm text-red-700">Days you've already taken (approved leaves)</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg">
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-yellow-900">Pending</span>
                <span className="text-lg font-bold text-yellow-600">2</span>
              </div>
              <p className="text-sm text-yellow-700">Days in submitted requests awaiting approval</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-green-900">Remaining</span>
                <span className="text-lg font-bold text-green-600">5</span>
              </div>
              <p className="text-sm text-green-700">Days still available to use</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'approval',
      title: 'The Approval Process',
      icon: CheckCircle,
      color: 'indigo',
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-900">
            <Info className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <p className="text-sm font-medium">
              All leave requests require approval from your manager or admin before being confirmed
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-slate-900">Submitted</h4>
                <p className="text-sm text-slate-600">Your request is pending review. Days are temporarily reserved.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-slate-900">Approved</h4>
                <p className="text-sm text-slate-600">Your leave is confirmed. Days are deducted from your balance.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-slate-900">Rejected</h4>
                <p className="text-sm text-slate-600">Request denied. Days are returned to your balance.</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'compoff',
      title: 'What is Comp Off?',
      icon: Gift,
      color: 'pink',
      content: (
        <div className="space-y-3">
          <p className="text-slate-700">
            Compensatory Off (Comp Off) is extra leave credited to you for working on holidays,
            weekends, or overtime.
          </p>
          <div className="p-4 bg-pink-50 rounded-lg border border-pink-200">
            <h4 className="font-semibold text-pink-900 mb-2">How it works:</h4>
            <ul className="space-y-2 text-sm text-pink-800">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Admin credits comp off days to your account (e.g., for holiday work)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Days are added to your leave balance automatically</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Apply for comp off leave just like any other leave type</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Comp off typically has an expiry date (usually 90 days)</span>
              </li>
            </ul>
          </div>
        </div>
      )
    },
  ];

  const toggleSection = (sectionId) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5" />
          Leave Management Guide
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sections.map((section) => {
          const Icon = section.icon;
          const isExpanded = expandedSection === section.id;

          return (
            <div key={section.id} className="border rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg bg-${section.color}-100 flex items-center justify-center`}>
                    <Icon className={`h-5 w-5 text-${section.color}-600`} />
                  </div>
                  <span className="font-semibold text-slate-900">{section.title}</span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 text-slate-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-slate-400" />
                )}
              </button>
              {isExpanded && (
                <div className="p-4 pt-4 border-t bg-slate-50">
                  {section.content}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}