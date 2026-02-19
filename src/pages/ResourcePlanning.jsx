import ResourceAllocation from "../components/projects/ResourceAllocation";

export default function ResourcePlanning() {
  return (
    <div className="flex flex-col w-full h-full relative overflow-hidden">
      {/* Fixed Header Section */}
      <div className="bg-white border-b border-slate-200/60 shadow-sm flex-shrink-0 z-20">
        <div className="px-4 md:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-2 mb-4">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Resource Planning</h1>
            <p className="text-slate-600 text-lg">Monitor team workload and optimize resource allocation</p>
          </div>
          <ResourceAllocation showSummaryOnly={true} />
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50/50">
        <div className="p-3 pb-24">
          <ResourceAllocation showResourceListOnly={true} />
        </div>
      </div>
    </div>
  );
}