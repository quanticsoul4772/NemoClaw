# NemoClaw sandbox image — OpenClaw + NemoClaw plugin inside OpenShell

FROM node:22-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 python3-pip python3-venv \
        curl git ca-certificates \
        iproute2 \
    && rm -rf /var/lib/apt/lists/*

# Create sandbox user (matches OpenShell convention)
RUN groupadd -r sandbox && useradd -r -g sandbox -d /sandbox -s /bin/bash sandbox \
    && mkdir -p /sandbox/.openclaw /sandbox/.nemoclaw \
    && chown -R sandbox:sandbox /sandbox

# Install OpenClaw CLI
RUN npm install -g openclaw@2026.3.11

# Install PyYAML in a venv (avoids --break-system-packages)
RUN python3 -m venv /opt/nemoclaw-venv \
    && /opt/nemoclaw-venv/bin/pip install --no-cache-dir pyyaml
ENV PATH="/opt/nemoclaw-venv/bin:$PATH"

# --- Layer caching strategy ---
# 1. Copy package.json first (changes rarely) → cache npm install layer
COPY nemoclaw/package.json /opt/nemoclaw/
WORKDIR /opt/nemoclaw
RUN npm install --omit=dev

# 2. Copy built artifacts and config (changes on rebuild)
COPY nemoclaw/dist/ /opt/nemoclaw/dist/
COPY nemoclaw/openclaw.plugin.json /opt/nemoclaw/

# 3. Copy blueprint (changes independently)
COPY nemoclaw-blueprint/ /opt/nemoclaw-blueprint/

# Set up blueprint for local resolution
RUN mkdir -p /sandbox/.nemoclaw/blueprints/0.1.0 \
    && cp -r /opt/nemoclaw-blueprint/* /sandbox/.nemoclaw/blueprints/0.1.0/

# Copy startup script
COPY scripts/nemoclaw-start.sh /usr/local/bin/nemoclaw-start
RUN chmod +x /usr/local/bin/nemoclaw-start

WORKDIR /sandbox
USER sandbox

# Pre-create OpenClaw directories
RUN mkdir -p /sandbox/.openclaw/agents/main/agent \
    && chmod 700 /sandbox/.openclaw

# Write openclaw.json: set nvidia as default provider, route through
# inference.local (OpenShell gateway proxy). No API key needed here —
# openshell injects credentials via the provider configuration.
RUN python3 -c "\
import json, os; \
config = { \
    'agents': {'defaults': {'model': {'primary': 'nvidia/nemotron-3-super-120b-a12b'}}}, \
    'models': {'mode': 'merge', 'providers': {'nvidia': { \
        'baseUrl': 'https://inference.local/v1', \
        'apiKey': 'openshell-managed', \
        'api': 'openai-completions', \
        'models': [{'id': 'nemotron-3-super-120b-a12b', 'name': 'NVIDIA Nemotron 3 Super 120B', 'reasoning': False, 'input': ['text'], 'cost': {'input': 0, 'output': 0, 'cacheRead': 0, 'cacheWrite': 0}, 'contextWindow': 131072, 'maxTokens': 4096}] \
    }}} \
}; \
path = os.path.expanduser('~/.openclaw/openclaw.json'); \
json.dump(config, open(path, 'w'), indent=2); \
os.chmod(path, 0o600)"

# Install NemoClaw plugin into OpenClaw
RUN openclaw doctor --fix > /dev/null 2>&1 || true \
    && openclaw plugins install /opt/nemoclaw > /dev/null 2>&1 || true

ENTRYPOINT ["/bin/bash"]
CMD []
