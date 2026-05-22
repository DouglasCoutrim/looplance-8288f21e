import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-black text-white">
      <h1 className="text-2xl font-bold">Looplance - Pronto para Recomeçar</h1>
    </div>
  ),
})
