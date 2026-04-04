/**
 * Reliable Telegram bridge with heartbeat, timeout handling, and auto-recovery.
 *
 * Improvements over tg-bridge-simple.js:
 * - Heartbeat: pings sandbox every 60s, restarts gateway if unresponsive
 * - Request timeout: 90s per agent call (down from 120s)
 * - Silence detection: if agent doesn't respond in 90s, sends user a status message
 * - Retry logic: retries failed agent calls once before giving up
 * - Graceful error messages: user gets feedback instead of silence
 */

const https = require("https");
const { execSync, exec } = require("node:child_process");
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SANDBOX = process.env.SANDBOX_NAME || "rawcell";
const AGENT_TIMEOUT = 90000; // 90 seconds
const HEARTBEAT_INTERVAL = 60000; // 60 seconds
const MAX_RESPONSE_LENGTH = 4000;

let offset = 0;
let lastAgentResponse = Date.now();
let heartbeatFailures = 0;
let messageCount = 0;
const startTime = Date.now();

function tg(method, body) {
  return new Promise((ok, fail) => {
    const d = JSON.stringify(body);
    const r = https.request({
      hostname: "api.telegram.org",
      path: "/bot" + TOKEN + "/" + method,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(d) },
    }, res => {
      let b = "";
      res.on("data", c => b += c);
      res.on("end", () => { try { ok(JSON.parse(b)); } catch { ok({ ok: false }); } });
    });
    r.on("error", fail);
    r.write(d);
    r.end();
  });
}

function sshCmd(command) {
  return "ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR " +
    "-o ConnectTimeout=10 " +
    `-o 'ProxyCommand=/usr/local/bin/openshell ssh-proxy --gateway-name nemoclaw --name ${SANDBOX}' ` +
    `sandbox@openshell-${SANDBOX} "${command}"`;
}

