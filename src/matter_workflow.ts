import { z } from 'zod';
import { infrai } from './infrai_client.js';

export const matterIntakeSchema = z.object({
  matterId: z.string().min(3),
  accountId: z.string().min(1),
  clientId: z.string().min(1),
  sessionId: z.string().min(1),
  matterType: z.enum(['intake', 'signed-document', 'deadline-follow-up']),
  clientDisplayName: z.string().min(1),
  summary: z.string().min(1),
  signedDocumentId: z.string().optional(),
  deadlineAt: z.string().datetime().optional()
});

export type MatterIntakeInput = z.infer<typeof matterIntakeSchema>;

export type MatterWorkflowResult = {
  channel: string;
  event: string;
  nextAction: 'collect-intake-details' | 'confirm-signed-document' | 'schedule-deadline-follow-up';
  tokenIssuedFor: string;
};

export function pickMatterTransition(input: MatterIntakeInput): MatterWorkflowResult {
  const channel = `matter-${input.matterId}`;

  if (input.matterType === 'intake') {
    return {
      channel,
      event: 'matter.intake.opened',
      nextAction: 'collect-intake-details',
      tokenIssuedFor: input.clientId
    };
  }

  if (input.matterType === 'signed-document') {
    return {
      channel,
      event: 'matter.document.signed',
      nextAction: 'confirm-signed-document',
      tokenIssuedFor: input.clientId
    };
  }

  return {
    channel,
    event: 'matter.deadline.follow_up_due',
    nextAction: 'schedule-deadline-follow-up',
    tokenIssuedFor: input.clientId
  };
}

export async function openMatterRoom(raw: unknown): Promise<MatterWorkflowResult> {
  const input = matterIntakeSchema.parse(raw);
  const transition = pickMatterTransition(input);

  await infrai.auth.session.verify(input.sessionId);

  await infrai.realtime.channel.create({
    channel: transition.channel,
    type: 'private',
    vendor: 'migration-cutover'
  });

  await infrai.realtime.publish({
    channel: transition.channel,
    event: transition.event,
    account_id: input.accountId,
    data: {
      matterId: input.matterId,
      matterType: input.matterType,
      clientDisplayName: input.clientDisplayName,
      summary: input.summary,
      signedDocumentId: input.signedDocumentId ?? null,
      deadlineAt: input.deadlineAt ?? null,
      nextAction: transition.nextAction
    }
  });

  await infrai.realtime.token.issue({
    client_id: transition.tokenIssuedFor,
    channels: [transition.channel],
    capabilities: ['publish', 'subscribe', 'presence'],
    ttl_seconds: 3600
  });

  return transition;
}
