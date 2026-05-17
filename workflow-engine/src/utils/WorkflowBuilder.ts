import { 
  WorkflowConfig, 
  WorkflowTrigger, 
  WorkflowCondition, 
  WorkflowStep, 
  ExitCondition 
} from '../types/workflow';

export class WorkflowBuilder {
  private config: Partial<WorkflowConfig> = {
    steps: [],
    conditions: [],
    exit_conditions: []
  };

  constructor(id?: string) {
    if (id) this.config.id = id;
    else this.config.id = `wf_${Date.now()}`;
  }

  setName(name: string): this {
    this.config.name = name;
    return this;
  }

  setDescription(desc: string): this {
    this.config.description = desc;
    return this;
  }

  setTrigger(trigger: WorkflowTrigger): this {
    this.config.trigger = trigger;
    return this;
  }

  addCondition(condition: WorkflowCondition): this {
    this.config.conditions!.push(condition);
    return this;
  }

  addStep(step: Omit<WorkflowStep, 'id'> & { id?: string }): this {
    const stepId = step.id || `step_${this.config.steps!.length + 1}`;
    this.config.steps!.push({ ...step, id: stepId });
    return this;
  }

  addExitCondition(condition: ExitCondition): this {
    this.config.exit_conditions!.push(condition);
    return this;
  }

  build(): WorkflowConfig {
    if (!this.config.name) throw new Error("Workflow must have a name");
    if (!this.config.trigger) throw new Error("Workflow must have a trigger");
    if (this.config.steps!.length === 0) throw new Error("Workflow must have at least one step");

    return this.config as WorkflowConfig;
  }
}
