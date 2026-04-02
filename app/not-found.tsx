import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50">
      <h2 className="text-2xl font-bold text-zinc-900 mb-4">Página não encontrada</h2>
      <p className="text-zinc-600 mb-8">Não conseguimos encontrar a página que você está procurando.</p>
      <Link
        href="/"
        className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors"
      >
        Voltar para o Início
      </Link>
    </div>
  );
}
