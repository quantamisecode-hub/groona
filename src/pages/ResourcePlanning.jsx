import React from "react";
import ResourceAllocation from "../components/projects/ResourceAllocation";

export default function ResourcePlanning() {
  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 overflow-x-hidden w-full relative" style={{ maxWidth: '100vw', left: 0, right: 0 }}>
      <div className="max-w-7xl mx-auto w-full flex flex-col h-full overflow-x-hidden relative" style={{ maxWidth: '100%' }}>
        {/* Sticky Header Section */}
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200/60 shadow-sm">
          <div className="px-4 md:px-6 lg:px-8 pt-4 md:pt-6 lg:pt-8 pb-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Resource Planning</h1>
              <p className="text-slate-600 mb-4">Monitor team workload and optimize resource allocation</p>
            </div>
            <ResourceAllocation showSummaryOnly={true} />
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="px-4 md:px-6 lg:px-8 pb-4 md:pb-6 lg:pb-8 pt-4">
            <ResourceAllocation showResourceListOnly={true} />
          </div>
        </div>
      </div>
    </div>
  );
}
