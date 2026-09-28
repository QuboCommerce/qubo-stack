import { SignInForm } from "@/components/sign-in-form";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <section className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">HM Froid</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Connectez-vous au panneau d’administration.
        </p>
        <SignInForm />
      </section>
    </main>
  );
}
