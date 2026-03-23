# Troubleshooting Streaming Inference Errors

## Symptoms

You may see warnings in sandbox logs like:

```
sandbox WARN routing proxy inference request (streaming) endpoint=https://integrate.api.nvidia.com/v1
sandbox WARN error reading upstream response chunk: error decoding response body
```

## Root Cause

This occurs when network policies use `tls: terminate` with `protocol: rest` and `enforcement: enforce`. This configuration causes the OpenShell proxy to:

1. Terminate TLS from the sandbox
2. Attempt to inspect and decode the HTTP response
3. Fail to properly decode chunked transfer encoding used in streaming responses

## Solution

**Update the network policy to use `access: full` instead of `tls: terminate`.**

### Example Fix

**Before** (causes streaming errors):
```yaml
network_policies:
  nvidia:
    endpoints:
      - host: integrate.api.nvidia.com
        port: 443
        protocol: rest
        enforcement: enforce
        tls: terminate
        rules:
          - allow: { method: "*", path: "/**" }
```

**After** (allows streaming):
```yaml
network_policies:
  nvidia:
    endpoints:
      - host: integrate.api.nvidia.com
        port: 443
        access: full
```

### Why This Works

`access: full` enables CONNECT tunneling, allowing encrypted traffic to pass through the proxy without layer-7 inspection. This preserves the streaming protocol integrity.

## Applying the Fix

### For Existing Sandboxes

```bash
# Update your policy file
# Then apply it to your sandbox
openshell policy set <sandbox-name> --policy path/to/updated-policy.yaml --wait
```

### For New Sandboxes

The fix is included in NemoClaw v0.2.0+ (commits 301ad5d, e4b4b68). No action needed for new installations.

## Affected APIs

Any API using chunked transfer encoding for streaming responses may exhibit this issue:

- NVIDIA Inference API (integrate.api.nvidia.com)
- Anthropic Claude API (api.anthropic.com)  
- Hugging Face Inference API
- OpenAI streaming completions
- Custom streaming APIs

## Related Issues

- Similar issue with GitHub and npm fixed in commit 24a1b4e
- CONNECT tunneling is required for git clone and npm install operations

## References

- [Network Policy Documentation](../reference/network-policies.md)
- [OpenShell Policy Reference](https://docs.openshell.ai/policies)