function askAgent(message, chatId) {
  try {
    const escaped = message.replace(/'/g, "'\\''").replace(/"/g, '\\"');
    const cmd = sshCmd(`openclaw agent --agent main --session-id tg-${chatId} -m '${escaped}'`);
    const out = execSync(cmd, { timeout: AGENT_TIMEOUT, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
    const lines = out.split("\n").filter(l =>
      !l.startsWith("[plugins]") && !l.startsWith("(node:") && !l.includes("NemoClaw") &&
      !l.includes("UNDICI") && !l.includes("Setting up") && !l.includes("falling back") &&
      !l.startsWith("  ") && !l.includes("Gateway agent") &&
      l.trim() !== "" && !l.match(/^\s*[┌│└─]/)
    );
    lastAgentResponse = Date.now();
    heartbeatFailures = 0;
    return lines.join("\n").trim() || "(no response)";
  } catch (e) {
    const stderr = (e.stderr || "").toString();
    const stdout = (e.stdout || "").toString();
    const lines = (stdout + stderr).split("\n").filter(l =>
      !l.startsWith("[plugins]") && !l.startsWith("(node:") && !l.includes("NemoClaw") &&
      !l.includes("UNDICI") && !l.includes("Setting up") && !l.includes("falling back") &&
      !l.includes("Gateway agent") && l.trim() !== "" && !l.match(/^\s*[┌│└─]/)
    );
    const filtered = lines.join("\n").trim();
    if (filtered) {
      lastAgentResponse = Date.now();
      return filtered;
    }
    if (e.killed || e.signal === "SIGTERM") {
      return "[Agent timed out after " + (AGENT_TIMEOUT / 1000) + "s. The model may be overloaded. Try a shorter message or try again in a moment.]";
    }
    return "[Agent error: " + (e.message || "unknown").slice(0, 200) + "]";
  }
}

function checkHeartbeat() {
  try {
    execSync(sshCmd("echo ok"), { timeout: 15000, encoding: "utf-8" });
    heartbeatFailures = 0;
    return true;
  } catch {
    heartbeatFailures++;
    console.error(`[heartbeat] Sandbox unreachable (failure #${heartbeatFailures})`);
    if (heartbeatFailures >= 3) {
      console.error("[heartbeat] 3 consecutive failures — attempting gateway restart inside sandbox");
      try {
        execSync(sshCmd("nohup openclaw gateway run >> /tmp/gateway.log 2>&1 &"), {
          timeout: 15000,
          encoding: "utf-8",
        });
        console.log("[heartbeat] Gateway restart command sent");
      } catch (e) {
        console.error("[heartbeat] Could not restart gateway:", e.message);
      }
    }
    return false;
  }
}

async function run() {
  const me = await tg("getMe", {});
  console.log("Bot: @" + (me.result || {}).username + " - polling (reliable mode)...");
  console.log("Sandbox: " + SANDBOX);
  console.log("Agent timeout: " + (AGENT_TIMEOUT / 1000) + "s");
  console.log("Heartbeat interval: " + (HEARTBEAT_INTERVAL / 1000) + "s");

  // Start heartbeat
  setInterval(() => {
    const alive = checkHeartbeat();
    const silenceMs = Date.now() - lastAgentResponse;
    if (silenceMs > 300000) { // 5 minutes of silence
      console.warn(`[heartbeat] Agent has been silent for ${Math.round(silenceMs / 60000)}m`);
    }
    if (alive) {
      console.log(`[heartbeat] OK (last response ${Math.round(silenceMs / 1000)}s ago)`);
    }
  }, HEARTBEAT_INTERVAL);

  while (true) {
    try {
      const u = await tg("getUpdates", { offset: offset, timeout: 25 });
      if (!u.ok || !u.result) { await new Promise(r => setTimeout(r, 2000)); continue; }
      for (const upd of u.result) {
        offset = upd.update_id + 1;
        const m = upd.message;
        if (!m || !m.text) continue;
        const cid = m.chat.id;
        console.log("[" + cid + "] " + m.from.first_name + ": " + m.text);

        if (m.text === "/start") {
          await tg("sendMessage", { chat_id: cid, text: "NemoClaw Agent ready (reliable mode). Send me a message.", reply_to_message_id: m.message_id });
          continue;
        }

        if (m.text === "/status") {
          const alive = checkHeartbeat();
          const silenceMs = Date.now() - lastAgentResponse;
          const uptimeMs = Date.now() - startTime;
          const uptimeH = Math.floor(uptimeMs / 3600000);
          const uptimeM = Math.floor((uptimeMs % 3600000) / 60000);
          const status = [
            `Sandbox: ${alive ? "OK" : "UNREACHABLE"}`,
            `Model: ${process.env.MODEL || "nvidia/llama-3.3-nemotron-super-49b-v1.5"}`,
            `Last response: ${Math.round(silenceMs / 1000)}s ago`,
            `Bridge uptime: ${uptimeH}h ${uptimeM}m`,
            `Heartbeat failures: ${heartbeatFailures}`,
            `Messages handled: ${messageCount}`,
          ].join("\n");
          await tg("sendMessage", { chat_id: cid, text: status, reply_to_message_id: m.message_id });
          continue;
        }

        if (m.text === "/health") {
          await tg("sendChatAction", { chat_id: cid, action: "typing" });
          let health = "";
          try {
            const dockerOk = execSync("docker info > /dev/null 2>&1 && echo OK || echo FAIL", { timeout: 5000, encoding: "utf-8" }).trim();
            const gatewayOk = execSync("openshell doctor exec -- kubectl get nodes > /dev/null 2>&1 && echo OK || echo FAIL", { timeout: 10000, encoding: "utf-8" }).trim();
            const sandboxOk = execSync("openshell sandbox list 2>/dev/null | grep -q 'rawcell.*Ready' && echo OK || echo FAIL", { timeout: 10000, encoding: "utf-8" }).trim();
            const supervisorOk = execSync("pgrep -f nemoclaw-supervisor > /dev/null 2>&1 && echo OK || echo FAIL", { timeout: 5000, encoding: "utf-8" }).trim();
            const agentOk = checkHeartbeat() ? "OK" : "FAIL";
            health = [
              `Docker: ${dockerOk}`,
              `Gateway cluster: ${gatewayOk}`,
              `Sandbox: ${sandboxOk}`,
              `Supervisor: ${supervisorOk}`,
              `Agent gateway: ${agentOk}`,
            ].join("\n");
          } catch (e) {
            health = "Health check error: " + e.message;
          }
          await tg("sendMessage", { chat_id: cid, text: health, reply_to_message_id: m.message_id });
          continue;
        }

        if (m.text === "/restart") {
          await tg("sendMessage", { chat_id: cid, text: "Triggering full sandbox restart...", reply_to_message_id: m.message_id });
          try {
            exec("bash /mnt/c/Development/Projects/NemoClaw/scripts/sandbox-restart.sh rawcell >> /tmp/nemoclaw-restart.log 2>&1", (err) => {
              const msg = err ? "Restart failed: " + err.message : "Restart complete.";
              tg("sendMessage", { chat_id: cid, text: msg });
            });
          } catch (e) {
            await tg("sendMessage", { chat_id: cid, text: "Restart error: " + e.message });
          }
          continue;
        }

        if (m.text === "/logs") {
          try {
            const logs = execSync("tail -15 /tmp/nemoclaw-supervisor.log 2>/dev/null || echo 'No logs'", { timeout: 5000, encoding: "utf-8" });
            await tg("sendMessage", { chat_id: cid, text: logs.slice(0, 4000), reply_to_message_id: m.message_id });
          } catch (e) {
            await tg("sendMessage", { chat_id: cid, text: "Log error: " + e.message });
          }
          continue;
        }

        if (m.text === "/help") {
          const help = [
            "/status — sandbox health, uptime, stats",
            "/health — all component health checks",
            "/restart — full sandbox restart (backup+recreate+restore)",
            "/logs — last 15 lines of supervisor log",
            "/help — this message",
            "",
            "Any other message is sent to the AI agent.",
          ].join("\n");
          await tg("sendMessage", { chat_id: cid, text: help, reply_to_message_id: m.message_id });
          continue;
        }

        // Send typing indicator
        messageCount++;
        await tg("sendChatAction", { chat_id: cid, action: "typing" });
        const ti = setInterval(() => tg("sendChatAction", { chat_id: cid, action: "typing" }), 4000);

        let resp = askAgent(m.text, String(cid));

        // If first attempt returned a timeout/error, retry once
        if (resp.startsWith("[Agent timed out") || resp.startsWith("[Agent error")) {
          console.log("[" + cid + "] First attempt failed, retrying...");
          await new Promise(r => setTimeout(r, 2000));
          const retry = askAgent(m.text, String(cid));
          if (!retry.startsWith("[Agent")) resp = retry;
        }

        clearInterval(ti);
        console.log("[" + cid + "] agent: " + resp.slice(0, 150));

        // Send response in chunks
        const chunks = [];
        for (let i = 0; i < resp.length; i += MAX_RESPONSE_LENGTH) {
          chunks.push(resp.slice(i, i + MAX_RESPONSE_LENGTH));
        }
        for (const c of chunks) {
          await tg("sendMessage", { chat_id: cid, text: c, reply_to_message_id: m.message_id })
            .catch(() => tg("sendMessage", { chat_id: cid, text: c }));
        }
      }
    } catch (e) {
      console.error("Error:", e.message);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

run().catch(e => { console.error("Fatal:", e); process.exit(1); });
