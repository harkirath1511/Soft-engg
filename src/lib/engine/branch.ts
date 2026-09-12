import { BranchSpec, ReplayEvent, ReconstructedState, FieldDiff } from '../types/event';
import { reconstructRecord, reconstructTable } from './reconstruct';
import { computeStateDiff } from './diff';

export interface BranchComparison {
  recordPk: string;
  tableName: string;
  diverged: boolean;
  actualState: Record<string, unknown> | null;
  branchedState: Record<string, unknown> | null;
  diffs: FieldDiff[];
}

/**
 * Simulates and materializes a counterfactual branch timeline.
 * Replays events from base timestamp while omitting excluded transaction IDs and applying overrides.
 */
export class BranchEngine {
  private branches: Map<string, BranchSpec> = new Map();

  createBranch(spec: Omit<BranchSpec, 'branchId' | 'createdAt'>): BranchSpec {
    const branchId = 'br_' + Math.random().toString(36).substring(2, 9);
    const branch: BranchSpec = {
      ...spec,
      branchId,
      createdAt: new Date().toISOString(),
    };
    this.branches.set(branchId, branch);
    return branch;
  }

  getBranch(branchId: string): BranchSpec | undefined {
    return this.branches.get(branchId);
  }

  listBranches(): BranchSpec[] {
    return Array.from(this.branches.values());
  }

  /**
   * Reconstructs table state under the counterfactual branch rules
   */
  replayBranchTable(
    branch: BranchSpec,
    tableName: string,
    events: ReplayEvent[],
    asOfTimestamp?: Date | string
  ) {
    const targetTime = asOfTimestamp ?? new Date().toISOString();
    const excludedSet = new Set(branch.excludedTransactions);

    return reconstructTable(tableName, events, targetTime, {
      excludedTransactions: excludedSet,
      overrides: branch.overrides,
    });
  }

  /**
   * Compares Reality vs. Branch for a specific record
   */
  compareRecord(
    branch: BranchSpec,
    tableName: string,
    recordPk: string,
    events: ReplayEvent[],
    asOfTimestamp?: Date | string
  ): BranchComparison {
    const targetTime = asOfTimestamp ?? new Date().toISOString();
    const excludedSet = new Set(branch.excludedTransactions);

    const actual = reconstructRecord(tableName, recordPk, events, targetTime);
    const branched = reconstructRecord(tableName, recordPk, events, targetTime, {
      excludedTransactions: excludedSet,
      overrides: branch.overrides,
    });

    const diffs = computeStateDiff(actual.state, branched.state);
    const diverged = diffs.some((d) => d.status !== 'unchanged');

    return {
      recordPk,
      tableName,
      diverged,
      actualState: actual.state,
      branchedState: branched.state,
      diffs,
    };
  }
}

export const defaultBranchEngine = new BranchEngine();
