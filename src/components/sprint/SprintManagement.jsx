import React from "react";
import SprintsListPage from "./SprintsListPage";

// Wrapper to maintain compatibility but use the new SprintsListPage
export default function SprintManagement(props) {
  return (
    <SprintsListPage
      projectId={props.projectId}
      sprints={props.sprints}
      tasks={props.tasks}
      tenantId={props.tenantId}
      highlightSprintId={props.highlightSprintId}
    />
  );
}