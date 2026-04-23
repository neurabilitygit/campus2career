import type { CommunicationChannel } from "../../../../../packages/shared/src/contracts/communication";

export interface SendCommunicationInput {
  channel: CommunicationChannel;
  messageBody: string;
  studentProfileId: string;
  strategyId: string;
  metadata?: Record<string, unknown>;
}

export interface SendCommunicationResult {
  ok: boolean;
  providerMode: "mock" | "provider_disabled";
  status: "delivered" | "blocked";
  externalMessageId: string | null;
  note: string;
}

export interface CommunicationProvider {
  send(input: SendCommunicationInput): Promise<SendCommunicationResult>;
}

class MockCommunicationProvider implements CommunicationProvider {
  async send(input: SendCommunicationInput): Promise<SendCommunicationResult> {
    return {
      ok: true,
      providerMode: "mock",
      status: "delivered",
      externalMessageId: `mock-${input.channel}-${Date.now()}`,
      note:
        "Mock delivery only. No real message was sent. To enable production delivery later, wire a real provider behind this abstraction and gate it with explicit configuration.",
    };
  }
}

class DisabledRealProvider implements CommunicationProvider {
  async send(): Promise<SendCommunicationResult> {
    return {
      ok: false,
      providerMode: "provider_disabled",
      status: "blocked",
      externalMessageId: null,
      note:
        "Real delivery is not implemented in this environment. Set COMMUNICATION_DELIVERY_MODE=mock for local use, or add a production provider integration intentionally.",
    };
  }
}

export function getCommunicationProvider(): CommunicationProvider {
  const mode = (process.env.COMMUNICATION_DELIVERY_MODE || "mock").trim().toLowerCase();
  if (mode === "mock") {
    return new MockCommunicationProvider();
  }

  return new DisabledRealProvider();
}
