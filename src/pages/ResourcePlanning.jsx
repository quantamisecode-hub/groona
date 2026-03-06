import React from "react";
import { useSearchParams } from "react-router-dom";
import ResourceAllocation from "../components/projects/ResourceAllocation";

export default function ResourcePlanning() {
  const [searchParams] = useSearchParams();
  const highlightUser = searchParams.get('highlightUser');

  return (
    <div className="flex flex-col bg-[#f8f9fa] w-full relative min-h-screen">
      <div className="max-w-screen-2xl mx-auto w-full flex flex-col relative">
        <div className="flex-1 px-4 sm:px-6 lg:px-8 pt-6 pb-8 space-y-6 lg:space-y-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-4">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl xl:text-4xl font-bold text-slate-900 tracking-tight">Resource Planning</h1>
              <p className="text-sm sm:text-base text-slate-500 font-medium">Monitor team workload and optimize resource allocation</p>
            </div>
          </div>

          <ResourceAllocation showSummaryOnly={true} />

          <ResourceAllocation showResourceListOnly={true} highlightUserId={highlightUser} />
        </div>
      </div>
    </div>
  );
}