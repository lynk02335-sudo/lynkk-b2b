import { WorkflowConfig, WorkflowStep } from '../types/workflow';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export class WorkflowValidator {
  /**
   * Validate a workflow configuration object against business rules.
   */
  static validate(workflow: WorkflowConfig): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!workflow.name) {
      errors.push({ field: 'name', message: 'Workflow must have a name' });
    }

    if (!workflow.trigger || !workflow.trigger.type) {
      errors.push({ field: 'trigger', message: 'Workflow must have a valid trigger type' });
    }

    if (!workflow.steps || workflow.steps.length === 0) {
      errors.push({ field: 'steps', message: 'Workflow must have at least one step' });
    } else {
      workflow.steps.forEach((step, idx) => {
        // Validate Step ID
        if (!step.id) {
          errors.push({ field: `steps[${idx}].id`, message: 'Step must have an ID' });
        }

        // Validate Delay
        if (!step.delay) {
          errors.push({ field: `steps[${idx}].delay`, message: 'Step must have a delay configuration' });
        } else {
          if (step.delay.value < 0) {
            errors.push({ field: `steps[${idx}].delay.value`, message: 'Delay value cannot be negative' });
          }
          if (step.delay.value === 0 && step.delay.unit === 'days') {
            warnings.push({ field: `steps[${idx}].delay`, message: 'Delay is 0 days, consider using minutes' });
          }
          if (step.delay.value > 365 && step.delay.unit === 'days') {
            warnings.push({ field: `steps[${idx}].delay`, message: 'Delay is over 1 year, ensure this is intended' });
          }
        }

        // Validate Action
        if (!step.action || !step.action.type) {
          errors.push({ field: `steps[${idx}].action`, message: 'Step must have a valid action type' });
        }
      });
    }

    // Optional: Warn if there are no exit conditions
    if (!workflow.exit_conditions || workflow.exit_conditions.length === 0) {
      warnings.push({ field: 'exit_conditions', message: 'Workflow has no exit conditions. Users will only exit when all steps complete.' });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}
