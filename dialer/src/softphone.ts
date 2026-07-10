// Wraps the Twilio Voice SDK: one Device, one active call at a time.
// The device stays registered while the app is open; tokens auto-refresh.

import { Device, Call } from '@twilio/voice-sdk';
import type { Settings } from './types';
import { fetchVoiceToken } from './api';

export type SoftphoneState = 'offline' | 'ready' | 'connecting' | 'in-call' | 'error';

export interface SoftphoneEvents {
  onStateChange: (state: SoftphoneState, detail?: string) => void;
  onCallEnded: () => void;
}

export class Softphone {
  private device: Device | null = null;
  private activeCall: Call | null = null;
  private settings: Settings;
  private events: SoftphoneEvents;

  constructor(settings: Settings, events: SoftphoneEvents) {
    this.settings = settings;
    this.events = events;
  }

  async start(): Promise<void> {
    if (this.device) return;
    const { token } = await fetchVoiceToken(this.settings);
    const device = new Device(token, {
      // Prefer Opus; fall back to PCMU for older gateways.
      codecPreferences: ['opus', 'pcmu'] as Call.Codec[],
    });

    device.on('tokenWillExpire', async () => {
      try {
        const { token: fresh } = await fetchVoiceToken(this.settings);
        device.updateToken(fresh);
      } catch {
        this.events.onStateChange('error', 'Could not refresh the voice token.');
      }
    });

    device.on('error', (err: { message?: string }) => {
      this.events.onStateChange('error', err.message ?? 'Voice device error');
    });

    // Register so the connection to Twilio is warm before the first call.
    await device.register();
    this.device = device;
    this.events.onStateChange('ready');
  }

  async dial(to: string, queueId: number): Promise<void> {
    if (!this.device) throw new Error('Softphone not started');
    if (this.activeCall) throw new Error('A call is already active');

    this.events.onStateChange('connecting', to);
    const call = await this.device.connect({
      params: { To: to, queueId: String(queueId) },
    });
    this.activeCall = call;

    call.on('accept', () => this.events.onStateChange('in-call', to));
    const ended = () => {
      this.activeCall = null;
      this.events.onStateChange('ready');
      this.events.onCallEnded();
    };
    call.on('disconnect', ended);
    call.on('cancel', ended);
    call.on('error', (err: { message?: string }) => {
      this.activeCall = null;
      this.events.onStateChange('error', err.message ?? 'Call error');
      this.events.onCallEnded();
    });
  }

  hangUp(): void {
    this.activeCall?.disconnect();
  }

  get inCall(): boolean {
    return this.activeCall !== null;
  }

  stop(): void {
    this.activeCall?.disconnect();
    this.device?.destroy();
    this.device = null;
    this.activeCall = null;
    this.events.onStateChange('offline');
  }
}
