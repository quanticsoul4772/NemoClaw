const https = require("https");
const { execSync } = require("child_process");
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
let offset = 0;

function tg(method, body) {
  return new Promise((ok, fail) => {
    const d = JSON.stringify(body);
    const r = https.request({ hostname: "api.telegram.org", path: "/bot" + TOKEN + "/" + method, method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(d) }
    }, res => { let b = ""; res.on("data", c => b += c); res.on("end", () => { try { ok(JSON.parse(b)); } catch { ok({ ok: false }); } }); });
    r.on("error", fail); r.write(d); r.end();
  });
}

function askAgent(message, chatId) {
  try {
    const escaped = message.replace(/'/g, "'\\''").replace(/"/g, '\\"');
    const cmd = "ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR " +
      "-o 'ProxyCommand=/usr/local/bin/openshell ssh-proxy --gateway-name nemoclaw --name rawcell' " +
      "sandbox@openshell-rawcell " +
      "\"openclaw agent --agent main --session-id tg-" + chatId + " -m '" + escaped + "'\" 2>&1";
    const out = execSync(cmd, { timeout: 120000, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
    // Filter out setup noise
    const lines = out.split("\n").filter(l =>
      !l.startsWith("[plugins]") && !l.startsWith("(node:") && !l.includes("NemoClaw") &&
      !l.includes("UNDICI") && !l.includes("Setting up") && !l.includes("falling back") &&
      !l.startsWith("  ") && !l.includes("Gateway agent") &&
      l.trim() !== "" && !l.match(/^\s*[┌│└─]/)
    );
    return lines.join("\n").trim() || "(no response)";
  } catch (e) {
    const stderr = (e.stderr || "").toString();
    const stdout = (e.stdout || "").toString();
    // Even on non-zero exit, there might be useful output
    const lines = (stdout + stderr).split("\n").filter(l =>
      !l.startsWith("[plugins]") && !l.startsWith("(node:") && !l.includes("NemoClaw") &&
      !l.includes("UNDICI") && !l.includes("Setting up") && !l.includes("falling back") &&
      !l.includes("Gateway agent") && l.trim() !== "" && !l.match(/^\s*[┌│└─]/)
    );
    return lines.join("\n").trim() || "Agent error: " + (e.message || "unknown").slice(0, 300);
  }
}

async function run() {
  const me = await tg("getMe", {});
  console.log("Bot: @" + (me.result || {}).username + " - polling...");
  while (true) {
    try {
      const u = await tg("getUpdates", { offset: offset, timeout: 25 });
      if (!u.ok || !u.result) { await new Promise(r => setTimeout(r, 2000)); continue; }
      for (const upd of u.result) {
        offset = upd.update_id + 1;
        const m = upd.message; if (!m || !m.text) continue;
        const cid = m.chat.id;
        console.log("[" + cid + "] " + m.from.first_name + ": " + m.text);
        if (m.text === "/start") { await tg("sendMessage", { chat_id: cid, text: "NemoClaw Agent ready. Send me a message.", reply_to_message_id: m.message_id }); continue; }
        await tg("sendChatAction", { chat_id: cid, action: "typing" });
        const ti = setInterval(() => tg("sendChatAction", { chat_id: cid, action: "typing" }), 4000);
        const resp = askAgent(m.text, String(cid));
        clearInterval(ti);
        console.log("[" + cid + "] agent: " + resp.slice(0, 150));
        const chunks = []; for (let i = 0; i < resp.length; i += 4000) chunks.push(resp.slice(i, i + 4000));
        for (const c of chunks) await tg("sendMessage", { chat_id: cid, text: c, reply_to_message_id: m.message_id }).catch(() => tg("sendMessage", { chat_id: cid, text: c }));
      }
    } catch (e) { console.error("Error:", e.message); await new Promise(r => setTimeout(r, 3000)); }
  }
}

run().catch(e => { console.error("Fatal:", e); process.exit(1); });
