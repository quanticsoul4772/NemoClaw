#!/usr/bin/env python3
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Write default openclaw.json for the sandbox image.
# Sets nvidia as the default provider, routing through inference.local
# (OpenShell gateway proxy). No API key needed — openshell injects credentials.

import json
import os
import stat

config = {
    "agents": {
        "defaults": {
            "model": {"primary": "nvidia/nemotron-3-super-120b-a12b"}
        }
    },
    "models": {
        "mode": "merge",
        "providers": {
            "nvidia": {
                "baseUrl": "https://inference.local/v1",
                "apiKey": "openshell-managed",
                "api": "openai-completions",
                "models": [
                    {
                        "id": "nemotron-3-super-120b-a12b",
                        "name": "NVIDIA Nemotron 3 Super 120B",
                        "reasoning": False,
                        "input": ["text"],
                        "cost": {
                            "input": 0,
                            "output": 0,
                            "cacheRead": 0,
                            "cacheWrite": 0,
                        },
                        "contextWindow": 131072,
                        "maxTokens": 4096,
                    }
                ],
            }
        },
    },
}

config_path = os.path.expanduser("~/.openclaw/openclaw.json")
os.makedirs(os.path.dirname(config_path), exist_ok=True)

with open(config_path, "w") as f:
    json.dump(config, f, indent=2)

os.chmod(config_path, stat.S_IRUSR | stat.S_IWUSR)
