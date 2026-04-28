import { useMemo, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { telegramCommandCatalog, type TelegramCommandName } from "../../../packages/core/src/index.js";
import {
  buildSetupPayload,
  connectionSummary,
  defaultOnboardingForm,
  nextStep,
  onboardingSteps,
  previousStep,
  validateStep,
  type OnboardingForm,
  type OnboardingStepId,
  type OnboardingValidation
} from "./onboarding.js";
import "./styles.css";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

function App() {
  const [form, setForm] = useState<OnboardingForm>(defaultOnboardingForm);
  const [step, setStep] = useState<OnboardingStepId>("telegram");
  const [validation, setValidation] = useState<OnboardingValidation>();
  const [busyAction, setBusyAction] = useState<"validate" | "save">();
  const [apiError, setApiError] = useState<string>();
  const stepErrors = useMemo(() => validateStep(form, step), [form, step]);
  const summary = connectionSummary(validation);

  function update<K extends keyof OnboardingForm>(key: K, value: OnboardingForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setApiError(undefined);
  }

  function toggleCommand(command: TelegramCommandName) {
    const commands = form.telegramCommands.includes(command)
      ? form.telegramCommands.filter((item) => item !== command)
      : [...form.telegramCommands, command];
    update("telegramCommands", commands);
  }

  function goNext() {
    if (stepErrors.length === 0) {
      setStep(nextStep(step));
    }
  }

  async function runValidation() {
    setBusyAction("validate");
    setApiError(undefined);
    try {
      const result = await requestSetup("/setup/validate");
      setValidation(result);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Setup validation failed.");
    } finally {
      setBusyAction(undefined);
    }
  }

  async function saveSetup(event: FormEvent) {
    event.preventDefault();
    setBusyAction("save");
    setApiError(undefined);
    try {
      const result = await requestSetup("/setup");
      setValidation(result);
      setStep("finish");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Setup could not be saved.");
    } finally {
      setBusyAction(undefined);
    }
  }

  async function requestSetup(path: string): Promise<OnboardingValidation> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildSetupPayload(form))
    });
    const payload = (await response.json().catch(() => undefined)) as OnboardingValidation | { message?: string } | undefined;
    if (!response.ok) {
      throw new Error((payload && "message" in payload && payload.message) || `HTTP ${response.status}`);
    }
    return payload as OnboardingValidation;
  }

  return (
    <main className="shell">
      <nav className="sidebar" aria-label="Primary">
        <strong>Auto Forge</strong>
        <a href="#onboarding" aria-current="page">
          Onboarding
        </a>
        <a href="#connections">Connections</a>
        <a href="#commands">Commands</a>
      </nav>

      <form className="workspace" id="onboarding" onSubmit={saveSetup}>
        <header className="topbar">
          <div>
            <p className="eyebrow">First-run setup</p>
            <h1>Controller Onboarding</h1>
            <p>Connect Telegram and OpenClaw before accepting Forge tasks.</p>
          </div>
          <span className={validation?.ok ? "status status-success" : "status"}>{validation?.ok ? "Ready" : "Setup required"}</span>
        </header>

        <ol className="stepper" aria-label="Onboarding progress">
          {onboardingSteps.map((item) => (
            <li className={item.id === step ? "step-active" : ""} key={item.id}>
              {item.label}
            </li>
          ))}
        </ol>

        <section className="panel" aria-labelledby={`${step}-heading`}>
          {step === "telegram" ? (
            <TelegramStep form={form} update={update} toggleCommand={toggleCommand} />
          ) : undefined}
          {step === "openclaw" ? <OpenClawStep form={form} update={update} /> : undefined}
          {step === "validate" ? (
            <ValidateStep
              busy={busyAction === "validate"}
              form={form}
              validation={validation}
              onValidate={runValidation}
            />
          ) : undefined}
          {step === "finish" ? <FinishStep validation={validation} /> : undefined}
        </section>

        {stepErrors.length > 0 ? (
          <div className="notice notice-danger" role="alert">
            {stepErrors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        ) : undefined}

        {apiError ? (
          <div className="notice notice-danger" role="alert">
            <p>{apiError}</p>
          </div>
        ) : undefined}

        <section className="status-grid" id="connections" aria-label="Connection status">
          {summary.map((item) => (
            <article className="status-row" key={item.label}>
              <div>
                <h2>{item.label}</h2>
                <p>{statusCopy(item.state)}</p>
              </div>
              <span className={`state state-${item.state}`}>{item.state}</span>
            </article>
          ))}
        </section>

        <footer className="actions">
          <button type="button" className="button-secondary" disabled={step === "telegram"} onClick={() => setStep(previousStep(step))}>
            Back
          </button>
          {step === "validate" ? (
            <button type="button" className="button-secondary" disabled={busyAction !== undefined} onClick={runValidation}>
              {busyAction === "validate" ? "Validating" : "Run checks"}
            </button>
          ) : undefined}
          {step === "validate" || step === "finish" ? undefined : (
            <button type="button" disabled={stepErrors.length > 0 || busyAction !== undefined} onClick={goNext}>
              Continue
            </button>
          )}
          <button type="submit" disabled={!validation?.ok || busyAction !== undefined}>
            {busyAction === "save" ? "Saving" : "Save setup"}
          </button>
        </footer>
      </form>
    </main>
  );
}

