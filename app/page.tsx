export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-pink-50 to-purple-100">
      <h1 className="text-4xl font-bold text-gray-800 mb-4">
        Bem-vindo ao EstéticIA
      </h1>
      <p className="text-lg text-gray-600 mb-8">
        Sua plataforma inteligente de gestão para estética
      </p>
      <div className="flex gap-4">
        <a
          href="/login"
          className="px-6 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition"
        >
          Entrar
        </a>
        <a
          href="/registro"
          className="px-6 py-3 border-2 border-pink-600 text-pink-600 rounded-lg hover:bg-pink-50 transition"
        >
          Cadastrar
        </a>
      </div>
    </div>
  );
}