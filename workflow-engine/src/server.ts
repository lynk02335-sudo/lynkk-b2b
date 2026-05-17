import fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import { WorkflowValidator } from './core/WorkflowValidator';
import { Simulator } from './core/Simulator';
import { WorkflowConfig } from './types/workflow';

const server = fastify({ logger: true });
const prisma = new PrismaClient();

server.post('/api/workflows', async (request, reply) => {
  const data = request.body as any;

  // Validate the workflow configuration
  const validation = WorkflowValidator.validate(data.config as WorkflowConfig);
  if (!validation.valid) {
    return reply.status(400).send({ error: 'Invalid workflow configuration', details: validation.errors });
  }

  const workflow = await prisma.workflow.create({
    data: {
      workspace_id: data.workspace_id || 'default',
      name: data.config.name,
      description: data.config.description,
      config: data.config,
      active: false // Draft mode by default
    }
  });

  return reply.status(201).send(workflow);
});

server.get('/api/workflows', async (request, reply) => {
  const workflows = await prisma.workflow.findMany();
  return reply.send(workflows);
});

server.get('/api/workflows/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const workflow = await prisma.workflow.findUnique({ where: { id } });
  if (!workflow) return reply.status(404).send({ error: 'Workflow not found' });
  return reply.send(workflow);
});

server.put('/api/workflows/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const data = request.body as any;

  if (data.config) {
    const validation = WorkflowValidator.validate(data.config as WorkflowConfig);
    if (!validation.valid) {
      return reply.status(400).send({ error: 'Invalid workflow configuration', details: validation.errors });
    }
  }

  const workflow = await prisma.workflow.update({
    where: { id },
    data
  });
  return reply.send(workflow);
});

server.delete('/api/workflows/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const workflow = await prisma.workflow.update({
    where: { id },
    data: { active: false } // Soft delete / pause
  });
  return reply.send({ message: 'Workflow deactivated', workflow });
});

server.post('/api/workflows/:id/activate', async (request, reply) => {
  const { id } = request.params as { id: string };
  const workflow = await prisma.workflow.update({
    where: { id },
    data: { active: true }
  });
  return reply.send({ message: 'Workflow activated', workflow });
});

server.post('/api/workflows/:id/pause', async (request, reply) => {
  const { id } = request.params as { id: string };
  const workflow = await prisma.workflow.update({
    where: { id },
    data: { active: false }
  });
  return reply.send({ message: 'Workflow paused', workflow });
});

server.post('/api/workflows/:id/clone', async (request, reply) => {
  const { id } = request.params as { id: string };
  const original = await prisma.workflow.findUnique({ where: { id } });
  if (!original) return reply.status(404).send({ error: 'Workflow not found' });

  const clonedConfig = { ...(original.config as any), id: `wf_${Date.now()}` };
  
  const clone = await prisma.workflow.create({
    data: {
      workspace_id: original.workspace_id,
      name: `${original.name} (Copy)`,
      description: original.description,
      config: clonedConfig,
      active: false
    }
  });
  
  return reply.status(201).send(clone);
});

server.post('/api/workflows/:id/simulate', async (request, reply) => {
  const { id } = request.params as { id: string };
  const { userId } = request.body as { userId: string };

  const workflowRecord = await prisma.workflow.findUnique({ where: { id } });
  if (!workflowRecord) return reply.status(404).send({ error: 'Workflow not found' });

  // Fetch mock user data
  const user = await prisma.user.findUnique({ where: { id: userId } }) || { id: userId, state: 'active' };

  const result = await Simulator.simulate(workflowRecord.config as unknown as WorkflowConfig, user);
  return reply.send(result);
});

// Users API
server.get('/api/users', async (request, reply) => {
  const users = await prisma.user.findMany();
  return reply.send(users);
});

server.get('/api/users/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return reply.status(404).send({ error: 'User not found' });
  return reply.send(user);
});

server.put('/api/users/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const data = request.body as any;
  const user = await prisma.user.update({
    where: { id },
    data
  });
  return reply.send(user);
});

// Templates API
server.post('/api/workflow-templates', async (request, reply) => {
  const data = request.body as any;
  const template = await prisma.workflowTemplate.create({
    data: {
      name: data.name,
      description: data.description,
      config: data.config,
      category: data.category || 'custom',
      tags: data.tags || [],
      is_public: data.is_public || false,
      author_workspace_id: data.author_workspace_id || 'default'
    }
  });
  return reply.status(201).send(template);
});

server.get('/api/workflow-templates', async (request, reply) => {
  const templates = await prisma.workflowTemplate.findMany();
  return reply.send(templates);
});

const start = async () => {
  try {
    await server.listen({ port: 3001 });
    console.log(`Server listening on http://localhost:3001`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
