export default function MaintenancePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-lg">
        <div className="text-6xl">🧊</div>
        <h1 className="text-3xl font-bold">Maintenance en cours</h1>
        <p className="text-muted-foreground text-lg">
          Notre site est temporairement indisponible pour maintenance. Nous
          serons de retour très bientôt.
        </p>
      </div>
    </main>
  );
}
