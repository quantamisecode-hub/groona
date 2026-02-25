import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

const COLORS = {
  todo: "#64748b", // slate-500
  in_progress: "#3b82f6", // blue-500
  review: "#f59e0b", // amber-500
  completed: "#10b981", // emerald-500
};

export default function StatusWidget({ tasks }) {
  const data = [
    { name: "To Do", value: tasks.filter(t => t.status === 'todo').length, key: 'todo' },
    { name: "In Progress", value: tasks.filter(t => t.status === 'in_progress').length, key: 'in_progress' },
    { name: "Review", value: tasks.filter(t => t.status === 'review').length, key: 'review' },
    { name: "Done", value: tasks.filter(t => t.status === 'completed').length, key: 'completed' },
  ].filter(item => item.value > 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Task Status</CardTitle>
      </CardHeader>
      <CardContent className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[entry.key]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}