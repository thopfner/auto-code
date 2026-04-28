import type { OperatorGateway, OperatorMessage } from "../../core/src/index.js";
import type { EntityId } from "../../core/src/types.js";

export class FakeOperatorGateway implements OperatorGateway {
  readonly statusMessages: OperatorMessage[] = [];
  readonly approvalRequests: Array<OperatorMessage & { approvalId: EntityId }> = [];

  async sendStatus(message: OperatorMessage): Promise<void> {
    this.statusMessages.push(message);
  }

  async sendApprovalRequest(message: OperatorMessage & { approvalId: EntityId }): Promise<void> {
    this.approvalRequests.push(message);
  }
}
