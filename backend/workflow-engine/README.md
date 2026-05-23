# Lynkk Workflow Engine

The flexible, event-driven workflow engine for Lynkk, built to automate user retention and growth workflows.

## Stack
- Node.js & TypeScript
- Fastify (Web API)
- Prisma (PostgreSQL ORM)
- BullMQ (Redis-backed Job Queue)

## Defining a Custom Workflow

Workflows are defined in a JSON-compatible structure using the `WorkflowConfig` schema.

### Example Workflow
Here is an example of a workflow that sends a welcome email 1 hour after the user signs up, and then follows up with a Slack alert to the internal team 1 day later.

```json
{
  "id": "custom_welcome_flow",
  "name": "Custom Welcome Flow",
  "trigger": {
    "type": "event.occurred",
    "config": { "event_name": "signed_up" }
  },
  "steps": [
    {
      "id": "step_1",
      "delay": { "value": 1, "unit": "hours" },
      "action": {
        "type": "send_email",
        "config": { "template": "welcome_email" }
      }
    },
    {
      "id": "step_2",
      "delay": { "value": 1, "unit": "days" },
      "action": {
        "type": "send_slack_alert",
        "config": { "channel": "#new-users", "message": "User {{user.id}} has been active for 1 day." }
      }
    }
  ],
  "exit_conditions": [
    {
      "type": "state_changed",
      "config": { "state": "churned" }
    }
  ]
}
```

### Key Components

- **Trigger:** Defines *when* a workflow starts. Triggers can be based on time (inactivity) or events (user actions).
- **Steps:** An ordered list of actions to perform. Each step can be delayed by minutes, hours, or days using the `delay` object.
- **Actions:** Integrations with external channels (e.g., `send_whatsapp`, `send_email`, `send_slack_alert`).
- **Exit Conditions:** Automatically exits a user from the workflow if certain criteria are met (e.g., they upgrade their plan or change state).

## Local Development

1. Run `npm install`
2. Configure `.env` with `DATABASE_URL` (Postgres) and `REDIS_HOST`/`REDIS_PORT`.
3. Run `npx prisma generate` and `npx prisma db push`
4. Use `npm run dev` (set up with ts-node or tsx).
