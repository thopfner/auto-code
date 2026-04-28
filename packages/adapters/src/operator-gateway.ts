import type { ControllerSetup, OperatorGateway, OperatorMessage } from "../../core/src/index.js";
import type { OpenClawSetupAdapter } from "./openclaw.js";

export class OpenClawOperatorGateway implements OperatorGateway {
  constructor(
    private readonly setup: ControllerSetup,
    private readonly openClaw: OpenClawSetupAdapter,
    private readonly chatId = setup.telegram.testChatId
  ) {}

  async sendStatus(message: OperatorMessage): Promise<void> {
    await this.openClaw.sendTelegramStatus(this.setup.openClaw, this.chatId, message.text);
  }

  async sendApprovalRequest(message: OperatorMessage & { approvalId: string }): Promise<void> {
    const actions = message.buttons?.map((button) => `[${button.label}: ${button.value}]`).join(" ") ?? "";
    await this.openClaw.sendTelegramStatus(
      this.setup.openClaw,
      this.chatId,
      `${message.text}\nApproval: ${message.approvalId}${actions ? `\n${actions}` : ""}`
    );
  }
}