interface StepProps {
  form: OnboardingForm;
  update: <K extends keyof OnboardingForm>(key: K, value: OnboardingForm[K]) => void;
}

function TelegramStep({
  form,
  update,
  toggleCommand
}: StepProps & { toggleCommand: (command: TelegramCommandName) => void }) {
  return (
    <>
      <h2 id="telegram-heading">Telegram Bot</h2>
      <div className="field-grid">
        <label>
          Bot token reference
          <input value={form.telegramBotTokenRef} onChange={(event) => update("telegramBotTokenRef", event.target.value)} />
        </label>
        <label>
          Test chat ID
          <input value={form.telegramTestChatId} onChange={(event) => update("telegramTestChatId", event.target.value)} />
        </label>
      </div>
      <div className="toggle-grid">
        <label>
          <input
            checked={form.telegramRegisterCommands}
            type="checkbox"
            onChange={(event) => update("telegramRegisterCommands", event.target.checked)}
          />
          Register bot commands
        </label>
        <label>
          <input
            checked={form.telegramSendTestMessage}
            type="checkbox"
            onChange={(event) => update("telegramSendTestMessage", event.target.checked)}
          />
          Send setup test message
        </label>
      </div>
      <fieldset id="commands">
        <legend>Command set</legend>
        <div className="command-grid">
          {telegramCommandCatalog.map((command) => (
            <label className="command-option" key={command.command}>
              <input
                checked={form.telegramCommands.includes(command.command)}
                type="checkbox"
                onChange={() => toggleCommand(command.command)}
              />
              <span>/{command.command}</span>
              <small>{command.description}</small>
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

function OpenClawStep({ form, update }: StepProps) {
  return (
    <>
      <h2 id="openclaw-heading">OpenClaw Gateway</h2>
      <div className="field-grid">
        <label>
          Setup mode
          <select value={form.openClawMode} onChange={(event) => update("openClawMode", event.target.value as OnboardingForm["openClawMode"])}>
            <option value="detect-existing">Detect existing gateway</option>
            <option value="install-or-onboard">Install or onboard gateway</option>
            <option value="configure-later">Configure later</option>
            <option value="advanced-webhook">Advanced webhook</option>
          </select>
        </label>
        <label>
          Gateway URL
          <input value={form.openClawBaseUrl} onChange={(event) => update("openClawBaseUrl", event.target.value)} />
        </label>
        <label>
          Hook path
          <input value={form.openClawAgentHookPath} onChange={(event) => update("openClawAgentHookPath", event.target.value)} />
        </label>
        {form.openClawMode === "advanced-webhook" ? (
          <label>
            Webhook auth reference
            <input value={form.openClawAuthRef} onChange={(event) => update("openClawAuthRef", event.target.value)} />
          </label>
        ) : undefined}
      </div>
    </>
  );
}

function ValidateStep({
  busy,
  form,
  onValidate,
  validation
}: {
  busy: boolean;
  form: OnboardingForm;
  onValidate: () => void;
  validation: OnboardingValidation | undefined;
}) {
  return (
    <>
      <h2 id="validate-heading">Connection Checks</h2>
      <div className="review-grid">
        <div>
          <span>Telegram</span>
          <strong>{form.telegramBotTokenRef}</strong>
          <small>{form.telegramTestChatId}</small>
        </div>
        <div>
          <span>OpenClaw</span>
          <strong>{form.openClawBaseUrl}</strong>
          <small>{form.openClawAgentHookPath}</small>
        </div>
      </div>
      <button type="button" className="button-secondary" disabled={busy} onClick={onValidate}>
        {busy ? "Validating" : "Validate connections"}
      </button>
      <CheckList validation={validation} />
    </>
  );
}

function FinishStep({ validation }: { validation: OnboardingValidation | undefined }) {
  return (
    <>
      <h2 id="finish-heading">Setup Saved</h2>
      <p className="muted">Telegram and OpenClaw setup checks are complete. The controller can now use these connection references.</p>
      <CheckList validation={validation} />
    </>
  );
}

function CheckList({ validation }: { validation: OnboardingValidation | undefined }) {
  if (!validation) {
    return <p className="muted">No validation run yet.</p>;
  }

  return (
    <ul className="check-list">
      {validation.checks.map((check) => (
        <li key={check.name}>
          <span className={`state state-${check.status}`}>{check.status}</span>
          <span>{check.message}</span>
        </li>
      ))}
    </ul>
  );
}

function statusCopy(state: string): string {
  if (state === "passed") {
    return "Validation passed";
  }
  if (state === "failed") {
    return "Needs attention";
  }
  if (state === "skipped") {
    return "Skipped by setup choice";
  }
  return "Awaiting validation";
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing root element");
}

createRoot(root).render(<App />);
