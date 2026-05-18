# Architecture & Privacy Overview - Blocks Network POC

## Executive Summary

Blocks Network gives us a platform for AI agent orchestration and communication, while we keep complete control over our business logic, data, and infrastructure. This document covers architecture, privacy, and security considerations for our proof-of-concept.

The important privacy point: our handler code, database, and context files stay fully private. Blocks Network only handles transport, registry, and orchestration — it never sees or executes our business logic.

---

## Architecture Overview

### What Blocks Network Handles

Blocks Network provides the infrastructure layer. PubNub WebSockets handle transport with TLS encryption. The registry handles agent discovery by name, so we're not managing hardcoded URLs. Orchestration covers task lifecycle — progress events, artifacts, terminal events. Streaming uses bidirectional real-time data channels. Authentication through API keys, JWT tokens, and consumer access control keeps things secure.

### What We Control

We maintain control over everything that matters to us. Handler code runs on our servers or machines. Database stays on our infrastructure, direct access only. Business logic — implementation details, algorithms, processes — is ours. Context files, including configuration, prompts, and multi-file context, are ours. Security (database access controls, API keys, secrets) remains under our control.

### Data Flow

```
Consumer                           Our Agent
    │                                    │
    │ 1. sendMessage()                  │
    ├──────────────────────────────>          │
    │    (Registry lookup)                 │
    │                                    │
    │ 2. Task published                  │
    ├──────────────────────────────>  Blocks Network (PubNub)
    │    (TLS encrypted)                  │
    │                                    │
    │ 3. Task received                  │
    ├──────────────────────────────>          │
    │    (WebSockets)                     │
    │                                    │
    │ 4. Handler executes              │
    │                                    │ Our Infrastructure:
    │    - Accesses our DB               │ - Handler code
    │    - Processes business logic        │ - Database
    │    - Reads context files            │ - Context files
    │                                    │
    │ 5. Result published               │
    <──────────────────────────────          │
    │    (TLS encrypted)                  │
```

---

## Privacy Controls

| Data Type          | Location           | Who Controls   | Privacy Level                |
| ------------------ | ------------------ | -------------- | ---------------------------- |
| **Handler code**   | Our servers        | Us             | Fully private                |
| **Database**       | Our infrastructure | Us             | Fully private                |
| **Context files**  | Our codebase       | Us             | Fully private                |
| **Business logic** | Our implementation | Us             | Fully private                |
| **Task input**     | PubNub transit     | Blocks Network | TLS encrypted (E2E optional) |
| **Task output**    | PubNub transit     | Blocks Network | TLS encrypted (E2E optional) |
| **Agent metadata** | Registry           | Public         | Public                       |
| **Registry info**  | Platform           | Public         | Public                       |

---

## Security Features

### Built-in Security

TLS encryption covers all PubNub WebSockets for transport. API keys become JWT tokens for authentication. Consumer access control limits who can call our agent. Each task runs in a separate context for agent isolation. Timeout controls in agent-card.json (`maxRunningTimeSec`) prevent hanging tasks. Channel-level access controls secure streaming.

### Optional: End-to-End Encryption

Enable E2E in agent-card.json for sensitive data:

```json
{
  "security": {
    "encryption": {
      "algorithm": "E2E",
      "consumerKeyRequired": true,
      "keys": {
        "publicKey": "...",
        "privateKey": "..."
      }
    }
  }
}
```

Use E2E for highly sensitive task data, healthcare or financial information, or compliance requirements like HIPAA and PCI-DSS.

TLS works fine for general business data, non-sensitive information, and internal use cases.

---

## Risk Assessment

### High-Priority Risks

| Risk                       | Level  | Impact                                                          | Mitigation |
| -------------------------- | ------ | --------------------------------------------------------------- | ---------- |
| Registry metadata exposure | Medium | Avoid secrets in agent-card.json; use placeholders for examples |
| Public agent discovery     | Low    | Document expected usage; rate limiting if needed                |
| Transport visibility       | Low    | TLS encryption by default; E2E available for sensitive data     |

### Low-Priority Risks

| Risk                 | Level | Impact                                 | Mitigation |
| -------------------- | ----- | -------------------------------------- | ---------- |
| Local code exposure  | None  | Blocks Network never sees handler code |
| Database access      | None  | Our infrastructure; we control access  |
| Context file leakage | None  | Our codebase; standard git security    |

### Not Applicable

| Concern                        | Status | Reason                            |
| ------------------------------ | ------ | --------------------------------- |
| Platform executes our code     | N/A    | Handler runs on our servers       |
| Platform accesses our database | N/A    | Direct DB connection from handler |
| Platform reads context files   | N/A    | File system access in handler     |

---

## Recommendations

### For This POC

Review agent-card.json before publishing. Remove any API keys or secrets. Use placeholders in examples. Validate IO schemas don't expose internal structure.

Implement audit logging in handler.ts:

```typescript
ctx?.reportStatus(`Processing task ${task.taskId} for ${task.ownerId}`);
// Log to our internal audit system
```

Database security needs connection pooling, query logging, separate read/write permissions.

Test with public agents. Validate registry metadata. Monitor agent logs for anomalies.

### For Production Deployment

Enable E2E encryption for sensitive workflows. Implement rate limiting in handler logic. Add monitoring and alerting for unusual patterns. Document data retention policies. Review compliance (GDPR, SOC2, etc.).

### For Internal Feedback

What data do we process? Who are the consumers? Any sensitivity concerns? Performance requirements?

---

## FAQ

### General Architecture

**Q: Is this like AWS Lambda?**  
A: No. Blocks Network provides agent orchestration plus real-time communication via PubNub. Our handler runs on our infrastructure, not theirs.

**Q: Can we use our existing database?**  
A: Yes. Our handler connects directly to our database. Blocks Network doesn't see or access it.

**Q: What happens if our agent is down?**  
A: Tasks are queued and timeout after `maxRunningTimeSec`. Consumers get timeout error, no automatic retry.

### Privacy & Security

**Q: Can Blocks Network see our handler code?**  
A: No. Handler code runs on our servers. Blocks only orchestrates communication.

**Q: Can Blocks Network access our database?**  
A: No. Our handler connects to our database. Blocks has no access.

**Q: Is task input encrypted?**  
A: Yes, via TLS by default. E2E encryption is optional but recommended for sensitive data.

**Q: Who can call our agent?**  
A: Anyone who discovers it in registry, unless we implement consumer access controls.

**Q: Is our context file data safe?**  
A: Yes. Context files are read by our handler running on our servers. Blocks never sees them.

### Development & Deployment

**Q: Do we need to republish after code changes?**  
A: No for local testing (just restart agent). Yes for registry updates, so consumers get latest metadata.

**Q: How do we monitor agent performance?**  
A: Blocks Network provides task logs. Our handler can implement custom metrics via `ctx.reportStatus()`.

**Q: Can we restrict access to our organization?**  
A: Not natively, but we can implement authentication in handler logic (check `task.ownerId` or add API key validation).

### Comparison to Alternatives

| Aspect              | Blocks Network    | AWS Lambda    | HTTP Microservices |
| ------------------- | ----------------- | ------------- | ------------------ |
| **Where code runs** | Our servers       | AWS           | Our servers        |
| **Transport**       | PubNub WebSockets | HTTP          | HTTP               |
| **Discovery**       | Built-in registry | Custom        | Custom             |
| **Real-time**       | Native            | Polling       | Polling            |
| **Agent-to-agent**  | Built-in          | Manual HTTP   | Manual HTTP        |
| **Data privacy**    | Local execution   | AWS execution | Local execution    |

---
