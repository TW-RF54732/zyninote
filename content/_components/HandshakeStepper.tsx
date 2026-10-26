import { useState } from "react";
import { Interactive } from "zyninote";

const STEPS = [
  { from: "Client", to: "Server", flags: "SYN", note: "Client 送出 SYN，帶初始序號 seq = x" },
  { from: "Server", to: "Client", flags: "SYN + ACK", note: "Server 回覆 SYN+ACK，seq = y，ack = x + 1" },
  { from: "Client", to: "Server", flags: "ACK", note: "Client 回覆 ACK，ack = y + 1，連線建立" },
];

/** Step through the TCP three-way handshake. */
export default function HandshakeStepper() {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  return (
    <Interactive description="TCP 三次握手逐步示範：1. Client 送 SYN（seq=x）；2. Server 回 SYN+ACK（seq=y, ack=x+1）；3. Client 回 ACK（ack=y+1）後連線建立。">
      <div className="demo-stepper">
        <div className="demo-stepper-flow">
          <span>{current.from}</span>
          <span className="demo-stepper-arrow">— {current.flags} →</span>
          <span>{current.to}</span>
        </div>
        <p>{current.note}</p>
        <div className="demo-stepper-controls">
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            上一步
          </button>
          <span>
            {step + 1} / {STEPS.length}
          </span>
          <button type="button" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} disabled={step === STEPS.length - 1}>
            下一步
          </button>
        </div>
      </div>
    </Interactive>
  );
}
