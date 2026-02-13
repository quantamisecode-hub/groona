import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { groonabackend } from "@/api/groonabackend";
import { Loader2 } from "lucide-react";

export default function WorkloadWidget({ tasks, project }) {
  // Fetch all users to resolve emails to Full Names
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['all-users-workload'],
    queryFn: () => groonabackend.entities.User.list(),
    staleTime: 10 * 60 * 1000, 
  });

  const chartData = useMemo(() => {
    if (isLoading) return [];

    // 1. Build Map: Email -> Display Name
    const userMap = {};
    users.forEach(u => {
      if (u.email) userMap[u.email] = u.full_name || u.email;
    });

    // 2. Aggregate Workload from Tasks
    const workloadCounts = {};
    tasks.forEach(task => {
      if (!task.assigned_to) return;
      
      const assignees = Array.isArray(task.assigned_to) ? task.assigned_to : [task.assigned_to];
      
      assignees.forEach(email => {
        let displayName = userMap[email];
        // Fallback formatting if not found in user list
        if (!displayName) {
            displayName = email.split('@')[0];
            displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
        }
        workloadCounts[displayName] = (workloadCounts[displayName] || 0) + 1;
      });
    });

    // 3. Convert to Array and Sort by Count Descending
    // Only show team members who have assigned tasks (count > 0)
    let data = Object.entries(workloadCounts)
      .filter(([name, count]) => count > 0) // Only show members with tasks
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // 4. Don't fill with members who have 0 tasks - only show those with assigned tasks
    // Slice to top 5 members with tasks
    return data.slice(0, 5);

  }, [tasks, users, project, isLoading]);

  if (isLoading) {
    return (
        <Card className="h-full flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Team Workload</CardTitle>
      </CardHeader>
      <CardContent className="h-[250px]">
        {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                No team members found
            </div>
        ) : (
            <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <XAxis type="number" hide />
                <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={100} 
                    tick={{ fontSize: 11, fill: '#64748b' }} 
                    interval={0}
                />
                <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    cursor={{ fill: 'transparent' }}
                />
                <Bar dataKey="count" fill="#8884d8" radius={[0, 4, 4, 0]} barSize={20}>
                    {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(${210 + index * 10}, 80%, 60%)`} />
                    ))}
                </Bar>
            </BarChart>
            </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

