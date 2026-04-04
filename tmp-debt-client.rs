//! MCP client — connects to external MCP servers via stdio child process.
//!
//! Uses rmcp's client transport to spawn subprocesses, initialize the MCP
//! handshake, discover tools, and call them. Each McpConnection represents
//! a single connected server.

use anyhow::{Context, Result};
use rmcp::model::*;
use rmcp::service::RunningService;
use rmcp::{RoleClient, ServiceExt};
use serde::Deserialize;
use std::collections::BTreeMap;
use tracing::info;

/// Configuration for an external MCP server.
#[derive(Debug, Clone, Deserialize)]
pub struct McpServerDef {
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: BTreeMap<String, String>,
    #[serde(default = "default_timeout_ms")]
    pub timeout_ms: u64,
}

fn default_timeout_ms() -> u64 {
    60_000
}

/// Info about a discovered tool on a connected server.
#[derive(Debug, Clone, serde::Serialize)]
pub struct McpToolInfo {
    pub name: String,
    pub qualified_name: String,
    pub description: Option<String>,
}

/// A live connection to an MCP server.
pub struct McpConnection {
    pub name: String,
    pub service: RunningService<RoleClient, ()>,
    pub tools: Vec<McpToolInfo>,
}

impl McpConnection {
    /// Connect to an MCP server by spawning a child process.
    pub async fn connect(name: &str, def: &McpServerDef) -> Result<Self> {
        let mut cmd = tokio::process::Command::new(&def.command);
        cmd.args(&def.args);
        for (k, v) in &def.env {
            // Support _FILE suffix: read value from file path
            if k.ends_with("_FILE") {
                let real_key = &k[..k.len() - 5]; // strip _FILE
                match std::fs::read_to_string(v) {
                    Ok(content) => { cmd.env(real_key, content.trim()); }
                    Err(e) => tracing::warn!("Failed to read {}: {}", v, e),
                }
            } else {
                cmd.env(k, v);
            }
        }

        let transport = rmcp::transport::child_process::TokioChildProcess::new(cmd)
            .context("failed to spawn MCP server process")?;

        let service = ().serve(transport)
            .await
            .map_err(|e| anyhow::anyhow!("MCP initialize failed for {}: {}", name, e))?;

        // Discover tools
        let tools_result = service.peer().list_all_tools().await
            .map_err(|e| anyhow::anyhow!("list_tools failed for {}: {}", name, e))?;

        let tools: Vec<McpToolInfo> = tools_result
            .into_iter()
            .map(|t| McpToolInfo {
                qualified_name: format!("mcp__{}_{}", name, t.name),
                name: t.name.to_string(),
                description: t.description.map(|d| d.to_string()),
            })
            .collect();

        info!(
            "MCP client '{}' connected: {} tools discovered",
            name,
            tools.len()
        );

        Ok(McpConnection {
            name: name.to_string(),
            service,
            tools,
        })
    }

    /// Call a tool on this server.
    pub async fn call_tool(
        &self,
        tool_name: &str,
        arguments: serde_json::Value,
    ) -> Result<CallToolResult> {
        let args = arguments
            .as_object()
            .cloned()
            .unwrap_or_default();

        let mut params = CallToolRequestParams::default();
        params.name = tool_name.to_string().into();
        params.arguments = Some(args);

        let result = tokio::time::timeout(
            std::time::Duration::from_secs(60),
            self.service.peer().call_tool(params),
        )
        .await
        .map_err(|_| anyhow::anyhow!("call_tool '{}' timed out after 60s", tool_name))?
        .map_err(|e| anyhow::anyhow!("call_tool '{}' failed: {}", tool_name, e))?;

        Ok(result)
    }

    /// Check if the connection is alive by pinging.
    pub async fn is_alive(&self) -> bool {
        self.service
            .peer()
            .list_tools(Default::default())
            .await
            .is_ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tool_naming_convention() {
        let info = McpToolInfo {
            name: "exa_search".to_string(),
            qualified_name: "mcp__exa_exa_search".to_string(),
            description: Some("Search".to_string()),
        };
        assert!(info.qualified_name.starts_with("mcp__"));
        assert!(info.qualified_name.contains("exa_search"));
    }

    #[test]
    fn parse_mcp_server_def() {
        let json = r#"{"command":"node","args":["server.js"],"env":{"API_KEY":"test"},"timeout_ms":30000}"#;
        let def: McpServerDef = serde_json::from_str(json).unwrap();
        assert_eq!(def.command, "node");
        assert_eq!(def.args, vec!["server.js"]);
        assert_eq!(def.env["API_KEY"], "test");
        assert_eq!(def.timeout_ms, 30000);
    }

    #[test]
    fn default_timeout() {
        let json = r#"{"command":"echo","args":[]}"#;
        let def: McpServerDef = serde_json::from_str(json).unwrap();
        assert_eq!(def.timeout_ms, 60000);
    }
}
