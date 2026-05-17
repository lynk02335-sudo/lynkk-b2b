export interface MessagePayload {
  to: string;
  template?: string;
  message?: string;
  data?: Record<string, any>;
}

export interface MessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface ChannelAdapter {
  send(payload: MessagePayload): Promise<MessageResult>;
  validateConfig(): boolean;
}

export class WatiAdapter implements ChannelAdapter {
  constructor(private apiKey: string, private endpoint: string) {}

  async send(payload: MessagePayload): Promise<MessageResult> {
    console.log(`[WatiAdapter] Sending WhatsApp to ${payload.to} using template ${payload.template}`);
    // Stub implementation
    return { success: true, messageId: `wati-${Date.now()}` };
  }

  validateConfig(): boolean {
    return !!this.apiKey && !!this.endpoint;
  }
}

export class ResendAdapter implements ChannelAdapter {
  constructor(private apiKey: string) {}

  async send(payload: MessagePayload): Promise<MessageResult> {
    console.log(`[ResendAdapter] Sending Email to ${payload.to} using template ${payload.template}`);
    // Stub implementation
    return { success: true, messageId: `resend-${Date.now()}` };
  }

  validateConfig(): boolean {
    return !!this.apiKey;
  }
}

export class SlackAdapter implements ChannelAdapter {
  constructor(private webhookUrl: string) {}

  async send(payload: MessagePayload): Promise<MessageResult> {
    console.log(`[SlackAdapter] Sending alert to ${payload.to}: ${payload.message}`);
    // Stub implementation
    return { success: true, messageId: `slack-${Date.now()}` };
  }

  validateConfig(): boolean {
    return !!this.webhookUrl;
  }
}
