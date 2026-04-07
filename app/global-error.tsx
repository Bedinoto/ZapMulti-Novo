'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 p-4">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Algo deu muito errado!</h2>
          <p className="text-zinc-600 mb-8 text-center max-w-md">
            Ocorreu um erro crítico na inicialização do aplicativo.
            <br />
            <span className="text-xs font-mono bg-zinc-200 p-1 rounded mt-2 block">
              {error.message || 'Erro desconhecido'}
            </span>
          </p>
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
