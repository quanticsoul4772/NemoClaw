#!/usr/bin/env node
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Generate CHANGELOG.md from git history
//
// Usage:
//   node scripts/generate-changelog.js
//   node scripts/generate-changelog.js --since v0.1.0
//   node scripts/generate-changelog.js --full

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Parse command line arguments
const args = process.argv.slice(2);
const sinceTag = args.includes("--since") ? args[args.indexOf("--since") + 1] : null;
const fullHistory = args.includes("--full");

// Helper to run git command and get output
function git(command) {
  try {
    return execSync(`git ${command}`, { encoding: "utf-8" }).trim();
  } catch (error) {
    return "";
  }
}

// Get commits in a category
function getCommitsInCategory(range, pattern) {
  const command = range
    ? `log --pretty=format:"- %s (%h)" --grep="${pattern}" -i ${range}`
    : `log --pretty=format:"- %s (%h)" --grep="${pattern}" -i`;
  
  const commits = git(command);
  return commits || `- No ${pattern} changes`;
}

// Get all commits not matching patterns
function getOtherCommits(range, excludePatterns) {
  let command = range
    ? `log --pretty=format:"- %s (%h)" --invert-grep ${range}`
    : `log --pretty=format:"- %s (%h)" --invert-grep`;
  
  excludePatterns.forEach(pattern => {
    command += ` --grep="${pattern}"`;
  });
  command += " --all-match -i | head -20";
  
  const commits = git(command);
  return commits || "- Miscellaneous improvements";
}

// Get contributors
function getContributors(range) {
  const command = range
    ? `log --pretty=format:"%an" ${range} | sort -u`
    : `log --pretty=format:"%an" | sort -u`;
  
  return git(command).split("\n").filter(name => name.trim());
}

// Generate changelog section
function generateChangelogSection(fromTag, toTag = "HEAD") {
  const range = fromTag ? `${fromTag}..${toTag}` : "";
  const version = toTag === "HEAD" ? "Unreleased" : toTag.replace(/^v/, "");
  const date = toTag === "HEAD" ? new Date().toISOString().split("T")[0] : git(`log -1 --format=%ai ${toTag}`).split(" ")[0];
  
  let changelog = `## [${version}] - ${date}\n\n`;
  
  // Features
  changelog += "### Features\n\n";
  changelog += getCommitsInCategory(range, "^feat") + "\n\n";
  
  // Bug Fixes
  changelog += "### Bug Fixes\n\n";
  changelog += getCommitsInCategory(range, "^fix") + "\n\n";
  
  // Documentation
  changelog += "### Documentation\n\n";
  changelog += getCommitsInCategory(range, "^docs") + "\n\n";
  
  // Security
  changelog += "### Security\n\n";
  changelog += getCommitsInCategory(range, "^security") + "\n\n";
  
  // Other Changes
  changelog += "### Other Changes\n\n";
  changelog += getOtherCommits(range, ["^feat", "^fix", "^docs", "^security"]) + "\n\n";
  
  // Contributors
  const contributors = getContributors(range);
  if (contributors.length > 0) {
    changelog += "### Contributors\n\n";
    changelog += "Thank you to all contributors who made this release possible:\n\n";
    contributors.forEach(name => {
      changelog += `- @${name}\n`;
    });
    changelog += "\n";
  }
  
  return changelog;
}

// Main function
function main() {
  console.log("Generating CHANGELOG.md from git history...\n");
  
  // Get all tags, sorted by date
  const tags = git("tag --sort=-creatordate").split("\n").filter(tag => tag.trim());
  
  // Start building changelog
  let changelog = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`;
  
  // Add unreleased section (commits since last tag)
  if (tags.length > 0) {
    console.log(`Generating unreleased changes since ${tags[0]}...`);
    const unreleased = generateChangelogSection(tags[0], "HEAD");
    if (unreleased.includes("Unreleased")) {
      changelog += unreleased;
    }
  } else {
    console.log("Generating unreleased changes (all commits)...");
    changelog += generateChangelogSection(null, "HEAD");
  }
  
  // Add sections for each tag
  if (fullHistory || !sinceTag) {
    for (let i = 0; i < tags.length; i++) {
      const currentTag = tags[i];
      const previousTag = tags[i + 1] || null;
      
      console.log(`Generating changelog for ${currentTag}...`);
      changelog += generateChangelogSection(previousTag, currentTag);
    }
  } else if (sinceTag) {
    // Generate changelog only since specified tag
    const sinceIndex = tags.indexOf(sinceTag);
    if (sinceIndex === -1) {
      console.error(`Error: Tag ${sinceTag} not found`);
      process.exit(1);
    }
    
    for (let i = 0; i <= sinceIndex; i++) {
      const currentTag = tags[i];
      const previousTag = tags[i + 1] || null;
      
      console.log(`Generating changelog for ${currentTag}...`);
      changelog += generateChangelogSection(previousTag, currentTag);
    }
  }
  
  // Write changelog to file
  const changelogPath = path.join(__dirname, "..", "CHANGELOG.md");
  fs.writeFileSync(changelogPath, changelog, "utf-8");
  
  console.log(`\nCHANGELOG.md generated successfully at ${changelogPath}`);
  console.log(`\nPreview:\n`);
  console.log(changelog.split("\n").slice(0, 30).join("\n"));
  console.log("\n... (truncated)\n");
}

// Run main function
try {
  main();
} catch (error) {
  console.error("Error generating changelog:", error.message);
  process.exit(1);
}
