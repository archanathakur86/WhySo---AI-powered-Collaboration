import Project from "../models/Project.js";

// "owner" | "editor" | "viewer" | "commentor" | null (not a member)
export const getUserRole = (project, userId) => {
  const uid = userId.toString();
  if (project.owner.toString() === uid) return "owner";
  const member = project.members.find((m) => m.user.toString() === uid);
  return member ? member.role : null;
};

// Loads a project and verifies the user belongs to it (optionally with one of
// `allowedRoles`). Follows the codebase convention: set res.status, then throw.
// Needed by routes that only have a fileId/taskId/noteId and therefore don't
// go through the loadProject middleware.
export const loadProjectForUser = async (res, projectId, user, allowedRoles = null) => {
  const project = await Project.findById(projectId);
  if (!project) {
    res.status(404);
    throw new Error("Project not found");
  }
  const role = getUserRole(project, user._id);
  if (!role) {
    res.status(403);
    throw new Error("You are not a member of this project");
  }
  if (allowedRoles && !allowedRoles.includes(role)) {
    res.status(403);
    throw new Error("You do not have permission to perform this action");
  }
  return { project, role };
};