import { BatchRegistrationForm } from "@/components/BatchRegistrationForm";

export default function RegisterPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-green-800">Register drug batch</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete the form, pay the Lightning invoice (demo auto-confirms), then your batch is published to the
          configured Nostr relay.
        </p>
      </div>
      <BatchRegistrationForm />
    </main>
  );
}
