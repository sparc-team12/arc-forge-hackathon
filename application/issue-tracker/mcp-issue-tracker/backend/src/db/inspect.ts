#!/usr/bin/env node
import { getDatabase } from "./database.js";

async function inspectDatabase() {
  const db = await getDatabase();

  try {
    console.log("=== DATABASE INSPECTION ===\n");

    // Check users
    const users = await db.all(
      "SELECT id, email, name, createdAt FROM user ORDER BY id"
    );
    console.log(`Users (${users.length}):`);
    users.forEach((user) => {
      console.log(`  ${user.id}: ${user.name} (${user.email})`);
    });

    // Check tags
    const tags = await db.all("SELECT id, name, color FROM tags ORDER BY id");
    console.log(`\nTags (${tags.length}):`);
    tags.forEach((tag) => {
      console.log(`  ${tag.id}: ${tag.name} (${tag.color})`);
    });

    // Check issues with related data
    const issues = await db.all(`
      SELECT 
        i.id,
        i.title,
        i.status,
        creator.name as created_by,
        assignee.name as assigned_to,
        GROUP_CONCAT(t.name) as tags
      FROM issues i
      LEFT JOIN user creator ON i.created_by_user_id = creator.id
      LEFT JOIN user assignee ON i.assigned_user_id = assignee.id
      LEFT JOIN issue_tags it ON i.id = it.issue_id
      LEFT JOIN tags t ON it.tag_id = t.id
      GROUP BY i.id
      ORDER BY i.id
    `);

    console.log(`\nIssues (${issues.length}):`);
    issues.forEach((issue) => {
      console.log(`  ${issue.id}: ${issue.title}`);
      console.log(`      Status: ${issue.status}`);
      console.log(`      Created by: ${issue.created_by}`);
      console.log(`      Assigned to: ${issue.assigned_to || "Unassigned"}`);
      console.log(`      Tags: ${issue.tags || "None"}`);
      console.log("");
    });
  } catch (error) {
    console.error("Error inspecting database:", error);
  } finally {
    await db.close();
  }
}

inspectDatabase();
