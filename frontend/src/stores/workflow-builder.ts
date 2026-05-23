import { create } from 'zustand';
import type { WorkflowStep, WorkflowTrigger, WorkflowCondition, ExitCondition } from '@/types';

export type NodeType = 'trigger' | 'condition' | 'step' | 'exit';

export interface BuilderNode {
  id: string;
  type: NodeType;
  trigger?: WorkflowTrigger;
  condition?: WorkflowCondition;
  step?: WorkflowStep;
  exitCondition?: ExitCondition;
}

interface WorkflowBuilderState {
  name: string;
  nodes: BuilderNode[];
  selectedNodeId: string | null;
  setName: (name: string) => void;
  setNodes: (nodes: BuilderNode[]) => void;
  addNode: (node: BuilderNode) => void;
  removeNode: (id: string) => void;
  updateNode: (id: string, updates: Partial<BuilderNode>) => void;
  selectNode: (id: string | null) => void;
  reorderNodes: (fromIndex: number, toIndex: number) => void;
  reset: () => void;
}

const defaultTriggerNode: BuilderNode = {
  id: 'trigger',
  type: 'trigger',
  trigger: { type: 'event.occurred', config: { event_name: '' } },
};

export const useWorkflowBuilderStore = create<WorkflowBuilderState>((set) => ({
  name: 'Untitled Workflow',
  nodes: [defaultTriggerNode],
  selectedNodeId: 'trigger',

  setName: (name) => set({ name }),
  setNodes: (nodes) => set({ nodes }),

  addNode: (node) =>
    set((state) => ({ nodes: [...state.nodes, node] })),

  removeNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
    })),

  updateNode: (id, updates) =>
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    })),

  selectNode: (id) => set({ selectedNodeId: id }),

  reorderNodes: (fromIndex, toIndex) =>
    set((state) => {
      const newNodes = [...state.nodes];
      const [moved] = newNodes.splice(fromIndex, 1);
      newNodes.splice(toIndex, 0, moved);
      return { nodes: newNodes };
    }),

  reset: () =>
    set({ name: 'Untitled Workflow', nodes: [defaultTriggerNode], selectedNodeId: 'trigger' }),
}));
